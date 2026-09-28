/**
 * gas_harness.mjs — chạy gas/Engine.gs + gas/Code.gs trong Node (vm) với GAS services giả lập.
 * Dùng cho: test/gas_advisor.test.mjs (unit) và tools/dev/mock_proxy.mjs (thử FE end-to-end không cần deploy).
 * difyResponder(inputs) → object `result` giả lập output workflow "BeneMatch Name Advisor v3" (hoặc null = lỗi).
 */
import vm from 'vm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function makeGas({ props = {}, difyResponder, logRows = [], difyCalls = [] } = {}) {
  const store = Object.assign({}, props);
  const ctx = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10).replace(/-/g, ''), getUuid: () => 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff' },
    Logger: { log: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null, insertSheet: () => ({ getLastRow: () => logRows.length, appendRow: (r) => logRows.push(r) }) }) },
    UrlFetchApp: {
      fetchAll: (reqs) => reqs.map((r) => {
        const body = JSON.parse(r.payload);
        difyCalls.push({ url: r.url, headers: r.headers, body });
        const out = difyResponder ? difyResponder(body.inputs) : null;
        const ok = out != null;
        return { getResponseCode: () => (ok ? 200 : 500), getContentText: () => JSON.stringify(ok ? { data: { status: 'succeeded', outputs: { result: out } } } : { error: 'x' }) };
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'gas/Engine.gs'), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(ROOT, 'gas/Code.gs'), 'utf8'), ctx);
  const post = (payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  return { ctx, post, store, logRows, difyCalls };
}

/** "LLM" giả lập có chủ đích sai ở vài ca để kiểm lớp gác. */
export function fakeLlm(inputs) {
  const inv = inputs.invoice_name.toUpperCase(), pay = inputs.payment_name.toUpperCase();
  if (/TRADING|COMPANY|JSC|CO\., LTD/.test(pay)) return { verdict: 'SAME_ENTITY', relation: 'TRANSLATION', confidence: 0.86, evidence: ['Tên tiếng Anh tương ứng tên riêng tiếng Việt'], explanation: 'Có thể là tên giao dịch tiếng Anh.', checks_for_officer: ['Đối chiếu tên nước ngoài trên ĐKKD'] };
  if (/TỔNG CÔNG TY|TONG CONG TY/.test(inv)) return { verdict: 'SAME_ENTITY', relation: 'PARENT_SUBSIDIARY', confidence: 0.9, evidence: [], explanation: 'sai có chủ đích', checks_for_officer: [] };
  if (/NGUYEN/.test(pay)) return { verdict: 'DIFFERENT_ENTITY', relation: 'UNRELATED', confidence: 0.9, evidence: ['Tài khoản cá nhân'], explanation: 'Người nhận là cá nhân.', checks_for_officer: [] };
  return { verdict: 'UNCERTAIN', relation: 'UNKNOWN', confidence: 0.4, evidence: [], explanation: 'Chưa đủ căn cứ.', checks_for_officer: [] };
}
