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
 *   AI_MODEL             mặc định "gemini-3.5-flash-lite" (gemini — [TT] chốt 08/10: 3.8 Flash quá tải liên tục); BẮT BUỘC với openai_compat
 *   AI_MODEL_FALLBACKS   model dự phòng khi model chính quá tải (cách nhau dấu phẩy). Gemini mặc định
 *                        "gemini-3.5-flash"; đặt rỗng = tắt. ⚠ Không thêm model hay treo lâu (vd 3.8 Flash miễn phí). Xem model key dùng được: hàm danhSachModel
 *   AI_BASE_URL          gemini: mặc định https://generativelanguage.googleapis.com/v1beta
 *                        openai_compat: BẮT BUỘC, vd https://<cổng-AI-nội-bộ>/v1 (tự nối /chat/completions)
 *   AI_THINKING_LEVEL    (gemini, tùy chọn) minimal | low | medium | high cho mọi model — trống = mức thấp nhất từng model (GEMINI_THINKING_DEFAULT)
 *   AI_RESPONSE_FORMAT   (openai_compat) json_schema (mặc định) | json_object | none — tùy model nội bộ hỗ trợ
 *   AI_AUTH_HEADER       (openai_compat) mặc định "Authorization" (gửi "Bearer <key>"); tên khác (vd "api-key") → gửi key thô
 *   AI_EXTRA_HEADERS     JSON header bổ sung (vd mã ứng dụng cổng API nội bộ)
 *   AI_ALLOW_REAL_DATA   "true" = cho phép tên KH thật. MẶC ĐỊNH TẮT: Gemini gói miễn phí → chỉ tên giả lập/đã ẩn danh
 *                        (request phải kèm data_attest:"ANONYMIZED"). Bật khi dùng AI nội bộ TPB hoặc key trả phí.
 *   AI_TIME_BUDGET_MS    ngân sách thời gian gọi AI mỗi lô (mặc định 8000) — quá tải thì chuyển model ngay, hết giờ → FALLBACK
 *   ACCESS_CODES (JSON {"mã":"nhãn"}, tạo bằng taoMaTruyCap) · ADVISOR_DAILY_LIMIT (200) · ADVISOR_MAX_PAIRS (10)
 * Script Properties — khác (tùy chọn):
 *   SHEET_ID, LOG_SHEET_NAME — log 1 dòng/hồ sơ (KHÔNG ghi tên/STK — chỉ kết luận & số lượng) · THRESHOLDS_JSON
 *
 * API (POST JSON):
 *   { action:"advise_names", access_code, data_attest?, pairs:[{ invoice_name, payment_name }] }
 *   { action:"reconcile", case:{...}, invoices:[...], transfers:[...] | transfer_orders_csv:"..." }   (OCR làm ở máy, không nhận file)
 *   { action:"verify_name", pair:{ invoice_beneficiary_name, payment_beneficiary_name } }
 */

var GEMINI_BASE_DEFAULT = 'https://generativelanguage.googleapis.com/v1beta';
// [TT] chốt 08/10: chính = 3.5 Flash-Lite (Google khuyến nghị cho dự án mới; test LIVE 18–20/22, CÙNG sai 0).
// Dự phòng = 3.5 Flash (đo LIVE 08/10: 3 ca / 6,2 giây). KHÔNG dùng với key miễn phí: 3.8 Flash (giữ request tới 235 giây
// rồi mới trả 503 — GAS không đặt được timeout) · 3.6 Flash (429 hết hạn mức) · 3.1 Flash-Lite (chạy được nhưng ~15 giây).
var GEMINI_MODEL_DEFAULT = 'gemini-3.5-flash-lite';
var GEMINI_FALLBACKS_DEFAULT = 'gemini-3.5-flash';
// Mức suy nghĩ thấp nhất mỗi model hỗ trợ (bảng thinking của Google 10/2026) — để trả lời nhanh. 3.5 Flash-Lite mặc định đã là minimal.
// AI_THINKING_LEVEL (Script Property) ghi đè cho mọi model.
var GEMINI_THINKING_DEFAULT = { 'gemini-3.6-flash': 'minimal', 'gemini-3.5-flash': 'minimal', 'gemini-3.7-flash': 'low', 'gemini-3.8-flash': 'low' };
// Mục tiêu [TT] 08/10: cán bộ nhận ý kiến AI < 10 giây/lô (GAS + mạng ~1–2 giây) → ngân sách gọi AI 8 giây.
var AI_TIME_BUDGET_DEFAULT = 8000;
var AI_MIN_CALL_MS = 2500;   // còn ít hơn mức này thì không gọi thêm lượt nữa

