/**
 * advisor_smoke.mjs — đo AI tư vấn trên 22 ca khó GIẢ LẬP (test/golden_hard.json) qua cổng thật.
 * Không có dữ liệu KH → kết quả chia sẻ được. Chạy sau khi deploy GAS + import workflow Dify:
 *   node tools/eval/advisor_smoke.mjs --ai-url https://script.google.com/macros/s/…/exec --ai-code <mã>
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { BM, REPO, args, askProxy } from './lib.mjs';

const a = args();
if (!a['ai-url'] || !a['ai-code']) { console.error('Cần --ai-url và --ai-code'); process.exit(1); }
const H = JSON.parse(readFileSync(join(REPO, 'test/golden_hard.json'), 'utf8'));
const t0 = Date.now();
const adv = await askProxy(a['ai-url'], a['ai-code'], H.map((h) => ({ invoice_name: h.inv, payment_name: h.pay })), (d, t) => process.stdout.write(`\r${d}/${t}`));
process.stdout.write('\n');
let ok = 0, strict = 0, falseSame = 0, fallback = 0;
H.forEach((h, i) => {
  const x = adv[i] || {}, v = x.advice || {};
  const acc = h.acceptable.includes(v.verdict), ex = v.verdict === h.truth;
  if (acc) ok++; if (ex) strict++;
  if (v.verdict === 'SAME_ENTITY' && h.truth !== 'SAME_ENTITY' && !h.acceptable.includes('SAME_ENTITY')) falseSame++;
  if (v.ai_status !== 'OK') fallback++;
  console.log(`${acc ? '✓' : '✗'} ${h.id} ${h.cat.padEnd(18)} engine=${(x.engine || {}).decision} AI=${v.verdict} (${v.confidence}) ${v.relation || ''} — kỳ vọng ${h.truth}`);
});
console.log(`\nChấp nhận được: ${ok}/${H.length} · đúng tuyệt đối: ${strict}/${H.length} · AI nói CÙNG sai: ${falseSame} · FALLBACK: ${fallback} · ${(Date.now() - t0) / 1000}s`);
process.exit(falseSame ? 1 : 0);
