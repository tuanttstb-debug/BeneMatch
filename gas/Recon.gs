/**
 * Recon.gs — bản port SYNC của src/recon cho Google Apps Script (V8).
 * Thuần logic (không dùng API GAS) → Node load được để test parity.
 * Nguồn logic gốc: src/recon/*.js. Parity gate: gas/verify_recon.mjs.
 * KHÔNG sửa lệch với src/recon mà không chạy lại parity.
 */

var RECON_DEFAULT_CONFIG = {
  config_version: '0',
  amount: { abs_tolerance_vnd: 1000, rel_tolerance: 0.001 },
  ocr: { min_confidence: 0.85 },
  grouping: { key: 'mst_then_name', mst_min_digits: 10 },
  severity: {},
};

var RECON_WARN_META = {
  AMOUNT_MATCH: { sev: 0, risk: 'LOW' },
  AMOUNT_OVER_TOLERANCE: { sev: 1, risk: 'HIGH' },
  AMOUNT_UNDER_TOLERANCE: { sev: 1, risk: 'MEDIUM' },
  DUPLICATE_INVOICE: { sev: 1, risk: 'HIGH' },
  TRANSFER_MISSING_FOR_GROUP: { sev: 1, risk: 'MEDIUM' },
  INVOICE_MISSING_FOR_TRANSFER: { sev: 1, risk: 'HIGH' },
  BENEFICIARY_NAME_REVIEW: { sev: 1, risk: 'MEDIUM' },
  BENEFICIARY_NAME_MISMATCH: { sev: 2, risk: 'HIGH' },
  POSSIBLE_OCR_ERROR: { sev: 1, risk: 'MEDIUM' },
  GROUP_KEY_FALLBACK_NAME: { sev: 0, risk: 'LOW' },
};
var RECON_DECISION_BY_SEV = ['MATCH', 'REVIEW', 'NOT_MATCH'];
var RECON_ACTION_BY_SEV = ['ALLOW', 'WARN', 'BLOCK'];
var RECON_RISK_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };

var RECON_REPLACEMENTS = [
  [/\bJOINT\s+STOCK\s+COMPANY\b/g, 'CONG TY CO PHAN'],
  [/\bJOINT\s+STOCK\s+CO\b/g, 'CONG TY CO PHAN'],
  [/\bC\.T\.C\.P\b/g, 'CONG TY CO PHAN'],
  [/\bCTCP\b/g, 'CONG TY CO PHAN'],
  [/\bCONG\s+TY\s+CP\b/g, 'CONG TY CO PHAN'],
  [/\bJSC\b/g, 'CONG TY CO PHAN'],
  [/\bLIMITED\s+LIABILITY\s+COMPANY\b/g, 'CONG TY TNHH'],
  [/\bCOMPANY\s+LIMITED\b/g, 'CONG TY TNHH'],
  [/\bCO\.?\s*,?\s*LTD\b/g, 'CONG TY TNHH'],
  [/\bLTD\b/g, 'CONG TY TNHH'],
  [/\bCONG\s+TY\s+TRACH\s+NHIEM\s+HUU\s+HAN\s+MOT\s+THANH\s+VIEN\b/g, 'CONG TY TNHH MOT THANH VIEN'],
  [/\bTRACH\s+NHIEM\s+HUU\s+HAN\b/g, 'TNHH'],
  [/\bT\.N\.H\.H\b/g, 'TNHH'],
  [/\bTNHH\s+MTV\b/g, 'TNHH MOT THANH VIEN'],
  [/\bTNHH\s+1\s*TV\b/g, 'TNHH MOT THANH VIEN'],
  [/\bMTV\b/g, 'MOT THANH VIEN'],
  [/\bDNTN\b/g, 'DOANH NGHIEP TU NHAN'],
  [/\bHTX\b/g, 'HOP TAC XA'],
  [/\bC\.TY\b/g, 'CONG TY'],
  [/\bCTY\b/g, 'CONG TY'],
  [/&/g, ' VA '],
];
var RECON_LEGAL_PREFIXES = [
  'CONG TY TNHH MOT THANH VIEN', 'CONG TY CO PHAN', 'CONG TY TNHH',
  'DOANH NGHIEP TU NHAN', 'HOP TAC XA', 'CONG TY',
];

