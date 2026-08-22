'use strict';
/**
 * reconcile.js — tầng đối chiếu lô (Batch Reconciliation).
 * Deterministic 100%: gộp nhóm theo người thụ hưởng → tổng nhóm + grand total
 * → tolerance/over-under → duplicate → OCR flag → verify tên (qua verifyFn).
 * Xem AI_CONTEXT/RECONCILIATION_SPEC.md.
 */
const { normalizeName, extractCoreName, normalizeMst, normalizeAccount } = require('./normalize');

// Meta cảnh báo: severity (0 info/match · 1 review · 2 not_match) + risk hiển thị.
const WARN_META = {
  AMOUNT_MATCH:                 { sev: 0, risk: 'LOW' },
  AMOUNT_OVER_TOLERANCE:        { sev: 1, risk: 'HIGH' },
  AMOUNT_UNDER_TOLERANCE:       { sev: 1, risk: 'MEDIUM' },
  DUPLICATE_INVOICE:            { sev: 1, risk: 'HIGH' },
  TRANSFER_MISSING_FOR_GROUP:   { sev: 1, risk: 'MEDIUM' },
  INVOICE_MISSING_FOR_TRANSFER: { sev: 1, risk: 'HIGH' },
  BENEFICIARY_NAME_REVIEW:      { sev: 1, risk: 'MEDIUM' },
  BENEFICIARY_NAME_MISMATCH:    { sev: 2, risk: 'HIGH' },
  POSSIBLE_OCR_ERROR:           { sev: 1, risk: 'MEDIUM' },
  GROUP_KEY_FALLBACK_NAME:      { sev: 0, risk: 'LOW' },
};

const DECISION_BY_SEV = ['MATCH', 'REVIEW', 'NOT_MATCH'];
const ACTION_BY_SEV   = ['ALLOW', 'WARN', 'BLOCK'];

const DEFAULT_CONFIG = {
  config_version: '0',
  amount: { abs_tolerance_vnd: 1000, rel_tolerance: 0.001 },
  ocr: { min_confidence: 0.85 },
  grouping: { key: 'mst_then_name', mst_min_digits: 10 },
  severity: {},
};

function mergeConfig(cfg) {
  const c = cfg || {};
  return {
    config_version: c.config_version || DEFAULT_CONFIG.config_version,
    amount: Object.assign({}, DEFAULT_CONFIG.amount, c.amount),
    ocr: Object.assign({}, DEFAULT_CONFIG.ocr, c.ocr),
    grouping: Object.assign({}, DEFAULT_CONFIG.grouping, c.grouping),
    severity: Object.assign({}, c.severity),
  };
}

function sevOf(code, cfg) {
  if (cfg.severity && Object.prototype.hasOwnProperty.call(cfg.severity, code)) return cfg.severity[code];
  return (WARN_META[code] || { sev: 1 }).sev;
}
function riskOf(code) { return (WARN_META[code] || { risk: 'MEDIUM' }).risk; }

const RISK_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';

/** Khóa nhóm: MST nếu đủ chữ số, else core name (fallback). */
function groupKeyOf(entity, cfg) {
  const mst = normalizeMst(entity.beneficiary_mst);
  if (mst.length >= cfg.grouping.mst_min_digits) return { key: mst, type: 'MST' };
  const core = extractCoreName(normalizeName(entity.beneficiary_name));
  return { key: 'NAME:' + core, type: 'NAME_FALLBACK' };
}

function mkWarn(code, cfg, message, extra) {
  return Object.assign({ code, severity: sevOf(code, cfg), risk: riskOf(code), message: message || '' }, extra || {});
}

/** Phát hiện field nghi lỗi OCR (chỉ cờ, không sửa). */
function suspectOcr(inv, cfg) {
  if (typeof inv.ocr_confidence === 'number' && inv.ocr_confidence < cfg.ocr.min_confidence) return true;
  const mst = normalizeMst(inv.beneficiary_mst);
  if (mst && (mst.length < 10 || mst.length > 14)) return true;             // MST VN 10 hoặc 13(+3)
  if (!(Number(inv.amount_total) > 0)) return true;                          // amount lỗi
  if (inv.beneficiary_name && /[^A-Za-z0-9À-ỹĐđ\s.,&/()-]/.test(inv.beneficiary_name)) return true;
  return false;
}

