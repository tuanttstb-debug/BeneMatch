/**
 * mock_proxy.mjs — cổng AI giả lập trên máy (chạy ĐÚNG gas/Code.gs + Engine.gs trong vm, model AI giả lập).
 * Dùng để thử giao diện "AI tư vấn" end-to-end khi chưa deploy GAS / chưa có key AI.
 * Mặc định chế độ thử (AI_ALLOW_REAL_DATA tắt — FE phải tick "tên đã ẩn danh"); thêm đối số `real` để giả lập AI nội bộ đã cho phép dữ liệu thật.
 * Chạy: node tools/dev/mock_proxy.mjs [port=8790]  → URL cổng: http://127.0.0.1:8790/exec · mã: DEV-LOCAL
 */
import http from 'http';
import { makeGas, fakeLlm } from '../../test/gas_harness.mjs';

const port = Number(process.argv[2] || 8790);
const real = process.argv.includes('real');
const slow = process.argv.includes('slow');   // giả lập AI treo (vd Gemini 3.8 miễn phí) → kiểm FE báo bận sau 10 giây
const gas = makeGas({
  props: Object.assign({ AI_API_KEY: 'mock', ACCESS_CODES: JSON.stringify({ 'DEV-LOCAL': 'dev' }), ADVISOR_DAILY_LIMIT: '1000' },
    real ? { AI_PROVIDER: 'openai_compat', AI_BASE_URL: 'https://ai-noi-bo.mock/v1', AI_MODEL: 'tpb-llm-mock', AI_ALLOW_REAL_DATA: 'true' } : {}),
  aiResponder: fakeLlm,
});
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') { res.end(gas.ctx.doGet().text); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(gas.ctx.doPost({ postData: { contents: body } }).text); }, slow ? 14000 : 400);
  });
}).listen(port, '127.0.0.1', () => console.log(`mock proxy: http://127.0.0.1:${port}/exec  (mã: DEV-LOCAL · ${real ? 'AI nội bộ giả lập, cho dữ liệu thật' : 'Gemini giả lập, chế độ thử'})`));
