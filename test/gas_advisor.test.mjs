/**
 * gas_advisor.test.mjs — kiểm cổng GAS "advise_names" + adapter AI (gemini | openai_compat), không gọi AI thật.
 * Chạy: node test/gas_advisor.test.mjs
 */
import { makeGas, fakeLlm } from './gas_harness.mjs';

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; if (!ok || process.env.VERBOSE) console.log((ok ? '  ✓ ' : '  ✗ ') + n + (d ? '  — ' + d : '')); };
const CODES = JSON.stringify({ 'BM-7Q2X': 'Team Số hóa' });
const PROPS = { AI_API_KEY: 'AIza-test', ACCESS_CODES: CODES, ADVISOR_DAILY_LIMIT: '5', SHEET_ID: 'sheet' };   // gemini mặc định, chế độ thử
const ANON = 'ANONYMIZED';

const pairs = [
  { invoice_name: 'CÔNG TY TNHH THƯƠNG MẠI HOÀNG GIA', payment_name: 'HOANG GIA TRADING CO., LTD', amount: 50000000, account_number: '0111222333' },
  { invoice_name: 'CÔNG TY TNHH ABC VIỆT NAM', payment_name: 'CTY TNHH ABC VN' },                         // MATCH → không hỏi AI
  { invoice_name: 'CÔNG TY CỔ PHẦN DELTA MEKONG', payment_name: 'CÔNG TY TNHH DELTA MEKONG' },           // khác loại hình → không hỏi AI
  { invoice_name: 'TỔNG CÔNG TY CỔ PHẦN ĐIỆN LỰC AN BÌNH', payment_name: 'CONG TY CO PHAN DIEN LUC AN BINH' },
  { invoice_name: 'CÔNG TY TNHH THƯƠNG MẠI MINH ANH', payment_name: 'NGUYEN THI MINH ANH' },
];

console.log('\n[GAS] advise_names — Gemini (mặc định)');
let g = makeGas({ props: PROPS, aiResponder: fakeLlm });
const info = JSON.parse(g.ctx.doGet().text);
check('doGet: gemini/gemini-3.8-flash, đã cấu hình, CHƯA cho dữ liệu thật', info.advisor.configured && info.advisor.provider === 'gemini' && info.advisor.model === 'gemini-3.8-flash' && info.advisor.allow_real_data === false && info.engine === '3.2.0', JSON.stringify(info.advisor));
check('Sai mã → ACCESS_DENIED', g.post({ action: 'advise_names', access_code: 'SAI', data_attest: ANON, pairs: [{ invoice_name: 'A', payment_name: 'B' }] }).error === 'ACCESS_DENIED');
check('Không mã → ACCESS_DENIED', g.post({ action: 'advise_names', pairs: [] }).error === 'ACCESS_DENIED');
const rNo = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs });
check('Chế độ thử + không xác nhận ẩn danh → REAL_DATA_NOT_ALLOWED, không gọi AI, không trừ hạn mức', rNo.error === 'REAL_DATA_NOT_ALLOWED' && g.aiCalls.length === 0 && !g.store['q:BM-7Q2X:' + new Date().toISOString().slice(0, 10).replace(/-/g, '')], rNo.error);

