/**
 * Code.gs — BeneMatch GAS gateway (Web App) — LOGIC + CỔNG AI.
 * Kiến trúc 3 lớp (08/10/2026, bỏ Dify):
 *   [Trình duyệt]  đọc XML/PDF/ảnh + OCR offline (tesseract nhúng) → engine ra kết luận — dữ liệu không rời máy.
 *   [GAS — file này]  mã truy cập + hạn mức · tự tính lại engine · chọn ca hỏi AI · prompt/schema (BM.advisor)
 *                     · ADAPTER gọi model · lớp gác · log không tên.  (+ API reconcile/verify_name cho tích hợp)
 *   [AI]  AI_PROVIDER = "gemini" (Gemini API, gọi trực tiếp) | "openai_compat" (AI nội bộ TPB — chuẩn /chat/completions).
 * Engine: gas/Engine.gs (SINH TỪ src/engine/bm-engine.js, không sửa tay) → globalThis.BM.
 * Hợp đồng tích hợp cho IT: AI_CONTEXT/AI_INTEGRATION_CONTRACT.md.
 *
 * Script Properties — AI:
 *   AI_PROVIDER          "gemini" (mặc định) | "openai_compat"
 *   AI_API_KEY           key của nhà cung cấp (Gemini: key AI Studio · nội bộ: token do IT cấp)
 *   AI_MODEL             mặc định "gemini-3.8-flash" (gemini); BẮT BUỘC với openai_compat
 *   AI_BASE_URL          gemini: mặc định https://generativelanguage.googleapis.com/v1beta
 *                        openai_compat: BẮT BUỘC, vd https://<cổng-AI-nội-bộ>/v1 (tự nối /chat/completions)
 *   AI_THINKING_LEVEL    (gemini, tùy chọn) low | medium | high — trống = mặc định của model
 *   AI_RESPONSE_FORMAT   (openai_compat) json_schema (mặc định) | json_object | none — tùy model nội bộ hỗ trợ
 *   AI_AUTH_HEADER       (openai_compat) mặc định "Authorization" (gửi "Bearer <key>"); tên khác (vd "api-key") → gửi key thô
 *   AI_EXTRA_HEADERS     JSON header bổ sung (vd mã ứng dụng cổng API nội bộ)
 *   AI_ALLOW_REAL_DATA   "true" = cho phép tên KH thật. MẶC ĐỊNH TẮT: Gemini gói miễn phí → chỉ tên giả lập/đã ẩn danh
 *                        (request phải kèm data_attest:"ANONYMIZED"). Bật khi dùng AI nội bộ TPB hoặc key trả phí.
 *   ACCESS_CODES (JSON {"mã":"nhãn"}, tạo bằng taoMaTruyCap) · ADVISOR_DAILY_LIMIT (200) · ADVISOR_MAX_PAIRS (10) · ADVISOR_RETRIES (2)
 * Script Properties — khác (tùy chọn):
 *   SHEET_ID, LOG_SHEET_NAME — log 1 dòng/hồ sơ (KHÔNG ghi tên/STK — chỉ kết luận & số lượng) · THRESHOLDS_JSON
 *
 * API (POST JSON):
 *   { action:"advise_names", access_code, data_attest?, pairs:[{ invoice_name, payment_name }] }
 *   { action:"reconcile", case:{...}, invoices:[...], transfers:[...] | transfer_orders_csv:"..." }   (OCR làm ở máy, không nhận file)
 *   { action:"verify_name", pair:{ invoice_beneficiary_name, payment_beneficiary_name } }
 */

var GEMINI_BASE_DEFAULT = 'https://generativelanguage.googleapis.com/v1beta';
var GEMINI_MODEL_DEFAULT = 'gemini-3.8-flash';

