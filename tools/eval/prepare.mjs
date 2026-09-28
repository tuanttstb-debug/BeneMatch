/**
 * prepare.mjs — từ file trích GNOL → file GÁN NHÃN (chạy trên máy [TT]).
 *   node tools/eval/prepare.mjs --in "D:\Công việc\BeneMatch_eval\GNOL_2026Q3.xlsx" --out "D:\Công việc\BeneMatch_eval"
 *        [--ai-url https://script.google.com/macros/s/…/exec --ai-code <mã>]   # hỏi AI (gửi CẶP TÊN tới Dify — anh đã duyệt)
 *        [--match-sample 0.1]                                                  # tỉ lệ ca KHỚP lấy mẫu để kiểm (mặc định 10%, tối thiểu 30)
 * Kết quả: BeneMatch_gan_nhan_<ngày>.xlsx — cán bộ điền cột NHÃN cho từng cặp tên.
 */
import { join } from 'path';
import { BM, CONFIG, args, safeOutDir, readSheet, writeBook, askProxy, today } from './lib.mjs';

const a = args();
if (!a.in) { console.error('Thiếu --in <file trích GNOL .xlsx>'); process.exit(1); }
const dir = safeOutDir(a.out);

const hd = readSheet(a.in, ['hoadon']), unc = readSheet(a.in, ['unc']);
if (!hd || !unc) { console.error('File cần 2 sheet "HoaDon" và "UNC" (xem template.mjs).'); process.exit(1); }
const col = (rows, names) => { const h = rows[0].map((x) => BM.stripAccents(String(x)).toLowerCase().trim()); return names.map((n) => h.indexOf(n)); };
const [hId, hName, hMst, hNo, hAmt] = col(hd, ['ma ho so', 'ten ben ban', 'mst ben ban', 'so hoa don', 'tong tien']);
const [uId, uName, uAcc, uBank, uAmt, uCt] = col(unc, ['ma ho so', 'ten nguoi thu huong', 'so tai khoan', 'ngan hang', 'so tien', 'noi dung']);
if (hId < 0 || hName < 0 || uId < 0 || uName < 0) { console.error('Thiếu cột bắt buộc: "Mã hồ sơ", "Tên bên bán" (HoaDon), "Tên người thụ hưởng" (UNC).'); process.exit(1); }

const cases = new Map();
const get = (id) => { if (!cases.has(id)) cases.set(id, { invoices: [], transfers: [] }); return cases.get(id); };
hd.slice(1).forEach((r) => { if (!r[hId] || !r[hName]) return; get(String(r[hId]).trim()).invoices.push({ seller_name: r[hName], seller_mst: hMst >= 0 ? r[hMst] : '', invoice_no: hNo >= 0 ? r[hNo] : '', amount_total: hAmt >= 0 ? r[hAmt] : 0 }); });
unc.slice(1).forEach((r) => { if (!r[uId] || !r[uName]) return; get(String(r[uId]).trim()).transfers.push({ beneficiary_name: r[uName], account_number: uAcc >= 0 ? r[uAcc] : '', bank: uBank >= 0 ? r[uBank] : '', amount: uAmt >= 0 ? r[uAmt] : 0, content: uCt >= 0 ? r[uCt] : '' }); });