const r = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs });
check('Trả 5 kết quả, 3 được hỏi AI', r.advices.length === 5 && r.advices.filter((x) => x.eligible).length === 3, JSON.stringify(r.advices.map((x) => x.eligible)));
check('AI chỉ bị gọi 3 lần', g.aiCalls.length === 3, String(g.aiCalls.length));
const c0 = g.aiCalls[0];
check('Gọi đúng endpoint Gemini generateContent + header x-goog-api-key', c0.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent' && c0.headers['x-goog-api-key'] === 'AIza-test', c0.url);
const gc = c0.body.generationConfig;
check('Gemini: JSON mode + schema dạng Gemini (TYPE viết hoa, không additionalProperties)', gc.responseMimeType === 'application/json' && gc.responseSchema.type === 'OBJECT' && gc.responseSchema.properties.verdict.type === 'STRING' && !('additionalProperties' in gc.responseSchema) && gc.responseSchema.properties.evidence.items.type === 'STRING');
check('Gemini: không đặt thinkingConfig khi chưa cấu hình', !gc.thinkingConfig);
check('System prompt = BM.advisor.SYSTEM_PROMPT (nguồn duy nhất)', c0.prompt.system === g.ctx.BM.advisor.SYSTEM_PROMPT);
const sent = JSON.stringify(g.aiCalls.map((c) => c.body));
check('Payload gửi AI KHÔNG có số tiền/STK', !/50000000|0111222333/.test(sent));
check('Prompt do server tự tính (có mã luật engine)', g.aiCalls.every((c) => /— mã [A-Z_]+ —/.test(c.prompt.user)));
check('Bỏ phần "thought" của Gemini khi đọc output', r.advices[0].advice.ai_status === 'OK' && r.advices[0].advice.verdict === 'SAME_ENTITY');
check('Gác: LLM nói CÙNG cho Tổng cty ↔ cty → RELATED', r.advices[3].advice.verdict === 'RELATED_ENTITY', r.advices[3].advice.verdict);
check('Ý kiến AI không dùng cho quyết định + ghi model', r.advices.filter((x) => x.advice).every((x) => x.advice.used_for_decision === false && x.advice.model === 'gemini:gemini-3.8-flash'));
check('Kết luận engine giữ nguyên trong response', r.advices[0].engine.decision === 'REVIEW');
check('Response báo nhà cung cấp + chế độ', r.ai.provider === 'gemini' && r.ai.allow_real_data === false && r.ai.prompt_version);
check('Hạn mức đã trừ 3/5', r.quota.used === 3 && r.quota.limit === 5);
const lr = g.logRows;
check('Log ai_log: không chứa tên, có provider + token', lr.length === 2 && !/HOANG|DELTA|MINH|ABC/.test(JSON.stringify(lr)) && lr[1][2] === 'gemini' && lr[1][7] === 2700 && lr[1][8] === 1260, JSON.stringify(lr[1]));
const r2 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1).concat(pairs.slice(3)) });
check('Vượt hạn mức ngày → QUOTA_EXCEEDED', r2.error === 'QUOTA_EXCEEDED', JSON.stringify(r2));

g = makeGas({ props: Object.assign({}, PROPS, { AI_THINKING_LEVEL: 'low', AI_MODEL: 'gemini-3.8-flash-lite' }), aiResponder: fakeLlm });
g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Gemini: AI_MODEL + AI_THINKING_LEVEL được áp', /gemini-3\.8-flash-lite:generateContent$/.test(g.aiCalls[0].url) && g.aiCalls[0].body.generationConfig.thinkingConfig.thinkingLevel === 'low');

