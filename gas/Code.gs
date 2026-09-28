/**
 * Code.gs — BeneMatch GAS gateway (Web App) — ĐƯỜNG TÙY CHỌN cho nội bộ/tích hợp.
 * Kênh vận hành chính là công cụ offline (docs/index.html) — dữ liệu không rời máy.
 * Engine: gas/Engine.gs (SINH TỪ src/engine/bm-engine.js, không sửa tay) → globalThis.BM.
 * Không còn phụ thuộc Dify/LLM trên đường quyết định (engine v3 deterministic).
 *
 * AI tư vấn (Dify "BeneMatch Name Advisor v3", GPT-5): DIFY_API_URL (vd https://api.dify.ai/v1) + DIFY_API_KEY
 *   = app key của workflow advisor (hoặc DIFY_ADVISOR_URL/KEY nếu muốn tách riêng) · ACCESS_CODES (JSON {"mã":"nhãn"},
 *   tạo bằng hàm taoMaTruyCap) · ADVISOR_DAILY_LIMIT (mặc định 200) · ADVISOR_MAX_PAIRS (mặc định 10).
 *
 * Script Properties (tùy chọn):
 *   SHEET_ID, LOG_SHEET_NAME   — log 1 dòng/hồ sơ (KHÔNG ghi tên/STK chi tiết — chỉ kết luận & số lượng)
 *   USE_OCR ("true"/"false"), OCR_PROVIDER ("drive"|"vision"), VISION_API_KEY
 *   THRESHOLDS_JSON            — override src/config/thresholds.json
 *
 * API (POST JSON):
 *   { action:"reconcile", case:{...}, invoices:[...], transfers:[...] | transfer_orders_csv:"...", files:[{name,mime,data(base64)}] }
 *   { action:"verify_name", pair:{ invoice_beneficiary_name, payment_beneficiary_name } }
 */

function doGet() {
  var p = PropertiesService.getScriptProperties();
  return jsonOut_({ ok: true, service: 'BeneMatch', engine: BM.ENGINE_VERSION, mode: 'case-reconcile',
    advisor: !!(advisorDify_(p).url && advisorDify_(p).key), access_codes: (function () { try { return Object.keys(JSON.parse(p.getProperty('ACCESS_CODES') || '{}')).length; } catch (e) { return 0; } })() });
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = payload.action || 'reconcile';
    if (action === 'reconcile') return jsonOut_(handleReconcile_(payload));
    if (action === 'verify_name') return jsonOut_(handleVerifyName_(payload));
    if (action === 'advise_names') return jsonOut_(handleAdviseNames_(payload));
    return jsonOut_({ error: 'action không hợp lệ: ' + action });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}

/**
 * AI TƯ VẤN (proxy tới Dify "BeneMatch Name Advisor v3") — chỉ tham khảo, không đổi kết luận engine.
 * Request: { action:"advise_names", access_code, pairs:[{ invoice_name, payment_name }] }
 * - Mã truy cập: Script Property ACCESS_CODES = {"<mã>":"<nhãn đơn vị/cán bộ>", ...} (đổi/thu hồi bất kỳ lúc nào).
 * - Hạn mức: ADVISOR_DAILY_LIMIT cặp/mã/ngày (mặc định 200) · ADVISOR_MAX_PAIRS cặp/lần (mặc định 10).
 * - Server TỰ TÍNH LẠI engine cho từng cặp (không tin dữ liệu client), chỉ gọi AI cho ca đủ điều kiện,
 *   chỉ gửi Dify tên + tóm tắt engine. Log chỉ ghi nhãn mã + số lượng + phân bố ý kiến (KHÔNG ghi tên).
 */
