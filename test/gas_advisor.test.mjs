/**
 * gas_advisor.test.mjs — kiểm GAS proxy "advise_names" (không cần deploy, không gọi Dify thật).
 * Chạy: node test/gas_advisor.test.mjs
 */
import { makeGas, fakeLlm } from './gas_harness.mjs';

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; if (!ok || process.env.VERBOSE) console.log((ok ? '  ✓ ' : '  ✗ ') + n + (d ? '  — ' + d : '')); };
const PROPS = { DIFY_ADVISOR_URL: 'https://api.dify.ai/v1', DIFY_ADVISOR_KEY: 'app-test', ACCESS_CODES: JSON.stringify({ 'BM-7Q2X': 'Team Số hóa' }), ADVISOR_DAILY_LIMIT: '5', SHEET_ID: 'sheet' };

console.log('\n[GAS] advise_names');
let g = makeGas({ props: PROPS, difyResponder: fakeLlm });
check('doGet báo advisor đã cấu hình', JSON.parse(g.ctx.doGet().text).advisor === true);
check('Sai mã → ACCESS_DENIED', g.post({ action: 'advise_names', access_code: 'SAI', pairs: [{ invoice_name: 'A', payment_name: 'B' }] }).error === 'ACCESS_DENIED');
check('Không mã → ACCESS_DENIED', g.post({ action: 'advise_names', pairs: [] }).error === 'ACCESS_DENIED');

const pairs = [
  { invoice_name: 'CÔNG TY TNHH THƯƠNG MẠI HOÀNG GIA', payment_name: 'HOANG GIA TRADING CO., LTD', amount: 50000000, account_number: '0111222333' },
  { invoice_name: 'CÔNG TY TNHH ABC VIỆT NAM', payment_name: 'CTY TNHH ABC VN' },                         // MATCH → không hỏi AI
  { invoice_name: 'CÔNG TY CỔ PHẦN DELTA MEKONG', payment_name: 'CÔNG TY TNHH DELTA MEKONG' },           // khác loại hình → không hỏi AI
  { invoice_name: 'TỔNG CÔNG TY CỔ PHẦN ĐIỆN LỰC AN BÌNH', payment_name: 'CONG TY CO PHAN DIEN LUC AN BINH' },
  { invoice_name: 'CÔNG TY TNHH THƯƠNG MẠI MINH ANH', payment_name: 'NGUYEN THI MINH ANH' },
];
const r = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs });
check('Trả 5 kết quả, 3 được hỏi AI', r.advices.length === 5 && r.advices.filter((x) => x.eligible).length === 3, JSON.stringify(r.advices.map((x) => x.eligible)));
check('Dify chỉ bị gọi 3 lần', g.difyCalls.length === 3, String(g.difyCalls.length));
const sent = JSON.stringify(g.difyCalls.map((c) => c.body));
check('Payload gửi Dify KHÔNG có số tiền/STK', !/50000000|0111222333|amount|account/.test(sent), sent.slice(0, 200));
check('Payload do server tự tính (engine_reason có mặt)', g.difyCalls.every((c) => c.body.inputs.engine_reason && c.body.inputs.invoice_core !== undefined));
check('Gọi đúng endpoint + Bearer key', g.difyCalls[0].url === 'https://api.dify.ai/v1/workflows/run' && g.difyCalls[0].headers.Authorization === 'Bearer app-test');
const tong = r.advices[3].advice;
check('Gác: LLM nói CÙNG cho Tổng cty ↔ cty → RELATED', tong.verdict === 'RELATED_ENTITY', tong.verdict);
check('Ý kiến AI không dùng cho quyết định', r.advices.filter((x) => x.advice).every((x) => x.advice.used_for_decision === false));
check('Kết luận engine giữ nguyên trong response', r.advices[0].engine.decision === 'REVIEW');
check('Hạn mức đã trừ 3/5', r.quota.used === 3 && r.quota.limit === 5);
check('Log không chứa tên (tiêu đề + 1 dòng)', g.logRows.length === 2 && !/HOANG|DELTA|MINH|ABC/.test(JSON.stringify(g.logRows)), JSON.stringify(g.logRows[1]));
const r2 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs: pairs.slice(0, 1).concat(pairs.slice(3)) });
check('Vượt hạn mức ngày → QUOTA_EXCEEDED', r2.error === 'QUOTA_EXCEEDED', JSON.stringify(r2));

g = makeGas({ props: PROPS, difyResponder: () => null });
const r3 = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs: pairs.slice(0, 1) });
check('Dify lỗi → FALLBACK/UNCERTAIN, không vỡ', r3.advices[0].advice.ai_status === 'FALLBACK' && r3.advices[0].advice.verdict === 'UNCERTAIN');

g = makeGas({ props: { ACCESS_CODES: PROPS.ACCESS_CODES }, difyResponder: fakeLlm });
check('Chưa cấu hình Dify → ADVISOR_NOT_CONFIGURED', g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs }).error === 'ADVISOR_NOT_CONFIGURED');

g = makeGas({ props: PROPS });
const rc = g.post({ action: 'reconcile', invoices: [{ seller_name: 'CÔNG TY TNHH ABC VIỆT NAM', seller_mst: '0101234565', amount_total: 100 }], transfers: [{ beneficiary_name: 'CTY TNHH ABC VN', amount: 100 }] });
check('reconcile qua GAS vẫn chạy', rc.summary && rc.summary.decision === 'MATCH', rc.summary && rc.summary.decision);

g = makeGas({ props: { DIFY_API_URL: 'https://api.dify.ai/v1', DIFY_API_KEY: 'app-cu', ACCESS_CODES: PROPS.ACCESS_CODES }, difyResponder: fakeLlm });
const rf = g.post({ action: 'advise_names', access_code: 'BM-7Q2X', pairs: pairs.slice(0, 1) });
check('Dùng lại DIFY_API_URL/KEY sẵn có khi chưa có DIFY_ADVISOR_*', !rf.error && g.difyCalls[0].headers.Authorization === 'Bearer app-cu', JSON.stringify(rf).slice(0, 120));

g = makeGas({ props: {} });
const code = g.ctx.taoMaTruyCap();
const codes = JSON.parse(g.store.ACCESS_CODES);
check('taoMaTruyCap tạo mã BM-XXXXXXXXXX + hạn mức mặc định', /^BM-[A-Z0-9]{10}$/.test(code) && codes[code] && g.store.ADVISOR_DAILY_LIMIT === '200', code);
check('doGet báo số mã truy cập', JSON.parse(g.ctx.doGet().text).access_codes === 1);

console.log(`\n=== GAS: ${pass} pass · ${fail} fail ===`);
process.exit(fail ? 1 : 0);
