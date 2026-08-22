import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { parseInvoiceText_ } = require(join(__dirname, 'OcrService.gs'));

const sample = `HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ngày 10 tháng 08 năm 2026
Số: 00001234
Đơn vị bán hàng: CÔNG TY TNHH ABC VIỆT NAM
Mã số thuế: 0101234567
Địa chỉ: 123 Đường XYZ, Hà Nội
Tổng cộng tiền thanh toán: 150.000.000 đồng`;

const r = parseInvoiceText_(sample);
console.log(JSON.stringify(r, null, 2));
let ok = true;
const check = (n, got, exp) => { const p = got === exp; console.log((p?'✓':'✗'), n, `got=${got}`); if(!p) ok=false; };
check('mst', r.beneficiary_mst, '0101234567');
check('amount', r.amount_total, 150000000);
check('date', r.invoice_date, '2026-08-10');
check('invoice_id', r.invoice_id, '00001234');
check('name', r.beneficiary_name, 'CÔNG TY TNHH ABC VIỆT NAM');
process.exit(ok?0:1);