function reconStripAccents(s) {
  return s.replace(/Đ/g, 'D').replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function reconNormalizeName(raw) {
  if (!raw) return '';
  var s = String(raw).toUpperCase().trim();
  s = reconStripAccents(s);
  s = s.replace(/[,;:/\\_()\[\]{}"'`-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (var i = 0; i < RECON_REPLACEMENTS.length; i++) s = s.replace(RECON_REPLACEMENTS[i][0], RECON_REPLACEMENTS[i][1]);
  return s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}
function reconExtractCoreName(normalized) {
  var s = normalized || '';
  for (var i = 0; i < RECON_LEGAL_PREFIXES.length; i++) {
    var p = RECON_LEGAL_PREFIXES[i];
    if (s === p) return s;
    if (s.indexOf(p + ' ') === 0) { s = s.slice(p.length + 1).trim(); break; }
  }
  return s;
}
function reconNormalizeMst(raw) { return String(raw == null ? '' : raw).replace(/\D/g, ''); }

function reconMergeConfig(cfg) {
  cfg = cfg || {};
  return {
    config_version: cfg.config_version || RECON_DEFAULT_CONFIG.config_version,
    amount: Object.assign({}, RECON_DEFAULT_CONFIG.amount, cfg.amount),
    ocr: Object.assign({}, RECON_DEFAULT_CONFIG.ocr, cfg.ocr),
    grouping: Object.assign({}, RECON_DEFAULT_CONFIG.grouping, cfg.grouping),
    severity: Object.assign({}, cfg.severity),
  };
}
function reconSevOf(code, cfg) {
  if (cfg.severity && Object.prototype.hasOwnProperty.call(cfg.severity, code)) return cfg.severity[code];
  return (RECON_WARN_META[code] || { sev: 1 }).sev;
}
function reconRiskOf(code) { return (RECON_WARN_META[code] || { risk: 'MEDIUM' }).risk; }
function reconFmtVnd(n) { return (Number(n) || 0).toLocaleString('vi-VN') + ' đ'; }

function reconGroupKeyOf(entity, cfg) {
  var mst = reconNormalizeMst(entity.beneficiary_mst);
  if (mst.length >= cfg.grouping.mst_min_digits) return { key: mst, type: 'MST' };
  return { key: 'NAME:' + reconExtractCoreName(reconNormalizeName(entity.beneficiary_name)), type: 'NAME_FALLBACK' };
}
function reconMkWarn(code, cfg, message, extra) {
  var w = { code: code, severity: reconSevOf(code, cfg), risk: reconRiskOf(code), message: message || '' };
  if (extra) for (var k in extra) w[k] = extra[k];
  return w;
}
function reconSuspectOcr(inv, cfg) {
  if (typeof inv.ocr_confidence === 'number' && inv.ocr_confidence < cfg.ocr.min_confidence) return true;
  var mst = reconNormalizeMst(inv.beneficiary_mst);
  if (mst && (mst.length < 10 || mst.length > 14)) return true;
  if (!(Number(inv.amount_total) > 0)) return true;
  if (inv.beneficiary_name && /[^A-Za-z0-9À-ỹĐđ\s.,&/()-]/.test(inv.beneficiary_name)) return true;
  return false;
}

/**
 * reconcileBatch(invoices, transfers, config, verifyFn, opts) -> batchResponse (SYNC).
 * verifyFn SYNC: (pair) => { decision, reason_codes, source }
 */
function reconcileBatch(invoices, transfers, config, verifyFn, opts) {
  var cfg = reconMergeConfig(config);
  var batch_id = (opts && opts.batch_id) || 'BM-BATCH-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-0001';
  invoices = invoices || []; transfers = transfers || [];

  var groups = {}; var order = [];
  function ensure(gk) {
    if (!groups[gk.key]) { groups[gk.key] = { key: gk.key, type: gk.type, invoices: [], transfers: [] }; order.push(gk.key); }
    return groups[gk.key];
  }
  invoices.forEach(function (inv) { ensure(reconGroupKeyOf(inv, cfg)).invoices.push(inv); });
  transfers.forEach(function (t) { ensure(reconGroupKeyOf(t, cfg)).transfers.push(t); });

  var outGroups = [], allWarnings = [], signalTrace = [];

  order.forEach(function (key) {
    var g = groups[key];
    var warnings = [];
    var sum_invoices = g.invoices.reduce(function (s, x) { return s + (Number(x.amount_total) || 0); }, 0);
    var sum_transfers = g.transfers.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var diff = sum_transfers - sum_invoices;
    var tolerance = Math.max(cfg.amount.abs_tolerance_vnd, Math.round(cfg.amount.rel_tolerance * sum_invoices));
    var display = (g.invoices[0] && g.invoices[0].beneficiary_name) || (g.transfers[0] && g.transfers[0].beneficiary_name) || g.key;

    if (g.type === 'NAME_FALLBACK') warnings.push(reconMkWarn('GROUP_KEY_FALLBACK_NAME', cfg, 'Nhóm theo TÊN (thiếu MST) — độ tin thấp hơn'));
    if (g.invoices.length && !g.transfers.length) warnings.push(reconMkWarn('TRANSFER_MISSING_FOR_GROUP', cfg, 'Có hóa đơn (' + reconFmtVnd(sum_invoices) + ') nhưng thiếu lệnh chuyển tiền'));
    if (g.transfers.length && !g.invoices.length) warnings.push(reconMkWarn('INVOICE_MISSING_FOR_TRANSFER', cfg, 'Có lệnh chuyển tiền (' + reconFmtVnd(sum_transfers) + ') nhưng thiếu hóa đơn'));

    var amount_status = 'AMOUNT_MATCH';
    if (g.invoices.length && g.transfers.length) {
      if (diff > tolerance) { amount_status = 'AMOUNT_OVER_TOLERANCE'; warnings.push(reconMkWarn('AMOUNT_OVER_TOLERANCE', cfg, 'Thừa chi ' + reconFmtVnd(diff) + ' (dung sai ' + reconFmtVnd(tolerance) + ')')); }
      else if (diff < -tolerance) { amount_status = 'AMOUNT_UNDER_TOLERANCE'; warnings.push(reconMkWarn('AMOUNT_UNDER_TOLERANCE', cfg, 'Thiếu chi ' + reconFmtVnd(-diff) + ' (dung sai ' + reconFmtVnd(tolerance) + ')')); }
    }

    var seen = {};
    g.invoices.forEach(function (inv) {
      var kId = inv.invoice_id ? 'ID:' + inv.invoice_id : null;
      var kTriple = 'T:' + reconNormalizeMst(inv.beneficiary_mst) + '|' + (Number(inv.amount_total) || 0) + '|' + (inv.invoice_date || '');
      var keys = [kId, kTriple];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]; if (!k) continue;
        if (seen[k]) { warnings.push(reconMkWarn('DUPLICATE_INVOICE', cfg, 'Hóa đơn nghi trùng: ' + (inv.invoice_id || '(không số)') + ' (' + reconFmtVnd(inv.amount_total) + ')', { invoice_id: inv.invoice_id })); break; }
        seen[k] = true;
      }
    });

    g.invoices.forEach(function (inv) {
      if (reconSuspectOcr(inv, cfg)) warnings.push(reconMkWarn('POSSIBLE_OCR_ERROR', cfg, 'Nghi lỗi OCR ở hóa đơn ' + (inv.invoice_id || '(không số)') + ' — cần kiểm tra tay', { invoice_id: inv.invoice_id }));
    });

    var name_decision = null, name_reason_codes = [], name_source = null;
    if (g.invoices.length && g.transfers.length && typeof verifyFn === 'function') {
      var r = verifyFn({
        request_id: batch_id + ':' + g.key,
        invoice_beneficiary_name: g.invoices[0].beneficiary_name,
        payment_beneficiary_name: g.transfers[0].beneficiary_name,
        invoice_account_number: '', payment_account_number: g.transfers[0].account_number || '',
      });
      name_decision = r.decision; name_reason_codes = r.reason_codes || []; name_source = r.source || null;
      if (name_decision === 'NOT_MATCH') warnings.push(reconMkWarn('BENEFICIARY_NAME_MISMATCH', cfg, 'Tên bên thụ hưởng KHÁC pháp nhân giữa hóa đơn và lệnh CT', { reason_codes: name_reason_codes }));
      else if (name_decision === 'REVIEW') warnings.push(reconMkWarn('BENEFICIARY_NAME_REVIEW', cfg, 'Tên bên thụ hưởng gần giống nhưng chưa đủ căn cứ', { reason_codes: name_reason_codes }));
    }

    var maxSev = warnings.reduce(function (m, w) { return Math.max(m, w.severity); }, 0);
    var risk_level = warnings.filter(function (w) { return w.severity === maxSev; })
      .reduce(function (r, w) { return RECON_RISK_RANK[w.risk] > RECON_RISK_RANK[r] ? w.risk : r; }, 'LOW');

    var grp = {
      group_key: g.key, key_type: g.type, beneficiary_display: display,
      invoices: g.invoices.map(function (x) { return x.invoice_id; }),
      transfers: g.transfers.map(function (x) { return x.transfer_id; }),
      sum_invoices: sum_invoices, sum_transfers: sum_transfers, diff: diff, tolerance: tolerance, amount_status: amount_status,
      name_decision: name_decision, name_reason_codes: name_reason_codes, name_source: name_source,
      warnings: warnings,
      decision: RECON_DECISION_BY_SEV[maxSev], action: RECON_ACTION_BY_SEV[maxSev], risk_level: maxSev === 0 ? 'LOW' : risk_level,
    };
    outGroups.push(grp);
    warnings.forEach(function (w) { var o = { group_key: g.key, beneficiary: display }; for (var k in w) o[k] = w[k]; allWarnings.push(o); });
    signalTrace.push({ group_key: g.key, sum_invoices: sum_invoices, sum_transfers: sum_transfers, diff: diff, tolerance: tolerance, amount_status: amount_status, name_decision: name_decision });
  });

  outGroups.sort(function (a, b) { return (RECON_RISK_RANK[b.risk_level] - RECON_RISK_RANK[a.risk_level]) || (b.sum_invoices - a.sum_invoices); });
  allWarnings.sort(function (a, b) { return (b.severity - a.severity) || (RECON_RISK_RANK[b.risk] - RECON_RISK_RANK[a.risk]); });

  var grand_total_invoices = invoices.reduce(function (s, x) { return s + (Number(x.amount_total) || 0); }, 0);
  var grand_total_transfers = transfers.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
  var batchSev = outGroups.reduce(function (m, g) { return Math.max(m, RECON_DECISION_BY_SEV.indexOf(g.decision)); }, 0);
  var batchRisk = outGroups.reduce(function (r, g) { return RECON_RISK_RANK[g.risk_level] > RECON_RISK_RANK[r] ? g.risk_level : r; }, 'LOW');

  return {
    batch_id: batch_id,
    summary: {
      decision: RECON_DECISION_BY_SEV[batchSev], action: RECON_ACTION_BY_SEV[batchSev],
      risk_level: batchSev === 0 ? 'LOW' : batchRisk,
      grand_total_invoices: grand_total_invoices, grand_total_transfers: grand_total_transfers,
      grand_diff: grand_total_transfers - grand_total_invoices,
      group_count: outGroups.length, warning_count: allWarnings.length,
    },
    groups: outGroups, warnings: allWarnings,
    audit: {
      config_version: cfg.config_version, recon_version: '1.0',
      name_verify_source: (outGroups.filter(function (g) { return g.name_source; })[0] || {}).name_source || 'NONE',
      computed_at: new Date().toISOString(), signal_trace: signalTrace,
    },
  };
}

/** parseTransferCsv — port sync (header cố định). */
function reconSplitCsvLine(line) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out.map(function (s) { return s.trim(); });
}
function reconParseTransferCsv(text) {
  if (!text) return [];
  var lines = String(text).replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim().length; });
  if (!lines.length) return [];
  var header = reconSplitCsvLine(lines[0]).map(function (h) { return h.toLowerCase(); });
  function idx(n) { return header.indexOf(n); }
  var iName = idx('beneficiary_name'), iMst = idx('beneficiary_mst'), iAcc = idx('account_number'), iAmt = idx('amount');
  var rows = [];
  for (var n = 1; n < lines.length; n++) {
    var c = reconSplitCsvLine(lines[n]);
    rows.push({
      transfer_id: 'CT-' + String(n).padStart(4, '0'),
      beneficiary_name: iName >= 0 ? c[iName] : '',
      beneficiary_mst: iMst >= 0 ? c[iMst] : '',
      account_number: iAcc >= 0 ? String(c[iAcc] || '') : '',
      amount: iAmt >= 0 ? parseInt(String(c[iAmt] || '').replace(/[^\d]/g, ''), 10) || 0 : 0,
    });
  }
  return rows;
}

// Cho phép Node (parity test) truy cập; trong GAS dòng này vô hại (typeof module === 'undefined').
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reconcileBatch: reconcileBatch, reconParseTransferCsv: reconParseTransferCsv, reconNormalizeName: reconNormalizeName, reconExtractCoreName: reconExtractCoreName };
}
