/**
 * gas_harness.mjs — chạy gas/Engine.gs + gas/Code.gs trong Node (vm) với GAS services giả lập.
 * Dùng cho: test/gas_advisor.test.mjs (unit) và tools/dev/mock_proxy.mjs (thử FE end-to-end không cần deploy).
 * aiResponder(names, n, call) → object ý kiến giả lập (hoặc null = lỗi HTTP 400, { __http, __msg } = lỗi HTTP tùy chọn,
 *   { __text } = model trả chữ thô). Harness tự bọc theo định dạng của nhà cung cấp (AI_PROVIDER: gemini | openai_compat).
 *   names = { invoice_name, payment_name } đọc lại từ lời nhắn user (BM.advisor.userPrompt — 2 dòng đầu).
 */
import vm from 'vm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Lấy lời nhắn system/user từ body request theo nhà cung cấp. */
export function promptOf(body) {
  if (body.contents) return { system: body.systemInstruction.parts[0].text, user: body.contents[0].parts[0].text };
  return { system: body.messages[0].content, user: body.messages[1].content };
}
function namesOf(user) {
  const m1 = /Tên bên bán trên HÓA ĐƠN: (.*)/.exec(user), m2 = /Tên người thụ hưởng trên UNC: (.*)/.exec(user);
  return { invoice_name: m1 ? m1[1] : '', payment_name: m2 ? m2[1] : '' };
}
function wrap(provider, out) {
  const text = out.__text != null ? out.__text : JSON.stringify(out);
  if (provider === 'openai_compat') return { choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 120 } };
  return { candidates: [{ content: { role: 'model', parts: [{ text: 'suy nghĩ…', thought: true }, { text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120, thoughtsTokenCount: 300 } };
}

export function makeGas({ props = {}, aiResponder, logRows = [], aiCalls = [] } = {}) {
  const store = Object.assign({}, props);
  const respond = (r) => {
    const body = JSON.parse(r.payload);
    const pr = promptOf(body);
    const call = { url: r.url, headers: r.headers, body, prompt: pr };
    aiCalls.push(call);
    const out = aiResponder ? aiResponder(namesOf(pr.user), aiCalls.length, call) : null;
    if (out && out.__http) return { getResponseCode: () => out.__http, getContentText: () => JSON.stringify({ error: { code: out.__http, message: out.__msg || 'error', status: out.__status || '' } }) };
    if (out == null) return { getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: { code: 400, message: 'API key not valid', status: 'INVALID_ARGUMENT' } }) };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(wrap(store.AI_PROVIDER || 'gemini', out)) };
  };
  const ctx = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10).replace(/-/g, ''), getUuid: () => 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff', sleep: () => {} },
    Logger: { log: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null, insertSheet: () => ({ getLastRow: () => logRows.length, appendRow: (r) => logRows.push(r) }) }) },
    UrlFetchApp: { fetchAll: (reqs) => reqs.map(respond), fetch: (url, r) => respond(r) },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'gas/Engine.gs'), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(ROOT, 'gas/Code.gs'), 'utf8'), ctx);
  const post = (payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  return { ctx, post, store, logRows, aiCalls };
}

/** "LLM" giả lập có chủ đích sai ở vài ca để kiểm lớp gác. */
export function fakeLlm(names) {
  const inv = names.invoice_name.toUpperCase(), pay = names.payment_name.toUpperCase();
  if (/TRADING|COMPANY|JSC|CO\., LTD/.test(pay)) return { verdict: 'SAME_ENTITY', relation: 'TRANSLATION', confidence: 0.86, evidence: ['Tên tiếng Anh tương ứng tên riêng tiếng Việt'], explanation: 'Có thể là tên giao dịch tiếng Anh.', checks_for_officer: ['Đối chiếu tên nước ngoài trên ĐKKD'] };
  if (/TỔNG CÔNG TY|TONG CONG TY/.test(inv)) return { verdict: 'SAME_ENTITY', relation: 'PARENT_SUBSIDIARY', confidence: 0.9, evidence: [], explanation: 'sai có chủ đích', checks_for_officer: [] };
  if (/NGUYEN/.test(pay)) return { verdict: 'DIFFERENT_ENTITY', relation: 'UNRELATED', confidence: 0.9, evidence: ['Tài khoản cá nhân'], explanation: 'Người nhận là cá nhân.', checks_for_officer: [] };
  return { verdict: 'UNCERTAIN', relation: 'UNKNOWN', confidence: 0.4, evidence: [], explanation: 'Chưa đủ căn cứ.', checks_for_officer: [] };
}