// Cặp tên duy nhất (tên HĐ ↔ tên UNC) + các hồ sơ chứa cặp đó.
const uniq = new Map();
for (const [id, c] of cases) {
  const res = BM.reconcileCase({ invoices: c.invoices, transfers: c.transfers }, CONFIG);
  for (const p of res.pairs) {
    const v = p.name_check; if (!v) continue;
    const k = BM.advisor.key(v);
    if (!uniq.has(k)) uniq.set(k, { v, orphan: p.group_key.startsWith('UNC:'), cases: new Set() });
    uniq.get(k).cases.add(id);
  }
}
const all = [...uniq.values()];
const grey = all.filter((x) => x.v.decision !== 'MATCH');
const matches = all.filter((x) => x.v.decision === 'MATCH');
const rate = Number(a['match-sample'] || 0.1);
const nMatch = Math.min(matches.length, Math.max(30, Math.round(matches.length * rate)));
const sample = matches.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).slice(0, nMatch).map((x) => x[1]);
const rows = grey.concat(sample);
console.log(`Hồ sơ: ${cases.size} · cặp tên duy nhất: ${all.length} (KHỚP ${matches.length} · CẦN KIỂM TRA ${all.filter((x) => x.v.decision === 'REVIEW').length} · KHÔNG KHỚP ${all.filter((x) => x.v.decision === 'NOT_MATCH').length})`);
console.log(`→ đưa vào file gán nhãn: ${rows.length} cặp (toàn bộ ca không khớp/cần kiểm tra + ${sample.length} ca khớp lấy mẫu)`);

if (a['ai-url'] && a['ai-code']) {
  const ask = rows.filter((x) => BM.advisor.eligible(x.v));
  console.log(`Hỏi AI ${ask.length} cặp qua cổng BeneMatch (chỉ gửi cặp tên) …`);
  const adv = await askProxy(a['ai-url'], a['ai-code'], ask.map((x) => ({ invoice_name: x.v.invoice.raw, payment_name: x.v.payment.raw })),
    (d, t) => process.stdout.write(`\r  ${d}/${t}`));
  process.stdout.write('\n');
  ask.forEach((x, i) => { if (adv[i] && adv[i].advice) x.ai = BM.advisor.guard(adv[i].advice, x.v); });
}

const head = ['STT', 'Tên bên bán (hóa đơn)', 'Tên người thụ hưởng (UNC)', 'Engine: kết luận', 'Engine: luật', 'Tương đồng %', 'UNC mồ côi',
  'AI: ý kiến', 'AI: quan hệ', 'AI: độ tin', 'AI: giải thích',
  'NHÃN (CUNG / KHAC / LIEN_QUAN / KHONG_RO)', 'Nhóm ca khó (TIENG_ANH / VIET_TAT / ME_CON / DOI_TEN / OCR / KHAC)', 'Ghi chú', 'Số hồ sơ', 'Mã hồ sơ (≤3)'];
const data = rows.map((x, i) => [i + 1, x.v.invoice.raw, x.v.payment.raw, x.v.decision, x.v.reason_code, x.v.score_pct, x.orphan ? 'Có' : '',
  x.ai ? x.ai.verdict : '', x.ai ? x.ai.relation : '', x.ai ? x.ai.confidence : '', x.ai ? x.ai.explanation : '',
  '', '', '', x.cases.size, [...x.cases].slice(0, 3).join(', ')]);
const guide = [['HƯỚNG DẪN GÁN NHÃN'],
  ['Cột NHÃN: CUNG = cùng pháp nhân (kể cả chi nhánh/hộ KD nhận TK chủ hộ) · KHAC = khác pháp nhân · LIEN_QUAN = mẹ↔con/khác chi nhánh nhưng pháp nhân khác · KHONG_RO = không xác định được.'],
  ['Gán theo hiểu biết nghiệp vụ + chứng từ gốc, KHÔNG nhìn cột AI trước (tránh thiên lệch) — có thể ẩn cột H–K khi gán.'],
  ['Ưu tiên gán hết ca KHÔNG KHỚP/CẦN KIỂM TRA; ca KHỚP lấy mẫu để phát hiện khớp nhầm.'],
  ['Xong → chạy: node tools/eval/score.mjs --in <file này> --out <cùng thư mục>']];
const file = join(dir, `BeneMatch_gan_nhan_${today()}.xlsx`);
writeBook(file, { GanNhan: [head, ...data], HuongDan: guide },
  { GanNhan: [5, 45, 45, 12, 30, 10, 8, 16, 16, 8, 50, 20, 20, 25, 8, 30], HuongDan: [140] });
console.log('✓ ' + file);