g = makeGas({ props: PROPS, aiResponder: () => ({ __text: 'Đây là kết quả:\n```json\n{"verdict":"UNCERTAIN","relation":"UNKNOWN","confidence":0.3,"evidence":[],"explanation":"x","checks_for_officer":[]}\n```' }) });
const rt = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Model trả JSON kèm chữ thừa/```json → vẫn đọc được', rt.advices[0].advice.ai_status === 'OK' && rt.advices[0].advice.verdict === 'UNCERTAIN');
g = makeGas({ props: PROPS, aiResponder: () => ({ __text: 'Xin lỗi, tôi không thể trả lời.' }) });
const rbad = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Output không phải JSON → FALLBACK/UNCERTAIN, không gọi lại', rbad.advices[0].advice.ai_status === 'FALLBACK' && rbad.advices[0].advice.verdict === 'UNCERTAIN' && g.aiCalls.length === 1 && /schema/.test(rbad.advices[0].advice.diag.error));

g = makeGas({ props: PROPS, aiResponder: () => null });
const r3 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Key sai (400) → FALLBACK/UNCERTAIN, không gọi lại, có diag', r3.advices[0].advice.ai_status === 'FALLBACK' && g.aiCalls.length === 1 && r3.advices[0].advice.diag.http === 400);

let n429 = 0;
g = makeGas({ props: PROPS, aiResponder: (nm) => (n429++ < 1 ? { __http: 429, __status: 'RESOURCE_EXHAUSTED', __msg: 'Quota exceeded for metric generate_content_free_tier_requests' } : fakeLlm(nm)) });
const r429 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('429 hết lượt/phút (free tier) → tự gọi lại → OK', r429.advices[0].advice.ai_status === 'OK' && g.aiCalls.length === 2);
g = makeGas({ props: Object.assign({}, PROPS, { AI_MODEL_FALLBACKS: '' }), aiResponder: () => ({ __http: 503, __status: 'UNAVAILABLE', __msg: 'The model is overloaded.' }) });
const r503 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('503 kéo dài, tắt dự phòng → 3 lần gọi rồi FALLBACK + diag', g.aiCalls.length === 3 && r503.advices[0].advice.ai_status === 'FALLBACK' && r503.advices[0].advice.diag.http === 503);

console.log('\n[GAS] model dự phòng khi quá tải (503 high demand)');
const busy = (nm, n, call) => (/gemini-3\.8-flash:/.test(call.url) ? { __http: 503, __status: 'UNAVAILABLE', __msg: 'This model is currently experiencing high demand.' } : fakeLlm(nm));
g = makeGas({ props: PROPS, aiResponder: busy });
check('doGet báo thứ tự dự phòng mặc định', JSON.stringify(JSON.parse(g.ctx.doGet().text).advisor.fallbacks) === '["gemini-3.5-flash-lite","gemini-3.6-flash"]');
const rfb = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs });
const urls = g.aiCalls.map((c) => c.url.replace(/.*models\/|:generateContent/g, ''));
check('3.8 quá tải → gọi lại 2 lần → chuyển 3.5-flash-lite → OK', rfb.advices.filter((x) => x.advice).every((x) => x.advice.ai_status === 'OK' && x.advice.model === 'gemini:gemini-3.5-flash-lite') && urls.filter((u) => u === 'gemini-3.8-flash').length === 9 && urls.filter((u) => u === 'gemini-3.5-flash-lite').length === 3, urls.join(','));
check('Không đụng model dự phòng thứ 2 khi dự phòng 1 đã OK', !urls.includes('gemini-3.6-flash'));
check('Log ghi số ca chuyển dự phòng', /fallback_model/.test(String(g.logRows[1][6])), String(g.logRows[1][6]));
g = makeGas({ props: Object.assign({}, PROPS, { AI_MODEL_FALLBACKS: 'gemini-3.6-flash' }), aiResponder: () => ({ __http: 503, __msg: 'high demand' }) });
const rall = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Mọi model đều quá tải → 3+3 lần gọi rồi FALLBACK (kết luận không đổi)', g.aiCalls.length === 6 && rall.advices[0].advice.ai_status === 'FALLBACK' && rall.advices[0].advice.model === 'gemini:gemini-3.6-flash' && rall.advices[0].engine.decision === 'REVIEW');
g = makeGas({ props: PROPS, aiResponder: () => null });
g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs: pairs.slice(0, 1) });
check('Lỗi không tạm thời (400 key sai) → KHÔNG chuyển dự phòng', g.aiCalls.length === 1);
g = makeGas({ props: PROPS, aiResponder: busy });
const kt2 = g.ctx.kiemTraAI();
check('kiemTraAI dùng cùng đường dự phòng', kt2.ai_status === 'OK' && kt2.model === 'gemini:gemini-3.5-flash-lite');

console.log('\n[GAS] advise_names — AI nội bộ (openai_compat)');
const TPB = { AI_PROVIDER: 'openai_compat', AI_BASE_URL: 'https://ai-gw.tpb.local/v1/', AI_MODEL: 'tpb-llm-70b', AI_API_KEY: 'tok-123', AI_ALLOW_REAL_DATA: 'true', ACCESS_CODES: CODES };
g = makeGas({ props: TPB, aiResponder: fakeLlm });
const rT = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs });
const t0 = g.aiCalls[0];
check('Bật dữ liệu thật → không cần xác nhận ẩn danh', !rT.error && rT.ai.allow_real_data === true);
check('Gọi /chat/completions + Bearer token', t0.url === 'https://ai-gw.tpb.local/v1/chat/completions' && t0.headers.Authorization === 'Bearer tok-123', t0.url);
check('Body: model + system/user + response_format json_schema strict', t0.body.model === 'tpb-llm-70b' && t0.body.messages[0].role === 'system' && t0.body.response_format.type === 'json_schema' && t0.body.response_format.json_schema.strict === true && t0.body.response_format.json_schema.schema.additionalProperties === false);
check('Cùng prompt với Gemini (chỉ đổi adapter)', t0.prompt.system === c0.prompt.system);
check('Kết quả + gác giống hệt nhánh Gemini', rT.advices[3].advice.verdict === 'RELATED_ENTITY' && rT.advices[0].advice.model === 'openai_compat:tpb-llm-70b');
g = makeGas({ props: Object.assign({}, TPB, { AI_RESPONSE_FORMAT: 'none', AI_AUTH_HEADER: 'api-key', AI_EXTRA_HEADERS: '{"X-App-Id":"benematch"}', AI_BASE_URL: 'https://ai-gw.tpb.local/llm/chat/completions' }), aiResponder: fakeLlm });
g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs: pairs.slice(0, 1) });
const t1 = g.aiCalls[0];
check('Tùy biến IT: URL đầy đủ, header api-key thô, header phụ, không response_format', t1.url === 'https://ai-gw.tpb.local/llm/chat/completions' && t1.headers['api-key'] === 'tok-123' && t1.headers['X-App-Id'] === 'benematch' && !t1.body.response_format);

console.log('\n[GAS] cấu hình + API khác');
g = makeGas({ props: { ACCESS_CODES: CODES }, aiResponder: fakeLlm });
check('Chưa có AI_API_KEY → ADVISOR_NOT_CONFIGURED', g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs }).error === 'ADVISOR_NOT_CONFIGURED');
g = makeGas({ props: { ACCESS_CODES: CODES, AI_PROVIDER: 'openai_compat', AI_API_KEY: 'x' } });
check('openai_compat thiếu model/URL → ADVISOR_NOT_CONFIGURED', g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs }).error === 'ADVISOR_NOT_CONFIGURED');
g = makeGas({ props: { ACCESS_CODES: CODES, AI_PROVIDER: 'dify', AI_API_KEY: 'x' } });
check('Nhà cung cấp lạ (dify) → ADVISOR_NOT_CONFIGURED', /không hỗ trợ/.test(g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs }).message));
g = makeGas({ props: { DIFY_API_URL: 'https://api.dify.ai/v1', DIFY_API_KEY: 'app-cu', ACCESS_CODES: CODES } });
check('Biến DIFY_* cũ không còn được dùng', g.post({ action: 'advise_names', access_code: 'BM-7Q2X', data_attest: ANON, pairs }).error === 'ADVISOR_NOT_CONFIGURED');

g = makeGas({ props: PROPS });
const rc = g.post({ action: 'reconcile', invoices: [{ seller_name: 'CÔNG TY TNHH ABC VIỆT NAM', seller_mst: '0101234565', amount_total: 100 }], transfers: [{ beneficiary_name: 'CTY TNHH ABC VN', amount: 100 }] });
check('reconcile qua GAS vẫn chạy', rc.summary && rc.summary.decision === 'MATCH', rc.summary && rc.summary.decision);
check('reconcile kèm file → OCR_LOCAL_ONLY (GAS không OCR)', g.post({ action: 'reconcile', files: [{ name: 'a.png', data: 'AAAA' }] }).error === 'OCR_LOCAL_ONLY');
check('Không còn hàm OCR phía GAS', typeof g.ctx.ocrInvoices_ === 'undefined' && typeof g.ctx.callDriveOcr_ === 'undefined');

g = makeGas({ props: PROPS, aiResponder: fakeLlm });
const kt = g.ctx.kiemTraAI();
check('kiemTraAI (chạy tay) gọi model với tên giả lập', kt && kt.ai_status === 'OK' && g.aiCalls.length === 1 && /SAO VIỆT/.test(g.aiCalls[0].prompt.user));

g = makeGas({ props: {} });
const code = g.ctx.taoMaTruyCap();
const codes = JSON.parse(g.store.ACCESS_CODES);
check('taoMaTruyCap tạo mã BM-XXXXXXXXXX + hạn mức mặc định', /^BM-[A-Z0-9]{10}$/.test(code) && codes[code] && g.store.ADVISOR_DAILY_LIMIT === '200', code);
check('doGet báo số mã truy cập + chưa cấu hình AI', JSON.parse(g.ctx.doGet().text).access_codes === 1 && JSON.parse(g.ctx.doGet().text).advisor.configured === false);

console.log(`\n=== GAS: ${pass} pass · ${fail} fail ===`);
process.exit(fail ? 1 : 0);
