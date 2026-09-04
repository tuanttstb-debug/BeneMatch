/**
 * recon.test.mjs — regression harness cho Batch Reconciliation.
 * Chạy: node test/recon.test.mjs
 * Đọc synthetic dataset, chạy reconcile (stub verifier), in bảng + assert decision từng nhóm.
 * Exit 1 nếu lệch kỳ vọng (regression gate — C1).
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { reconcile, parseTransferCsv, makeStubVerifier } = require(join(ROOT, 'src/recon/index.js'));

const invoices = JSON.parse(readFileSync(join(ROOT, 'data/synthetic/invoices.json'), 'utf8'));
const csv = readFileSync(join(ROOT, 'data/synthetic/transfer_orders.csv'), 'utf8');
const config = JSON.parse(readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8'));
const transfers = parseTransferCsv(csv);

// Kỳ vọng theo group key (MST) — xem data/synthetic/scenarios.md
// CR 2026-09-04 #3: bỏ cảnh báo THIẾU LỆNH CT (0104 chỉ có HĐ → hết cờ) +
// hóa đơn > lệnh CT không là rủi ro (0103 ΣHĐ 40tr > ΣCT 35tr → hết cờ). Cả hai → MATCH.
const EXPECT = {
  '0101234567': 'MATCH',
  '0102000002': 'REVIEW',   // thừa chi (ΣCT 90tr > ΣHĐ 80tr) — GIỮ cảnh báo
  '0103000003': 'MATCH',    // ΣHĐ 40tr > ΣCT 35tr (chi ít hơn) — không còn rủi ro
  '0104000004': 'MATCH',    // chỉ có hóa đơn, chưa có lệnh CT — không còn cảnh báo
  '0105000005': 'REVIEW',   // chỉ có lệnh CT, thiếu hóa đơn — GIỮ cảnh báo
  '0106000006': 'REVIEW',
  '0107000007': 'NOT_MATCH',
  '0108000008': 'MATCH',
  '0109000009': 'REVIEW',
};
const EXPECT_BATCH = 'NOT_MATCH';
const EXPECT_GRAND_DIFF = -30000333;

const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN');

const res = await reconcile(invoices, transfers, config, makeStubVerifier(), { batch_id: 'BM-BATCH-TEST' });

// ---- In bảng ----
console.log('\n=== BeneMatch — Batch Reconciliation (synthetic) ===');
console.log('batch:', res.batch_id, '| verify source:', res.audit.name_verify_source);
console.log('-'.repeat(96));
console.log(
  'Nhóm(MST)'.padEnd(14), 'Người thụ hưởng'.padEnd(26),
  'ΣHĐ'.padStart(13), 'ΣCT'.padStart(13), 'diff'.padStart(13), ' decision');
console.log('-'.repeat(96));
for (const g of res.groups) {
  console.log(
    String(g.group_key).padEnd(14),
    String(g.beneficiary_display).slice(0, 25).padEnd(26),
    vnd(g.sum_invoices).padStart(13),
    vnd(g.sum_transfers).padStart(13),
    vnd(g.diff).padStart(13),
    ' ' + g.decision + (g.decision === 'MATCH' ? '' : ' ⚠'));
  for (const w of g.warnings) console.log('  └─', w.code, '·', w.message);
}
console.log('-'.repeat(96));
const s = res.summary;
console.log(`GRAND: ΣHĐ=${vnd(s.grand_total_invoices)}  ΣCT=${vnd(s.grand_total_transfers)}  diff=${vnd(s.grand_diff)}`);
console.log(`BATCH decision=${s.decision}  action=${s.action}  risk=${s.risk_level}  groups=${s.group_count}  warnings=${s.warning_count}`);

// ---- Assert ----
let pass = 0, fail = 0;
const check = (name, got, exp) => {
  const ok = got === exp;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + `  (got=${got} exp=${exp})`);
  ok ? pass++ : fail++;
};
console.log('\n=== Regression gate ===');
for (const g of res.groups) if (EXPECT[g.group_key]) check('group ' + g.group_key, g.decision, EXPECT[g.group_key]);
check('batch decision', s.decision, EXPECT_BATCH);
check('grand_diff', s.grand_diff, EXPECT_GRAND_DIFF);

// tín hiệu đặc trưng
const gDelta = res.groups.find((g) => g.group_key === '0107000007');
check('Delta = NAME_MISMATCH', gDelta && gDelta.warnings.some((w) => w.code === 'BENEFICIARY_NAME_MISMATCH'), true);
const gDup = res.groups.find((g) => g.group_key === '0106000006');
check('Tiến Phát = DUPLICATE', gDup && gDup.warnings.some((w) => w.code === 'DUPLICATE_INVOICE'), true);
const gOcr = res.groups.find((g) => g.group_key === '0109000009');
check('Minh Anh = OCR flag', gOcr && gOcr.warnings.some((w) => w.code === 'POSSIBLE_OCR_ERROR'), true);

console.log(`\nKẾT QUẢ: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
