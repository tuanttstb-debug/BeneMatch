/**
 * verify_recon.mjs — parity gate: gas/Recon.gs (SYNC port) PHẢI cho kết quả
 * y hệt src/recon (async) trên cùng synthetic dataset. Chống drift 2 bản.
 * Chạy: node gas/verify_recon.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const gas = require(join(ROOT, 'gas/Recon.gs'));               // module.exports guard
const src = require(join(ROOT, 'src/recon/index.js'));
const { legalFamily } = require(join(ROOT, 'src/recon/verify_client.js'));
const { normalizeName, extractCoreName } = require(join(ROOT, 'src/recon/normalize.js'));

const invoices = JSON.parse(readFileSync(join(ROOT, 'data/synthetic/invoices.json'), 'utf8'));
const csv = readFileSync(join(ROOT, 'data/synthetic/transfer_orders.csv'), 'utf8');
const config = JSON.parse(readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8'));

// Verdict dùng chung (deterministic) cho CẢ hai engine → cô lập parity vào phần math.
function decide({ invoice_beneficiary_name, payment_beneficiary_name }) {
  const invN = normalizeName(invoice_beneficiary_name), payN = normalizeName(payment_beneficiary_name);
  if (!invN || !payN) return { decision: 'REVIEW', reason_codes: ['INSUFFICIENT_DATA'], source: 'STUB' };
  const invF = legalFamily(invN), payF = legalFamily(payN);
  if (invF !== 'UNKNOWN' && payF !== 'UNKNOWN' && invF !== payF) return { decision: 'NOT_MATCH', reason_codes: ['LEGAL_ENTITY_TYPE_CONFLICT'], source: 'STUB' };
  if (invN === payN) return { decision: 'MATCH', reason_codes: ['NORMALIZED_NAME_EXACT_MATCH'], source: 'STUB' };
  const a = extractCoreName(invN).split(' ').filter(Boolean), b = extractCoreName(payN).split(' ').filter(Boolean);
  if (a.join(' ') === b.join(' ')) return { decision: 'MATCH', reason_codes: ['LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH'], source: 'STUB' };
  const A = new Set(a), B = new Set(b); let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const sim = inter / (A.size + B.size - inter);
  return sim >= 0.6 ? { decision: 'REVIEW', reason_codes: ['NAME_SIMILAR_BUT_NOT_CONCLUSIVE'], source: 'STUB' }
                    : { decision: 'NOT_MATCH', reason_codes: ['LOW_NAME_SIMILARITY'], source: 'STUB' };
}

const transfersSrc = src.parseTransferCsv(csv);
const transfersGas = gas.reconParseTransferCsv(csv);

const resSrc = await src.reconcile(invoices, transfersSrc, config, async (p) => decide(p), { batch_id: 'PARITY' });
const resGas = gas.reconcileBatch(invoices, transfersGas, config, (p) => decide(p), { batch_id: 'PARITY' });

// Bỏ computed_at (thời gian) trước khi so.
const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); if (c.audit) delete c.audit.computed_at; return c; };
const a = JSON.stringify(strip(resSrc));
const b = JSON.stringify(strip(resGas));

console.log('CSV parse: src', transfersSrc.length, '| gas', transfersGas.length, transfersSrc.length === transfersGas.length ? '✓' : '✗');
console.log('Batch decision: src', resSrc.summary.decision, '| gas', resGas.summary.decision);
console.log('grand_diff: src', resSrc.summary.grand_diff, '| gas', resGas.summary.grand_diff);

if (a === b) { console.log('\n✓ PARITY OK — Recon.gs ≡ src/recon (byte-identical output)'); process.exit(0); }

// Nếu lệch, in điểm khác đầu tiên.
console.error('\n✗ PARITY FAIL — hai engine cho kết quả khác nhau');
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) { console.error('Lệch tại offset', i, '\n src:', a.slice(i, i + 120), '\n gas:', b.slice(i, i + 120)); break; }
}
process.exit(1);