function handleAdviseNames_(payload) {
  var props = PropertiesService.getScriptProperties();
  var codes = {};
  try { codes = JSON.parse(props.getProperty('ACCESS_CODES') || '{}'); } catch (e) {}
  var code = String(payload.access_code || '').trim();
  if (!code || !Object.prototype.hasOwnProperty.call(codes, code)) return { error: 'ACCESS_DENIED', message: 'Mã truy cập không hợp lệ hoặc đã bị thu hồi.' };
  var label = String(codes[code]);
  var dify = advisorDify_(props), url = dify.url, key = dify.key;
  if (!url || !key) return { error: 'ADVISOR_NOT_CONFIGURED', message: 'Chưa cấu hình key Dify (DIFY_API_URL / DIFY_API_KEY).' };

  var maxPairs = Number(props.getProperty('ADVISOR_MAX_PAIRS') || 10);
  var daily = Number(props.getProperty('ADVISOR_DAILY_LIMIT') || 200);
  var cfg = loadConfig_(props);
  var items = (Array.isArray(payload.pairs) ? payload.pairs : []).slice(0, maxPairs).map(function (p) {
    var nc = BM.verifyName(String(p.invoice_name || '').slice(0, 300), String(p.payment_name || '').slice(0, 300), cfg.name);
    return { nc: nc, eligible: BM.advisor.eligible(nc) };
  });
  var todo = items.filter(function (x) { return x.eligible; });

  // Hạn mức theo ngày (khóa để tránh 2 request cùng lúc vượt hạn mức).
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  var qKey = 'q:' + code + ':' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd');
  var used = Number(props.getProperty(qKey) || 0);
  if (used + todo.length > daily) { lock.releaseLock(); return { error: 'QUOTA_EXCEEDED', message: 'Vượt hạn mức ' + daily + ' cặp/ngày cho mã này.', used: used }; }
  props.setProperty(qKey, String(used + todo.length));
  lock.releaseLock();

  var t0 = Date.now();
  var reqs = todo.map(function (x) {
    return {
      url: url.replace(/\/$/, '') + '/workflows/run', method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ inputs: BM.advisor.payload(x.nc), response_mode: 'blocking', user: 'bm-' + label }),
    };
  });
  var resps = reqs.length ? UrlFetchApp.fetchAll(reqs) : [];
  var counts = {};
  todo.forEach(function (x, i) {
    var raw = null;
    try {
      var r = resps[i];
      if (r.getResponseCode() >= 200 && r.getResponseCode() < 300) {
        var d = JSON.parse(r.getContentText());
        raw = d && d.data && d.data.status === 'succeeded' && d.data.outputs ? d.data.outputs.result : null;
      }
    } catch (e) { raw = null; }
    x.advice = BM.advisor.guard(raw, x.nc);
    counts[x.advice.ai_status + ':' + x.advice.verdict] = (counts[x.advice.ai_status + ':' + x.advice.verdict] || 0) + 1;
  });
  try { logAdvisor_(props, label, items.length, todo.length, counts, Date.now() - t0); } catch (e) {}

  return {
    advices: items.map(function (x) {
      return { key: BM.advisor.key(x.nc), eligible: x.eligible, advice: x.advice || null,
        engine: { decision: x.nc.decision, reason_code: x.nc.reason_code, score_pct: x.nc.score_pct } };
    }),
    quota: { used: used + todo.length, limit: daily }, ms: Date.now() - t0, engine: BM.ENGINE_VERSION,
  };
}

/** Endpoint Dify của AI tư vấn: ưu tiên DIFY_ADVISOR_*, không có thì dùng DIFY_API_URL/DIFY_API_KEY sẵn có trong project. */
function advisorDify_(props) {
  return {
    url: props.getProperty('DIFY_ADVISOR_URL') || props.getProperty('DIFY_API_URL') || '',
    key: props.getProperty('DIFY_ADVISOR_KEY') || props.getProperty('DIFY_API_KEY') || '',
  };
}

/**
 * CHẠY TAY trong Apps Script editor (chọn hàm → Run): tạo 1 mã truy cập mới cho cán bộ/đơn vị.
 * Sửa NHAN bên dưới trước khi chạy. Mã in ra ở Execution log — gửi riêng cho người dùng.
 * Thu hồi: Project Settings → Script Properties → sửa ACCESS_CODES (xóa dòng mã).
 */