function doGet() {
  var p = PropertiesService.getScriptProperties();
  var ai = aiConfig_(p);
  return jsonOut_({ ok: true, service: 'BeneMatch', engine: BM.ENGINE_VERSION, mode: 'case-reconcile',
    advisor: { configured: !ai.error, provider: ai.provider, model: ai.model, fallbacks: ai.fallbacks, allow_real_data: ai.allowRealData, prompt_version: BM.advisor.PROMPT_VERSION },
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
  var run = runAi_(ai, todo, ai.budgetMs);
  var counts = {};
  todo.forEach(function (x) {
    counts[x.advice.ai_status + ':' + x.advice.verdict] = (counts[x.advice.ai_status + ':' + x.advice.verdict] || 0) + 1;
  });
  if (run.retried) counts.retried = run.retried;
  if (run.fallback) counts.fallback_model = run.fallback;
  if (run.timedOut) counts.timed_out = run.timedOut;
  try { logAdvisor_(props, label, ai, items.length, todo.length, counts, run.tokIn, run.tokOut, Date.now() - t0); } catch (e) {}

  return {
    advices: items.map(function (x) {
      return { key: BM.advisor.key(x.nc), eligible: x.eligible, advice: x.advice || null,
        engine: { decision: x.nc.decision, reason_code: x.nc.reason_code, score_pct: x.nc.score_pct } };
    }),
    quota: { used: used + todo.length, limit: daily }, ms: Date.now() - t0, engine: BM.ENGINE_VERSION,
    ai: { provider: ai.provider, model: ai.model, allow_real_data: ai.allowRealData, prompt_version: BM.advisor.PROMPT_VERSION },
  };
}

/**
 * Gọi AI cho danh sách ca { nc } (song song) trong NGÂN SÁCH THỜI GIAN (AI_TIME_BUDGET_MS, mặc định 8 giây — mục tiêu
 * [TT] 08/10: phản hồi < 10 giây cho cán bộ). Lỗi TẠM THỜI (503 quá tải / 429 / 5xx) → chuyển NGAY sang model kế tiếp
 * (không ngủ chờ): chính → dự phòng 1 → dự phòng 2 → (còn thời gian) vòng 2. Hết ngân sách → FALLBACK (kết luận không đổi).
 * Gán x.raw, x.diag, x.model, x.advice.
 */
function runAi_(ai, todo, budgetMs) {
  var t0 = Date.now(), models = [ai.model].concat(ai.fallbacks), plan = models.concat(models);
  var pending = todo.slice(), retried = 0, fallback = 0, timedOut = 0, tokIn = 0, tokOut = 0;
  for (var k = 0; k < plan.length && pending.length; k++) {
    if (k > 0) {
      var left = budgetMs - (Date.now() - t0);
      if (left < AI_MIN_CALL_MS) { timedOut = pending.length; break; }   // không đủ thời gian cho 1 lượt nữa
      if (k < models.length) fallback += pending.length; else retried += pending.length;
    }
    var model = plan[k];
    var resps = UrlFetchApp.fetchAll(pending.map(function (x) { return aiRequest_(ai, BM.advisor.prompt(BM.advisor.payload(x.nc)), model); }));
    var again = [];
    pending.forEach(function (x, i) {
      var p = aiParse_(ai, resps[i]);
      x.raw = p.raw; x.diag = p.diag; x.model = model;
      tokIn += p.usage.in; tokOut += p.usage.out;
      if (!p.raw && p.transient) again.push(x);
    });
    pending = again;
  }
  todo.forEach(function (x) {
    var label = ai.provider + ':' + (x.model || ai.model);
    if (x.raw) x.raw.model = label;
    x.advice = BM.advisor.guard(x.raw, x.nc);
    if (!x.raw) x.advice.model = label;
    if (x.diag) x.advice.diag = x.diag;
  });
  return { retried: retried, fallback: fallback, timedOut: timedOut, tokIn: tokIn, tokOut: tokOut, ms: Date.now() - t0 };
}

/** Cấu hình nhà cung cấp AI từ Script Properties → { provider, model, base, key, …, error? }. */
function aiConfig_(props) {
  var provider = String(props.getProperty('AI_PROVIDER') || 'gemini').trim().toLowerCase();
  var c = {
    provider: provider,
    key: props.getProperty('AI_API_KEY') || '',
    model: props.getProperty('AI_MODEL') || (provider === 'gemini' ? GEMINI_MODEL_DEFAULT : ''),
    fallbacks: String(props.getProperty('AI_MODEL_FALLBACKS') != null ? props.getProperty('AI_MODEL_FALLBACKS') : (provider === 'gemini' ? GEMINI_FALLBACKS_DEFAULT : ''))
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    base: String(props.getProperty('AI_BASE_URL') || (provider === 'gemini' ? GEMINI_BASE_DEFAULT : '')).replace(/\/+$/, ''),
    thinking: props.getProperty('AI_THINKING_LEVEL') || '',
    budgetMs: Number(props.getProperty('AI_TIME_BUDGET_MS') || AI_TIME_BUDGET_DEFAULT),
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
function aiRequest_(ai, pr, model) {
  model = model || ai.model;
  var headers = {};
  Object.keys(ai.extraHeaders).forEach(function (k) { headers[k] = String(ai.extraHeaders[k]); });
  if (ai.provider === 'gemini') {
    headers['x-goog-api-key'] = ai.key;
    var gen = { responseMimeType: 'application/json', responseSchema: toGeminiSchema_(pr.schema) };
    var level = ai.thinking || GEMINI_THINKING_DEFAULT[model] || '';
    if (level) gen.thinkingConfig = { thinkingLevel: level };
    return {
      url: ai.base + '/models/' + encodeURIComponent(model) + ':generateContent',
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: headers,
      payload: JSON.stringify({ systemInstruction: { parts: [{ text: pr.system }] }, contents: [{ role: 'user', parts: [{ text: pr.user }] }], generationConfig: gen }),
    };
  }
  // openai_compat — chuẩn POST /chat/completions (vLLM, Ollama, LiteLLM, Azure OpenAI qua gateway…)
  headers[ai.authHeader] = ai.authHeader.toLowerCase() === 'authorization' ? 'Bearer ' + ai.key : ai.key;
  var body = { model: model, messages: [{ role: 'system', content: pr.system }, { role: 'user', content: pr.user }] };
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
  var x = { nc: BM.verifyName('CÔNG TY TNHH SAO VIỆT', 'VIETSTAR COMPANY LIMITED', BM.mergeConfig(null).name) };
  var run = runAi_(ai, [x], ai.budgetMs);   // cùng đường với cán bộ: quá tải → chuyển model, trong ngân sách thời gian
  Logger.log('Thứ tự model: ' + [ai.model].concat(ai.fallbacks).join(' → ') + ' · chuyển dự phòng ' + run.fallback + ' · vòng 2 ' + run.retried + ' · ' + run.ms + ' ms (ngân sách ' + ai.budgetMs + ')');
  Logger.log(x.advice.model + ' → ' + JSON.stringify(x.advice) + ' · token in/out ' + run.tokIn + '/' + run.tokOut);
  return x.advice;
}

/**
 * CHẠY TAY: liệt kê model mà key hiện tại được dùng (Gemini) — để chọn AI_MODEL / AI_MODEL_FALLBACKS.
 * Chỉ in model hỗ trợ generateContent, ưu tiên họ "flash".
 */
function danhSachModel() {
  var ai = aiConfig_(PropertiesService.getScriptProperties());
  if (ai.error) { Logger.log('Chưa cấu hình: ' + ai.error); return ai.error; }
  if (ai.provider !== 'gemini') { Logger.log('Chỉ hỗ trợ AI_PROVIDER=gemini (AI nội bộ: hỏi IT danh sách model).'); return []; }
  var names = [], token = '';
  do {
    var r = UrlFetchApp.fetch(ai.base + '/models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { 'x-goog-api-key': ai.key }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { Logger.log('HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300)); return []; }
    var d = JSON.parse(r.getContentText());
    (d.models || []).forEach(function (m) {
      if ((m.supportedGenerationMethods || []).indexOf('generateContent') >= 0) names.push(String(m.name).replace(/^models\//, ''));
    });
    token = d.nextPageToken || '';
  } while (token);
  var flash = names.filter(function (n) { return /flash/.test(n) && !/tts|image|audio|live/.test(n); });
  Logger.log('Model Flash dùng được (' + flash.length + '): ' + flash.join(', '));
  Logger.log('Đang cấu hình: ' + [ai.model].concat(ai.fallbacks).join(' → ') + ' — model không có trong danh sách trên sẽ báo 404.');
  return flash;
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
