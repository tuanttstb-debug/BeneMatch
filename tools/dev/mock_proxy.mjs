/**
 * mock_proxy.mjs — cổng AI giả lập trên máy (chạy ĐÚNG gas/Code.gs + Engine.gs trong vm, Dify giả lập).
 * Dùng để thử giao diện "AI tư vấn" end-to-end khi chưa deploy GAS/Dify.
 * Chạy: node tools/dev/mock_proxy.mjs [port=8790]  → URL cổng: http://127.0.0.1:8790/exec · mã: DEV-LOCAL
 */
import http from 'http';
import { makeGas, fakeLlm } from '../../test/gas_harness.mjs';

const port = Number(process.argv[2] || 8790);
const gas = makeGas({
  props: { DIFY_ADVISOR_URL: 'https://mock.dify/v1', DIFY_ADVISOR_KEY: 'mock', ACCESS_CODES: JSON.stringify({ 'DEV-LOCAL': 'dev' }), ADVISOR_DAILY_LIMIT: '1000' },
  difyResponder: fakeLlm,
});
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') { res.end(gas.ctx.doGet().text); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(gas.ctx.doPost({ postData: { contents: body } }).text); }, 400);
  });
}).listen(port, '127.0.0.1', () => console.log(`mock proxy: http://127.0.0.1:${port}/exec  (mã: DEV-LOCAL)`));