function taoMaTruyCap() {
  var NHAN = 'Team So hoa';   // ← đổi nhãn đơn vị/cán bộ trước khi Run
  var props = PropertiesService.getScriptProperties();
  var codes = {};
  try { codes = JSON.parse(props.getProperty('ACCESS_CODES') || '{}'); } catch (e) {}
  var code = 'BM-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  codes[code] = NHAN;
  props.setProperty('ACCESS_CODES', JSON.stringify(codes));
  if (!props.getProperty('ADVISOR_DAILY_LIMIT')) props.setProperty('ADVISOR_DAILY_LIMIT', '200');
  Logger.log('Mã truy cập mới cho "' + NHAN + '": ' + code + '   (tổng ' + Object.keys(codes).length + ' mã)');
  return code;
}

/** Log AI tư vấn — KHÔNG ghi tên/STK: chỉ nhãn mã, số cặp, phân bố ý kiến, thời gian. */
function logAdvisor_(props, label, nReq, nAsked, counts, ms) {
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) return;
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName('advisor_log') || ss.insertSheet('advisor_log');
  if (sh.getLastRow() === 0) sh.appendRow(['timestamp', 'access_label', 'pairs_requested', 'pairs_asked_ai', 'verdict_counts', 'ms', 'engine']);
  sh.appendRow([new Date(), label, nReq, nAsked, JSON.stringify(counts), ms, BM.ENGINE_VERSION]);
}

function handleVerifyName_(payload) {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props);
  var pair = payload.pair || {};
  return BM.verifyName(pair.invoice_beneficiary_name || '', pair.payment_beneficiary_name || '', cfg.name);
}

function handleReconcile_(payload) {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props, payload.config_override);
  var useOcr = String(props.getProperty('USE_OCR') || 'false') === 'true';

  var invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
  if (useOcr && Array.isArray(payload.files) && payload.files.length) {
    invoices = invoices.concat(ocrInvoices_(payload.files, cfg, props));   // OcrService.gs
  }
  var transfers = Array.isArray(payload.transfers) ? payload.transfers : [];
  if (!transfers.length && payload.transfer_orders_csv) {
    transfers = BM.io.rowsToRecords(BM.io.parseDelimited(payload.transfer_orders_csv), 'transfer').records;
  }

  var result = BM.reconcileCase({ case: payload.case || {}, invoices: invoices, transfers: transfers }, cfg);
  try { logCase_(props, result); } catch (logErr) { result.audit.log_error = String(logErr); }
  return result;
}

/** Config: thresholds mặc định của engine ⊕ THRESHOLDS_JSON (props) ⊕ config_override (request). */
function loadConfig_(props, override) {
  var raw = null;
  var pj = props.getProperty('THRESHOLDS_JSON');
  if (pj) { try { raw = JSON.parse(pj); } catch (e) {} }
  var cfg = BM.mergeConfig(raw);
  if (override && typeof override === 'object') {
    if (override.abs_tolerance_vnd != null) cfg.amount.abs_tolerance_vnd = override.abs_tolerance_vnd;
    if (override.rel_tolerance != null) cfg.amount.rel_tolerance = override.rel_tolerance;
  }
  return cfg;
}

/** Log 1 dòng/hồ sơ — chỉ kết luận + số lượng + mã cảnh báo (data-boundary: không ghi tên/STK). */
function logCase_(props, result) {
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) return;
  var name = props.getProperty('LOG_SHEET_NAME') || 'case_log';
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(['timestamp', 'case_id', 'decision', 'action', 'risk', 'invoices', 'transfers', 'grand_inv', 'grand_unc', 'grand_diff', 'warnings', 'warning_codes', 'engine']);
  var s = result.summary;
  var codes = {}; result.warnings.forEach(function (w) { if (w.severity > 0) codes[w.code] = (codes[w.code] || 0) + 1; });
  sh.appendRow([new Date(), (result.case && result.case.case_id) || '', s.decision, s.action, s.risk_level, s.invoice_count, s.transfer_count,
    s.grand_total_invoices, s.grand_total_transfers, s.grand_diff, s.warning_count, JSON.stringify(codes), result.audit.engine_version]);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
