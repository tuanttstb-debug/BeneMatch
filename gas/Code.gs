/**
 * Code.gs — BeneMatch GAS gateway (Web App).
 * Luồng Batch Reconciliation: nhận invoices (hoặc files→OCR) + CSV lệnh CT
 * → reconcileBatch (Recon.gs) → verify tên từng nhóm qua Dify V2 → log Sheet → trả FE.
 * Secrets ở Script Properties. Xem AI_CONTEXT/SYSTEM_ARCHITECTURE.md + API_CONTRACT.md.
 *
 * Script Properties cần đặt:
 *   DIFY_API_URL, DIFY_API_KEY   (verify tên; nếu trống → dùng stub nội bộ)
 *   SHEET_ID, LOG_SHEET_NAME      (log; tùy chọn)
 *   USE_OCR ("true"/"false"), VISION_API_KEY, OCR_MIN_CONFIDENCE
 *   THRESHOLDS_JSON               (tùy chọn; override default config)
 */

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'BeneMatch', mode: 'batch-reconcile' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = payload.action || 'reconcile';
    if (action === 'reconcile') return jsonOut_(handleReconcile_(payload));
    if (action === 'verify_name') return jsonOut_(handleVerifyName_(payload));  // debug: 1 cặp tên → full Dify result
    return jsonOut_({ error: 'action không hợp lệ: ' + action });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}

/**
 * Debug route: verify 1 cặp tên qua Dify, trả NGUYÊN result (gồm user_warning.ai_status,
 * generated_by_ai, name_verification.similarity_*) để quan sát nhánh LLM (luật 9) vs template
 * deterministic. Không đi qua Recon → không ảnh hưởng parity. Nếu chưa cấu hình Dify → báo rõ.
 */
function handleVerifyName_(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('DIFY_API_URL');
  var key = props.getProperty('DIFY_API_KEY');
  if (!url || !key) return { error: 'Chưa cấu hình DIFY_API_URL/DIFY_API_KEY (verify_name cần Dify thật)' };
  var pair = payload.pair || {};
  return difyVerifyRaw_(url, key, pair);
}

function handleReconcile_(payload) {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props, payload.config_override);
  var useOcr = String(props.getProperty('USE_OCR') || 'false') === 'true';

  // 1) Invoices: từ payload.invoices, hoặc OCR files nếu bật.
  var invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
  if (useOcr && Array.isArray(payload.files) && payload.files.length) {
    invoices = ocrInvoices_(payload.files, cfg, props);   // OcrService.gs
  }

  // 2) Transfers từ CSV.
  var transfers = reconParseTransferCsv(payload.transfer_orders_csv || '');

  // 3) verifyFn (Dify hoặc stub nội bộ).
  var verifyFn = makeGasVerifier_(props);

  // 4) Reconcile.
  var opts = { batch_id: payload.batch_id || ('BM-BATCH-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss')) };
  var result = reconcileBatch(invoices, transfers, cfg, verifyFn, opts);

  // 5) Log Sheet (best-effort).
  try { logBatch_(props, result); } catch (logErr) { result.audit.log_error = String(logErr); }

  return result;
}

/** Config: default (Recon.gs) ⊕ THRESHOLDS_JSON (props) ⊕ config_override (request). */
function loadConfig_(props, override) {
  var base = reconMergeConfig(null);
  var pj = props.getProperty('THRESHOLDS_JSON');
  if (pj) { try { base = reconMergeConfig(JSON.parse(pj)); } catch (e) {} }
  if (override && typeof override === 'object') {
    if (override.abs_tolerance_vnd != null) base.amount.abs_tolerance_vnd = override.abs_tolerance_vnd;
    if (override.rel_tolerance != null) base.amount.rel_tolerance = override.rel_tolerance;
  }
  return base;
}

/** verifyFn cho reconcileBatch: gọi Dify nếu có cấu hình, else stub nội bộ (không AI). */
function makeGasVerifier_(props) {
  var url = props.getProperty('DIFY_API_URL');
  var key = props.getProperty('DIFY_API_KEY');
  if (url && key) return function (pair) { return difyVerify_(url, key, pair); };
  return function (pair) { return gasStubVerify_(pair); };
}

/** Gọi Dify workflow, trả NGUYÊN object result (hoặc {error,...}). Dùng chung cho verify + debug. */
function difyVerifyRaw_(url, key, pair) {
  var res = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/workflows/run', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      inputs: {
        request_id: pair.request_id || 'BM-RECON',
        invoice_beneficiary_name: pair.invoice_beneficiary_name || '',
        payment_beneficiary_name: pair.payment_beneficiary_name || '',
        invoice_account_number: pair.invoice_account_number || '',
        payment_account_number: pair.payment_account_number || '',
      },
      response_mode: 'blocking', user: pair.request_id || 'BM-RECON',
    }),
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) return { error: 'DIFY_HTTP_' + code, body: res.getContentText().slice(0, 400) };
  var data = JSON.parse(res.getContentText());
  var r = data && data.data && data.data.outputs && data.data.outputs.result;
  if (!r) return { error: 'DIFY_NO_RESULT', raw: data };
  return r;
}