/**
 * reconcile(invoices, transfers, config, verifyFn) -> batchResponse (async).
 * verifyFn: async ({invoice_beneficiary_name, payment_beneficiary_name, ...}) => {decision, reason_codes, source}
 */
async function reconcile(invoices, transfers, config, verifyFn, opts) {
  const cfg = mergeConfig(config);
  const batch_id = (opts && opts.batch_id) || 'BM-BATCH-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-0001';
  invoices = invoices || []; transfers = transfers || [];

  // 1) Gộp nhóm
  const groups = new Map(); // key -> {key,type,invoices[],transfers[]}
  const ensure = (gk) => {
    if (!groups.has(gk.key)) groups.set(gk.key, { key: gk.key, type: gk.type, invoices: [], transfers: [] });
    return groups.get(gk.key);
  };
  for (const inv of invoices) ensure(groupKeyOf(inv, cfg)).invoices.push(inv);
  for (const t of transfers)  ensure(groupKeyOf(t, cfg)).transfers.push(t);

  const outGroups = [];
  const allWarnings = [];
  const signalTrace = [];

  for (const g of groups.values()) {
    const warnings = [];
    const sum_invoices  = g.invoices.reduce((s, x) => s + (Number(x.amount_total) || 0), 0);
    const sum_transfers = g.transfers.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const diff = sum_transfers - sum_invoices;
    const tolerance = Math.max(cfg.amount.abs_tolerance_vnd, Math.round(cfg.amount.rel_tolerance * sum_invoices));

    const display = (g.invoices[0] && g.invoices[0].beneficiary_name)
      || (g.transfers[0] && g.transfers[0].beneficiary_name) || g.key;

    if (g.type === 'NAME_FALLBACK')
      warnings.push(mkWarn('GROUP_KEY_FALLBACK_NAME', cfg, 'Nhóm theo TÊN (thiếu MST) — độ tin thấp hơn'));

    // 4) Unmatched
    if (g.invoices.length && !g.transfers.length)
      warnings.push(mkWarn('TRANSFER_MISSING_FOR_GROUP', cfg, `Có hóa đơn (${fmtVnd(sum_invoices)}) nhưng thiếu lệnh chuyển tiền`));
    if (g.transfers.length && !g.invoices.length)
      warnings.push(mkWarn('INVOICE_MISSING_FOR_TRANSFER', cfg, `Có lệnh chuyển tiền (${fmtVnd(sum_transfers)}) nhưng thiếu hóa đơn`));

    // 3) Amount status (chỉ khi có cả 2 phía)
    let amount_status = 'AMOUNT_MATCH';
    if (g.invoices.length && g.transfers.length) {
      if (diff > tolerance) {
        amount_status = 'AMOUNT_OVER_TOLERANCE';
        warnings.push(mkWarn('AMOUNT_OVER_TOLERANCE', cfg, `Thừa chi ${fmtVnd(diff)} (dung sai ${fmtVnd(tolerance)})`));
      } else if (diff < -tolerance) {
        amount_status = 'AMOUNT_UNDER_TOLERANCE';
        warnings.push(mkWarn('AMOUNT_UNDER_TOLERANCE', cfg, `Thiếu chi ${fmtVnd(-diff)} (dung sai ${fmtVnd(tolerance)})`));
      }
    }

    // 3.7) Duplicate trong nhóm
    const seen = new Map();
    for (const inv of g.invoices) {
      const kId = 'ID:' + (inv.invoice_id || '');
      const kTriple = 'T:' + normalizeMst(inv.beneficiary_mst) + '|' + (Number(inv.amount_total) || 0) + '|' + (inv.invoice_date || '');
      for (const k of [inv.invoice_id ? kId : null, kTriple]) {
        if (!k) continue;
        if (seen.has(k)) {
          warnings.push(mkWarn('DUPLICATE_INVOICE', cfg,
            `Hóa đơn nghi trùng: ${inv.invoice_id || '(không số)'} (${fmtVnd(inv.amount_total)})`,
            { invoice_id: inv.invoice_id }));
          break;
        }
        seen.set(k, true);
      }
    }

    // 3.8) OCR flag
    for (const inv of g.invoices) {
      if (suspectOcr(inv, cfg))
        warnings.push(mkWarn('POSSIBLE_OCR_ERROR', cfg, `Nghi lỗi OCR ở hóa đơn ${inv.invoice_id || '(không số)'} — cần kiểm tra tay`, { invoice_id: inv.invoice_id }));
    }

    // 6) Verify tên (chỉ khi có cả 2 phía)
    let name_decision = null, name_reason_codes = [], name_source = null;
    if (g.invoices.length && g.transfers.length && typeof verifyFn === 'function') {
      const r = await verifyFn({
        request_id: batch_id + ':' + g.key,
        invoice_beneficiary_name: g.invoices[0].beneficiary_name,
        payment_beneficiary_name: g.transfers[0].beneficiary_name,
        invoice_account_number: '', payment_account_number: g.transfers[0].account_number || '',
      });
      name_decision = r.decision; name_reason_codes = r.reason_codes || []; name_source = r.source || null;
      if (name_decision === 'NOT_MATCH')
        warnings.push(mkWarn('BENEFICIARY_NAME_MISMATCH', cfg, `Tên bên thụ hưởng KHÁC pháp nhân giữa hóa đơn và lệnh CT`, { reason_codes: name_reason_codes }));
      else if (name_decision === 'REVIEW')
        warnings.push(mkWarn('BENEFICIARY_NAME_REVIEW', cfg, `Tên bên thụ hưởng gần giống nhưng chưa đủ căn cứ`, { reason_codes: name_reason_codes }));
    }

    // 5) Group decision = severity xấu nhất
    const maxSev = warnings.reduce((m, w) => Math.max(m, w.severity), 0);
    const worst = warnings.filter((w) => w.severity === maxSev);
    const risk_level = worst.reduce((r, w) => (RISK_RANK[w.risk] > RISK_RANK[r] ? w.risk : r), 'LOW');

    const grp = {
      group_key: g.key, key_type: g.type, beneficiary_display: display,
      invoices: g.invoices.map((x) => x.invoice_id), transfers: g.transfers.map((x) => x.transfer_id),
      sum_invoices, sum_transfers, diff, tolerance, amount_status,
      name_decision, name_reason_codes, name_source,
      warnings,
      decision: DECISION_BY_SEV[maxSev], action: ACTION_BY_SEV[maxSev], risk_level: maxSev === 0 ? 'LOW' : risk_level,
    };
    outGroups.push(grp);
    for (const w of warnings) allWarnings.push(Object.assign({ group_key: g.key, beneficiary: display }, w));
    signalTrace.push({ group_key: g.key, sum_invoices, sum_transfers, diff, tolerance, amount_status, name_decision });
  }

  // Sắp nhóm: rủi ro cao trước
  outGroups.sort((a, b) => (RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level]) || (b.sum_invoices - a.sum_invoices));
  allWarnings.sort((a, b) => (b.severity - a.severity) || (RISK_RANK[b.risk] - RISK_RANK[a.risk]));

  const grand_total_invoices  = invoices.reduce((s, x) => s + (Number(x.amount_total) || 0), 0);
  const grand_total_transfers = transfers.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const batchSev = outGroups.reduce((m, g) => Math.max(m, DECISION_BY_SEV.indexOf(g.decision)), 0);
  const batchRisk = outGroups.reduce((r, g) => (RISK_RANK[g.risk_level] > RISK_RANK[r] ? g.risk_level : r), 'LOW');

  return {
    batch_id,
    summary: {
      decision: DECISION_BY_SEV[batchSev], action: ACTION_BY_SEV[batchSev],
      risk_level: batchSev === 0 ? 'LOW' : batchRisk,
      grand_total_invoices, grand_total_transfers, grand_diff: grand_total_transfers - grand_total_invoices,
      group_count: outGroups.length, warning_count: allWarnings.length,
    },
    groups: outGroups,
    warnings: allWarnings,
    audit: {
      config_version: cfg.config_version, recon_version: '1.0',
      name_verify_source: (outGroups.find((g) => g.name_source) || {}).name_source || 'NONE',
      computed_at: new Date().toISOString(),
      signal_trace: signalTrace,
    },
  };
}

module.exports = { reconcile, mergeConfig, WARN_META };
