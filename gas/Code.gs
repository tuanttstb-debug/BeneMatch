/**
 * Code.gs — BeneMatch GAS gateway (Web App) — ĐƯỜNG TÙY CHỌN cho nội bộ/tích hợp.
 * Kênh vận hành chính là công cụ offline (docs/index.html) — dữ liệu không rời máy.
 * Engine: gas/Engine.gs (SINH TỪ src/engine/bm-engine.js, không sửa tay) → globalThis.BM.
 * Không còn phụ thuộc Dify/LLM trên đường quyết định (engine v3 deterministic).
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
  return jsonOut_({ ok: true, service: 'BeneMatch', engine: BM.ENGINE_VERSION, mode: 'case-reconcile' });
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = payload.action || 'reconcile';
    if (action === 'reconcile') return jsonOut_(handleReconcile_(payload));
    if (action === 'verify_name') return jsonOut_(handleVerifyName_(payload));
    return jsonOut_({ error: 'action không hợp lệ: ' + action });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
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