function difyVerify_(url, key, pair) {
  var r = difyVerifyRaw_(url, key, pair);
  if (r.error) return { decision: 'REVIEW', reason_codes: [r.error], source: 'DIFY_ERROR' };
  var uw = r.user_warning || {};
  // Passthrough nhãn AI để quan sát nhánh LLM (Recon bỏ qua field thừa — vô hại parity).
  return {
    decision: r.decision, reason_codes: r.reason_codes || [], source: 'DIFY_V2',
    ai_status: uw.ai_status || 'NOT_INVOKED', generated_by_ai: !!uw.generated_by_ai,
  };
}

/** Stub nội bộ (deterministic, không AI) — khi chưa cấu hình Dify. Dùng logic Recon.gs. */
function gasStubVerify_(pair) {
  var invN = reconNormalizeName(pair.invoice_beneficiary_name);
  var payN = reconNormalizeName(pair.payment_beneficiary_name);
  if (!invN || !payN) return { decision: 'REVIEW', reason_codes: ['INSUFFICIENT_DATA'], source: 'STUB_GAS' };
  var fam = function (s) {
    if (/\bTNHH\b/.test(s)) return 'TNHH';
    if (/\bCONG TY CO PHAN\b/.test(s)) return 'CO_PHAN';
    if (/\bDOANH NGHIEP TU NHAN\b/.test(s)) return 'DNTN';
    if (/\bHOP TAC XA\b/.test(s)) return 'HTX';
    return 'UNKNOWN';
  };
  var fi = fam(invN), fp = fam(payN);
  if (fi !== 'UNKNOWN' && fp !== 'UNKNOWN' && fi !== fp) return { decision: 'NOT_MATCH', reason_codes: ['LEGAL_ENTITY_TYPE_CONFLICT'], source: 'STUB_GAS' };
  if (invN === payN) return { decision: 'MATCH', reason_codes: ['NORMALIZED_NAME_EXACT_MATCH'], source: 'STUB_GAS' };
  var a = reconExtractCoreName(invN).split(' ').filter(Boolean), b = reconExtractCoreName(payN).split(' ').filter(Boolean);
  if (a.join(' ') === b.join(' ')) return { decision: 'MATCH', reason_codes: ['LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH'], source: 'STUB_GAS' };
  var setA = {}, inter = 0; a.forEach(function (t) { setA[t] = 1; }); b.forEach(function (t) { if (setA[t]) inter++; });
  var uni = a.length + b.length - inter; var sim = uni ? inter / uni : 1;
  return sim >= 0.6 ? { decision: 'REVIEW', reason_codes: ['NAME_SIMILAR_BUT_NOT_CONCLUSIVE'], source: 'STUB_GAS' }
                    : { decision: 'NOT_MATCH', reason_codes: ['LOW_NAME_SIMILARITY'], source: 'STUB_GAS' };
}

/** Log 1 dòng/lô vào Sheet. */
function logBatch_(props, result) {
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) return;
  var name = props.getProperty('LOG_SHEET_NAME') || 'recon_log';
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(['timestamp', 'batch_id', 'decision', 'action', 'risk', 'grand_inv', 'grand_ct', 'grand_diff', 'groups', 'warnings', 'verify_source', 'warnings_json']);
  var s = result.summary;
  sh.appendRow([new Date(), result.batch_id, s.decision, s.action, s.risk_level, s.grand_total_invoices, s.grand_total_transfers, s.grand_diff, s.group_count, s.warning_count, result.audit.name_verify_source, JSON.stringify(result.warnings).slice(0, 45000)]);
}

/** Tạo sheet config mẫu (chạy 1 lần từ editor, no-overwrite). */
function setupConfigSheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('Chưa đặt SHEET_ID trong Script Properties');
  var ss = SpreadsheetApp.openById(sheetId);
  if (ss.getSheetByName('config')) return 'config đã tồn tại';
  var sh = ss.insertSheet('config');
  sh.appendRow(['key', 'value', 'ghi_chú']);
  sh.appendRow(['abs_tolerance_vnd', 1000, 'Lệch tuyệt đối bỏ qua (VND)']);
  sh.appendRow(['rel_tolerance', 0.001, 'Hoặc 0.1% tổng nhóm; lấy max']);
  sh.appendRow(['ocr_min_confidence', 0.85, 'Dưới ngưỡng → cờ POSSIBLE_OCR_ERROR']);
  return 'đã tạo config';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
