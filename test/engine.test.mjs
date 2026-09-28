/**
 * engine.test.mjs — regression gate cho BeneMatch Engine v3.
 * Chạy: node test/engine.test.mjs   (exit 1 nếu có ca lệch)
 *  1) Golden check tên (test/golden_names.json) — decision + reason_code.
 *  2) Parity difflib: seqRatio JS ≡ Python SequenceMatcher.ratio (nếu máy có python).
 *  3) Kịch bản hồ sơ (data/synthetic/scenarios.json) — decision toàn hồ sơ + mã cảnh báo đặc trưng.
 *  4) IO: MST checksum, số tiền/ngày, bảng dán Excel, trích text hóa đơn.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BM = require(join(ROOT, 'src/engine/bm-engine.js'));
const GOLD = JSON.parse(readFileSync(join(ROOT, 'test/golden_names.json'), 'utf8'));
const SCN = JSON.parse(readFileSync(join(ROOT, 'data/synthetic/scenarios.json'), 'utf8'));
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  if (!ok || process.env.VERBOSE) console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  — ' + detail : ''));
};

// ---- 1) Golden check tên ----
console.log('\n[1] Golden check tên (' + GOLD.length + ' cặp)');
const byDecision = { MATCH: 0, REVIEW: 0, NOT_MATCH: 0 };
let falseMatch = 0;
for (const g of GOLD) {
  const r = BM.verifyName(g.inv, g.pay, CONFIG.name);
  byDecision[r.decision]++;
  if (r.decision === 'MATCH' && g.expect !== 'MATCH') falseMatch++;
  const ok = r.decision === g.expect && (!g.code || r.reason_code === g.code);
  check(`${g.id} ${g.note || ''}`, ok, `got ${r.decision}/${r.reason_code} (${r.score_pct}%) exp ${g.expect}${g.code ? '/' + g.code : ''}`);
}
check('False Match = 0 (không có ca KHÁC/REVIEW bị cho KHỚP)', falseMatch === 0, 'falseMatch=' + falseMatch);

// ---- 2) Parity difflib ----
console.log('\n[2] Parity SequenceMatcher (JS ≡ Python)');
const strs = [];
for (const g of GOLD) {
  const a = BM.parseName(g.inv), b = BM.parseName(g.pay);
  strs.push([a.normalized, b.normalized], [a.core, b.core]);
}
const py = spawnSync('python', ['-c',
  'import sys,json\nfrom difflib import SequenceMatcher as S\nd=json.load(sys.stdin)\nprint(json.dumps([S(None,a,b).ratio() if a and b else 0 for a,b in d]))'],
  { input: JSON.stringify(strs), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
if (py.status === 0 && py.stdout.trim()) {
  const exp = JSON.parse(py.stdout);
  let diff = 0;
  strs.forEach(([a, b], i) => { if (Math.abs(BM.seqRatio(a, b) - exp[i]) > 1e-9) diff++; });
  check(`seqRatio khớp Python trên ${strs.length} cặp`, diff === 0, 'lệch ' + diff);
} else console.log('  (bỏ qua — không chạy được python)');

// ---- 3) Kịch bản hồ sơ ----
console.log('\n[3] Kịch bản hồ sơ (' + SCN.length + ')');
const EXPECT_CODES = {
  'khop-sach': [],
  'sai-phap-nhan': ['BENEFICIARY_NAME_MISMATCH'],
  'chi-sai-nguoi': ['BENEFICIARY_NOT_IN_INVOICES'],
  'thua-chi': ['AMOUNT_OVER_TOLERANCE'],
  'ten-cat-cut': ['BENEFICIARY_NAME_REVIEW'],
  'chi-nhanh': ['BENEFICIARY_NAME_REVIEW'],
  'hoa-don-trung': ['DUPLICATE_INVOICE', 'AMOUNT_OVER_TOLERANCE'],
  'nguoi-mua-khac': ['INVOICE_BUYER_NOT_BORROWER'],
  'ho-so-tong-hop': ['BENEFICIARY_NOT_IN_INVOICES', 'AMOUNT_OVER_TOLERANCE', 'BENEFICIARY_NAME_REVIEW'],
};
for (const s of SCN) {
  const r = BM.reconcileCase(s, CONFIG);
  check(`${s.id} → ${s.expect}`, r.summary.decision === s.expect, 'got ' + r.summary.decision);
  const codes = r.warnings.filter((w) => w.severity > 0).map((w) => w.code).sort();
  const exp = (EXPECT_CODES[s.id] || []).slice().sort();
  check(`${s.id} mã cảnh báo`, JSON.stringify([...new Set(codes)]) === JSON.stringify([...new Set(exp)]), 'got ' + codes.join(',') + ' exp ' + exp.join(','));
  check(`${s.id} không dùng AI`, r.audit.used_ai === false);
}
// Mọi UNC đều được check tên (không chỉ UNC đầu tiên).
const tong = BM.reconcileCase(SCN.find((s) => s.id === 'ho-so-tong-hop'), CONFIG);
check('ho-so-tong-hop: 5 UNC → 5 cặp check tên', tong.pairs.length === 5, 'pairs=' + tong.pairs.length);
check('ho-so-tong-hop: 2 UNC ABC gộp đúng 1 bên bán', tong.groups.find((g) => g.seller_mst === '0101234565').transfers.length === 2);
// UNC sai tên nằm ở vị trí thứ 2 của cùng bên bán vẫn bị bắt.
const second = BM.reconcileCase({
  invoices: [{ invoice_no: '11', seller_name: 'CÔNG TY TNHH ABC VIỆT NAM', seller_mst: '0101234565', amount_total: 100 }],
  transfers: [
    { beneficiary_name: 'CTY TNHH ABC VIET NAM', amount: 50, content: 'HD 11' },
    { beneficiary_name: 'CONG TY CO PHAN ABC VIET NAM', amount: 50, content: 'HD 11' },
  ],
}, CONFIG);
check('UNC thứ 2 khác pháp nhân vẫn bị chặn', second.summary.decision === 'NOT_MATCH', second.summary.decision);
// Nội dung UNC nhắc số HĐ bên khác → cảnh báo.
const ref = BM.reconcileCase({
  invoices: [
    { invoice_no: '555', seller_name: 'CÔNG TY TNHH ABC VIỆT NAM', seller_mst: '0101234565', amount_total: 100 },
    { invoice_no: '777', seller_name: 'CÔNG TY TNHH THƯƠNG MẠI HOÀNG GIA', seller_mst: '0103000001', amount_total: 100 },
  ],
  transfers: [{ beneficiary_name: 'CTY TNHH ABC VIET NAM', amount: 100, content: 'TT HD 777' }],
}, CONFIG);
check('Nội dung UNC nhắc HĐ bên bán khác → cảnh báo', ref.warnings.some((w) => w.code === 'CONTENT_REFERS_OTHER_SUPPLIER'));

// ---- 4) IO ----
console.log('\n[4] IO & tiện ích');
check('MST hợp lệ (checksum)', BM.validateMst('0101234565').valid && BM.validateMst('0106000017001').valid);
check('MST sai checksum bị bắt', BM.validateMst('0101234567').reason === 'CHECKSUM');
check('toAmount "100.000.000"', BM.toAmount('100.000.000') === 100000000);
check('toAmount "1,250,000.00"', BM.toAmount('1,250,000.00') === 1250000);
check('toAmount "45.000.000 đ"', BM.toAmount('45.000.000 đ') === 45000000);
check('toIsoDate "05/09/2026"', BM.toIsoDate('05/09/2026') === '2026-09-05');
check('toIsoDate serial Excel 46270', BM.toIsoDate('46270') === '2026-09-05');
const tsv = 'STT\tTên người thụ hưởng\tSố tài khoản\tNgân hàng\tSố tiền\tNội dung\n1\tCTY TNHH ABC VN\t0123456789\tVCB\t150.000.000\tTT HD 101\n\tTổng cộng\t\t\t150.000.000\t';
const tr = BM.io.rowsToRecords(BM.io.parseDelimited(tsv), 'transfer');
check('Dán bảng UNC từ Excel: nhận cột tiếng Việt + bỏ dòng tổng', tr.header_found && tr.records.length === 1 && tr.records[0].account_number === '0123456789' && tr.records[0].amount === '150.000.000', JSON.stringify(tr.records));
const csvInv = 'Số hóa đơn,Ngày hóa đơn,Tên người bán,MST người bán,Tổng tiền thanh toán\n0000101,03/09/2026,CÔNG TY TNHH ABC VIỆT NAM,0101234565,"100,000,000"';
const iv = BM.io.rowsToRecords(BM.io.parseDelimited(csvInv), 'invoice');
check('CSV bảng kê hóa đơn', iv.records.length === 1 && iv.records[0].seller_mst === '0101234565' && BM.toAmount(iv.records[0].amount_total) === 100000000, JSON.stringify(iv.records));
const pdfText = [
  'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu (Serial): 1C26TAA', 'Số (No.): 00000101',
  'Ngày (Date) 03 tháng (month) 09 năm (year) 2026',
  'Đơn vị bán hàng (Seller): CÔNG TY TNHH ABC VIỆT NAM', 'Mã số thuế (Tax code): 0101234565',
  'Số tài khoản (Account No.): 0123456789 tại Vietcombank',
  'Họ tên người mua hàng (Buyer):', 'Tên đơn vị (Company name): CÔNG TY CỔ PHẦN SẢN XUẤT MINH AN', 'Mã số thuế (Tax code): 0310000017',
  'Tổng cộng tiền thanh toán (Total payment): 100.000.000',
].join('\n');
const px = BM.io.parseInvoiceText(pdfText);
check('Trích text HĐĐT (PDF/OCR)', px.seller_name === 'CÔNG TY TNHH ABC VIỆT NAM' && px.seller_mst === '0101234565' && px.buyer_mst === '0310000017'
  && px.amount_total === 100000000 && px.invoice_no === '00000101' && px.invoice_series === '1C26TAA' && px.invoice_date === '2026-09-03' && px.seller_account === '0123456789', JSON.stringify(px));

// OCR đọc sai dấu ở nhãn → vẫn tách được tên (ca thật từ Tesseract trên test/live/invoice_synth_01.png).
const ocrText = 'HOA DON GIA TRI GIA TANG\nKý hiệu: 1C26TAA   Số: 00012345\nNgày 12 tháng 08 năm 2026\nDon vĩ ban hang: CONG TY TNHH ABC VIET NAM\nMã số thuế: 0101234567\nTổng cộng tiền thanh toán: 100.000.000';
const po = BM.io.parseInvoiceText(ocrText);
check('OCR sai dấu ở nhãn người bán', po.seller_name === 'CONG TY TNHH ABC VIET NAM' && po.amount_total === 100000000, JSON.stringify(po));

// ---- 5) Ca khó (4 nhóm [TT] chọn) + module AI tư vấn ----
console.log('\n[5] Ca khó cho AI tư vấn');
const HARD = JSON.parse(readFileSync(join(ROOT, 'test/golden_hard.json'), 'utf8'));
for (const h of HARD) {
  const r = BM.verifyName(h.inv, h.pay, CONFIG.name);
  check(`${h.id} ${h.cat}: engine không KHỚP nhầm`, !(h.truth !== 'SAME_ENTITY' && r.decision === 'MATCH'), r.decision + '/' + r.reason_code);
  check(`${h.id} được hỏi AI`, BM.advisor.eligible(r), r.decision + '/' + r.reason_code);
}
check('Tổng công ty ↔ công ty cùng tên lõi → CẦN KIỂM TRA (GROUP_TIER_DIFFERENT)',
  BM.verifyName('TỔNG CÔNG TY CỔ PHẦN ĐIỆN LỰC AN BÌNH', 'CONG TY CO PHAN DIEN LUC AN BINH').reason_code === 'GROUP_TIER_DIFFERENT');
check('Khác loại hình → KHÔNG hỏi AI (luật cứng)', !BM.advisor.eligible(BM.verifyName('CÔNG TY CỔ PHẦN DELTA MEKONG', 'CÔNG TY TNHH DELTA MEKONG')));
check('KHỚP → KHÔNG hỏi AI', !BM.advisor.eligible(BM.verifyName('CÔNG TY TNHH ABC VIỆT NAM', 'CTY TNHH ABC VN')));
const tongRes = BM.reconcileCase(SCN.find((s) => s.id === 'ho-so-tong-hop'), CONFIG);
const col = BM.advisor.collect(tongRes);
check('collect: chỉ gom ca cần AI (tiếng Anh + UNC mồ côi), không trùng', col.length === 2, col.map((c) => c.payload.payment_name).join(' | '));
check('payload KHÔNG chứa số tiền/STK/MST', col.every((c) => !JSON.stringify(c.payload).match(/0123456789|1903555777|0101234565|30000000/)), JSON.stringify(col[0].payload));
const ncConf = BM.verifyName('CÔNG TY CỔ PHẦN DELTA MEKONG', 'CÔNG TY TNHH DELTA MEKONG');
const g1 = BM.advisor.guard({ verdict: 'SAME_ENTITY', relation: 'IDENTICAL', confidence: 0.99 }, ncConf);
check('guard: AI nói CÙNG nhưng khác loại hình → hạ về CHƯA ĐỦ CĂN CỨ', g1.verdict === 'UNCERTAIN' && g1.confidence <= 0.5 && g1.used_for_decision === false);
const g2 = BM.advisor.guard({ verdict: 'SAME_ENTITY', relation: 'PARENT_SUBSIDIARY', confidence: 0.9 }, BM.verifyName(HARD[7].inv, HARD[7].pay));
check('guard: mẹ ↔ con không thể là CÙNG pháp nhân', g2.verdict === 'RELATED_ENTITY');
const g3 = BM.advisor.guard({ verdict: 'BANANA' }, null);
check('guard: output rác → FALLBACK/UNCERTAIN', g3.ai_status === 'FALLBACK' && g3.verdict === 'UNCERTAIN');

console.log(`\n=== ${pass} pass · ${fail} fail · phân bố golden: ${JSON.stringify(byDecision)} ===`);
process.exit(fail ? 1 : 0);