function doGet() {
  var p = PropertiesService.getScriptProperties();
  var ai = aiConfig_(p);
  return jsonOut_({ ok: true, service: 'BeneMatch', engine: BM.ENGINE_VERSION, mode: 'case-reconcile',
    advisor: { configured: !ai.error, provider: ai.provider, model: ai.model, allow_real_data: ai.allowRealData, prompt_version: BM.advisor.PROMPT_VERSION },
    access_codes: (function () { try { return Object.keys(JSON.parse(p.getProperty('ACCESS_CODES') || '{}')).length; } catch (e) { return 0; } })() });
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

// =====================================================================================
// AI TƯ VẤN — chỉ tham khảo, không đổi kết luận engine.
// =====================================================================================

/**
 * Request: { action:"advise_names", access_code, data_attest?, pairs:[{ invoice_name, payment_name }] }
 * - Mã truy cập + hạn mức/ngày (khóa chống vượt khi 2 request cùng lúc).
 * - Server TỰ TÍNH LẠI engine cho từng cặp (không tin client), chỉ hỏi AI ca đủ điều kiện, chỉ gửi tên + tóm tắt engine.
 * - Log chỉ ghi nhãn mã + số lượng + phân bố ý kiến + token (KHÔNG ghi tên).
 */
function handleAdviseNames_(payload) {
  var props = PropertiesService.getScriptProperties();
  var codes = {};
  try { codes = JSON.parse(props.getProperty('ACCESS_CODES') || '{}'); } catch (e) {}
  var code = String(payload.access_code || '').trim();
  if (!code || !Object.prototype.hasOwnProperty.call(codes, code)) return { error: 'ACCESS_DENIED', message: 'Mã truy cập không hợp lệ hoặc đã bị thu hồi.' };
  var label = String(codes[code]);
  var ai = aiConfig_(props);
  if (ai.error) return { error: 'ADVISOR_NOT_CONFIGURED', message: ai.error };
  if (!ai.allowRealData && payload.data_attest !== 'ANONYMIZED') {
    return { error: 'REAL_DATA_NOT_ALLOWED', message: 'Cổng AI đang ở chế độ thử (' + ai.provider + ' — gói miễn phí): chỉ nhận tên giả lập / đã ẩn danh. Cần xác nhận "tên đã ẩn danh" trước khi gửi.' };
  }

  var maxPairs = Number(props.getProperty('ADVISOR_MAX_PAIRS') || 10);
  var daily = Number(props.getProperty('ADVISOR_DAILY_LIMIT') || 200);
  var cfg = loadConfig_(props);
  var items = (Array.isArray(payload.pairs) ? payload.pairs : []).slice(0, maxPairs).map(function (p) {
    var nc = BM.verifyName(String(p.invoice_name || '').slice(0, 300), String(p.payment_name || '').slice(0, 300), cfg.name);
    return { nc: nc, eligible: BM.advisor.eligible(nc) };
  });
  var todo = items.filter(function (x) { return x.eligible; });

  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  var qKey = 'q:' + code + ':' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd');
  var used = Number(props.getProperty(qKey) || 0);
  if (used + todo.length > daily) { lock.releaseLock(); return { error: 'QUOTA_EXCEEDED', message: 'Vượt hạn mức ' + daily + ' cặp/ngày cho mã này.', used: used }; }
  props.setProperty(qKey, String(used + todo.length));
  lock.releaseLock();

  var t0 = Date.now();
  var mkReq = function (x) { return aiRequest_(ai, BM.advisor.prompt(BM.advisor.payload(x.nc))); };
  // Gọi song song; lỗi TẠM THỜI (quá tải 503 / hết lượt theo phút 429 / 5xx) gọi lại tối đa ADVISOR_RETRIES lần, chờ tăng dần.
  var retries = Number(props.getProperty('ADVISOR_RETRIES') || 2);
  var pending = todo.slice(), attempt = 0, retried = 0, tokIn = 0, tokOut = 0;
  while (pending.length) {
    var resps = UrlFetchApp.fetchAll(pending.map(mkReq));
    var again = [];
    pending.forEach(function (x, i) {
      var p = aiParse_(ai, resps[i]);
      x.raw = p.raw; x.diag = p.diag;
      tokIn += p.usage.in; tokOut += p.usage.out;
      if (!p.raw && p.transient && attempt < retries) again.push(x);
    });
    if (!again.length) break;
    attempt++; retried += again.length;
    Utilities.sleep(2500 * attempt);
    pending = again;
  }
  var counts = {};
  todo.forEach(function (x) {
    if (x.raw) x.raw.model = ai.provider + ':' + ai.model;
    x.advice = BM.advisor.guard(x.raw, x.nc);
    if (!x.raw) x.advice.model = ai.provider + ':' + ai.model;
    if (x.diag) x.advice.diag = x.diag;
    counts[x.advice.ai_status + ':' + x.advice.verdict] = (counts[x.advice.ai_status + ':' + x.advice.verdict] || 0) + 1;
  });
  if (retried) counts.retried = retried;
  try { logAdvisor_(props, label, ai, items.length, todo.length, counts, tokIn, tokOut, Date.now() - t0); } catch (e) {}

  return {
    advices: items.map(function (x) {
      return { key: BM.advisor.key(x.nc), eligible: x.eligible, advice: x.advice || null,
        engine: { decision: x.nc.decision, reason_code: x.nc.reason_code, score_pct: x.nc.score_pct } };
    }),
    quota: { used: used + todo.length, limit: daily }, ms: Date.now() - t0, engine: BM.ENGINE_VERSION,
    ai: { provider: ai.provider, model: ai.model, allow_real_data: ai.allowRealData, prompt_version: BM.advisor.PROMPT_VERSION },
  };
}

/** Cấu hình nhà cung cấp AI từ Script Properties → { provider, model, base, key, …, error? }. */
function aiConfig_(props) {
  var provider = String(props.getProperty('AI_PROVIDER') || 'gemini').trim().toLowerCase();
  var c = {
    provider: provider,
    key: props.getProperty('AI_API_KEY') || '',
    model: props.getProperty('AI_MODEL') || (provider === 'gemini' ? GEMINI_MODEL_DEFAULT : ''),
    base: String(props.getProperty('AI_BASE_URL') || (provider === 'gemini' ? GEMINI_BASE_DEFAULT : '')).replace(/\/+$/, ''),
    thinking: props.getProperty('AI_THINKING_LEVEL') || '',
    responseFormat: String(props.getProperty('AI_RESPONSE_FORMAT') || 'json_schema').toLowerCase(),
    authHeader: props.getProperty('AI_AUTH_HEADER') || 'Authorization',
    extraHeaders: {},
    allowRealData: String(props.getProperty('AI_ALLOW_REAL_DATA') || 'false').toLowerCase() === 'true',
  };
  try { c.extraHeaders = JSON.parse(props.getProperty('AI_EXTRA_HEADERS') || '{}') || {}; } catch (e) { c.error = 'AI_EXTRA_HEADERS không phải JSON hợp lệ.'; }
  if (provider !== 'gemini' && provider !== 'openai_compat') c.error = 'AI_PROVIDER không hỗ trợ: ' + provider + ' (gemini | openai_compat).';
  else if (!c.key) c.error = 'Chưa cấu hình AI_API_KEY.';
  else if (!c.model) c.error = 'Chưa cấu hình AI_MODEL.';
  else if (!c.base) c.error = 'Chưa cấu hình AI_BASE_URL.';
  return c;
}

/** Dựng request UrlFetchApp cho 1 prompt { system, user, schema }. */
function aiRequest_(ai, pr) {
  var headers = {};
  Object.keys(ai.extraHeaders).forEach(function (k) { headers[k] = String(ai.extraHeaders[k]); });
  if (ai.provider === 'gemini') {
    headers['x-goog-api-key'] = ai.key;
    var gen = { responseMimeType: 'application/json', responseSchema: toGeminiSchema_(pr.schema) };
    if (ai.thinking) gen.thinkingConfig = { thinkingLevel: ai.thinking };
    return {
      url: ai.base + '/models/' + encodeURIComponent(ai.model) + ':generateContent',
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: headers,
      payload: JSON.stringify({ systemInstruction: { parts: [{ text: pr.system }] }, contents: [{ role: 'user', parts: [{ text: pr.user }] }], generationConfig: gen }),
    };
  }
  // openai_compat — chuẩn POST /chat/completions (vLLM, Ollama, LiteLLM, Azure OpenAI qua gateway…)
  headers[ai.authHeader] = ai.authHeader.toLowerCase() === 'authorization' ? 'Bearer ' + ai.key : ai.key;
  var body = { model: ai.model, messages: [{ role: 'system', content: pr.system }, { role: 'user', content: pr.user }] };
  if (ai.responseFormat === 'json_schema') body.response_format = { type: 'json_schema', json_schema: { name: 'benematch_advice', strict: true, schema: pr.schema } };
  else if (ai.responseFormat === 'json_object') body.response_format = { type: 'json_object' };
  return {
    url: /\/chat\/completions$/.test(ai.base) ? ai.base : ai.base + '/chat/completions',
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: headers, payload: JSON.stringify(body),
  };
}

/** JSON Schema chuẩn → schema OpenAPI của Gemini (kiểu viết HOA, bỏ additionalProperties). */
function toGeminiSchema_(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema_);
  if (!s || typeof s !== 'object') return s;
  var o = {};
  Object.keys(s).forEach(function (k) {
    if (k === 'additionalProperties') return;
    if (k === 'type') o.type = String(s.type).toUpperCase();
    else if (k === 'properties') { o.properties = {}; Object.keys(s.properties).forEach(function (p) { o.properties[p] = toGeminiSchema_(s.properties[p]); }); }
    else if (k === 'items') o.items = toGeminiSchema_(s.items);
    else o[k] = s[k];
  });
  return o;
}

