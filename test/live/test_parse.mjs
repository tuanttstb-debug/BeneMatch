// Unit test parseInvoiceText_ — chống lỗi bắt nhầm "thue" làm số hóa đơn (TD-BM-05).
// Chạy: node test/live/test_parse.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseInvoiceText_ } = require('../../gas/OcrService.gs');

const cases = [
  { name: 'so-hoa-don-truoc', text:
`HOA DON GIA TRI GIA TANG
So hoa don: 00012345
Ngay 12 thang 08 nam 2026
Don vi ban hang: CONG TY TNHH ABC VIET NAM
Ma so thue: 0101234567
Tong cong tien thanh toan: 100.000.000 dong` },
  { name: 'ma-so-thue-truoc', text:
`HOA DON GIA TRI GIA TANG
Don vi ban hang: CONG TY TNHH ABC VIET NAM
Ma so thue: 0101234567
So hoa don: 00012345
Ngay 12 thang 08 nam 2026
Tong cong tien thanh toan: 100.000.000 dong` },
];

let ok = 0;
for (const c of cases) {
  const r = parseInvoiceText_(c.text);
  const pass = r.invoice_id === '00012345' && r.beneficiary_mst === '0101234567' && r.amount_total === 100000000;
  if (pass) ok++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.name}: id=${r.invoice_id} mst=${r.beneficiary_mst} amount=${r.amount_total} name="${r.beneficiary_name}"`);
}
console.log(`\n${ok}/${cases.length} OK`);
process.exit(ok === cases.length ? 0 : 1);