/**
 * Đọc 1 response → { raw (object | null), diag (chẩn đoán, không tên), transient (nên gọi lại), usage {in,out} }.
 */
function aiParse_(ai, r) {
  var TRANSIENT = /\b(503|429|500|502|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|rate limit|timeout|timed out/i;
  var usage = { in: 0, out: 0 };
  try {
    var http = r.getResponseCode(), body = r.getContentText(), d = null;
    try { d = JSON.parse(body); } catch (e) {}
    if (http >= 200 && http < 300 && d) {
      var text = '', why = '';
      if (ai.provider === 'gemini') {
        var cand = d.candidates && d.candidates[0];
        text = cand && cand.content && cand.content.parts ? cand.content.parts.filter(function (p) { return !p.thought && p.text; }).map(function (p) { return p.text; }).join('') : '';
        why = (d.promptFeedback && d.promptFeedback.blockReason) || (cand && cand.finishReason) || '';
        if (d.usageMetadata) { usage.in = Number(d.usageMetadata.promptTokenCount || 0); usage.out = Number(d.usageMetadata.candidatesTokenCount || 0) + Number(d.usageMetadata.thoughtsTokenCount || 0); }
      } else {
        var ch = d.choices && d.choices[0];
        text = ch && ch.message ? (typeof ch.message.content === 'string' ? ch.message.content : JSON.stringify(ch.message.content || '')) : '';
        why = (ch && ch.finish_reason) || '';
        if (d.usage) { usage.in = Number(d.usage.prompt_tokens || 0); usage.out = Number(d.usage.completion_tokens || 0); }
      }
      var raw = BM.advisor.parse(text);
      if (raw) return { raw: raw, diag: null, transient: false, usage: usage };
      return { raw: null, transient: false, usage: usage, diag: { http: http, finish: String(why).slice(0, 60), error: 'Output không đúng JSON schema (' + String(text).length + ' ký tự)' } };
    }
    var err = (d && (d.error || d)) || {};
    var msg = String(err.message || err.status || body || '').slice(0, 300);
    return { raw: null, transient: http === 429 || http >= 500 || TRANSIENT.test(msg), usage: usage, diag: { http: http, code: String(err.status || err.code || ''), error: msg } };
  } catch (e) {
    return { raw: null, transient: true, usage: usage, diag: { error: String(e && e.message || e).slice(0, 300) } };
  }
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

/**
 * CHẠY TAY 1 lần sau khi đặt AI_API_KEY: gọi model với 1 cặp tên GIẢ LẬP, in kết quả ở Execution log.
 * Dùng để kiểm key/model trước khi mở cho cán bộ (không cần mã truy cập, không trừ hạn mức).
 */
function kiemTraAI() {
  var ai = aiConfig_(PropertiesService.getScriptProperties());
  if (ai.error) { Logger.log('Chưa cấu hình: ' + ai.error); return ai.error; }
  var nc = BM.verifyName('CÔNG TY TNHH SAO VIỆT', 'VIETSTAR COMPANY LIMITED', BM.mergeConfig(null).name);
  var req = aiRequest_(ai, BM.advisor.prompt(BM.advisor.payload(nc)));
  var p = aiParse_(ai, UrlFetchApp.fetch(req.url, req));
  var out = p.raw ? BM.advisor.guard(p.raw, nc) : p.diag;
  Logger.log(ai.provider + ':' + ai.model + ' → ' + JSON.stringify(out) + ' · token in/out ' + p.usage.in + '/' + p.usage.out);
  return out;
}

/** Log AI tư vấn — KHÔNG ghi tên/STK: nhãn mã, nhà cung cấp, số cặp, phân bố ý kiến, token, thời gian. */
function logAdvisor_(props, label, ai, nReq, nAsked, counts, tokIn, tokOut, ms) {
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) return;
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName('ai_log') || ss.insertSheet('ai_log');
  if (sh.getLastRow() === 0) sh.appendRow(['timestamp', 'access_label', 'provider', 'model', 'pairs_requested', 'pairs_asked_ai', 'verdict_counts', 'tokens_in', 'tokens_out', 'ms', 'engine', 'prompt_version']);
  sh.appendRow([new Date(), label, ai.provider, ai.model, nReq, nAsked, JSON.stringify(counts), tokIn, tokOut, ms, BM.ENGINE_VERSION, BM.advisor.PROMPT_VERSION]);
}

// =====================================================================================
// ĐỐI CHIẾU (API cho tích hợp) — engine giống hệt công cụ trình duyệt.
// =====================================================================================

function handleVerifyName_(payload) {
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props);
  var pair = payload.pair || {};
  return BM.verifyName(pair.invoice_beneficiary_name || '', pair.payment_beneficiary_name || '', cfg.name);
}

function handleReconcile_(payload) {
  if (Array.isArray(payload.files) && payload.files.length) {
    return { error: 'OCR_LOCAL_ONLY', message: 'GAS không nhận file hóa đơn: OCR chạy tại máy (công cụ trình duyệt) hoặc hệ thống nguồn (BIZ). Gửi invoices đã bóc trường.' };
  }
  var props = PropertiesService.getScriptProperties();
  var cfg = loadConfig_(props, payload.config_override);
  var invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
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
