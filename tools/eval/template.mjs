/**
 * template.mjs — tạo file Excel MẪU để trích lịch sử GNOL.
 * Chạy: node tools/eval/template.mjs --out "D:\Công việc\BeneMatch_eval"
 */
import { join } from 'path';
import { args, safeOutDir, writeBook } from './lib.mjs';

const a = args();
const dir = safeOutDir(a.out);
const file = join(dir, 'BeneMatch_GNOL_trich_MAU.xlsx');
writeBook(file, {
  HuongDan: [
    ['FILE TRÍCH LỊCH SỬ GNOL — phục vụ đo chất lượng BeneMatch (engine + AI tư vấn)'],
    ['1. Mỗi hồ sơ giải ngân 1 "Mã hồ sơ" (số GNOL). Sheet HoaDon: 1 dòng/hóa đơn. Sheet UNC: 1 dòng/lệnh chuyển tiền.'],
    ['2. Bắt buộc: Mã hồ sơ + Tên bên bán (HoaDon) / Tên người thụ hưởng (UNC). Khác: điền nếu có (MST giúp gộp đúng bên bán).'],
    ['3. Càng nhiều hồ sơ càng tốt (≥ 200 cặp tên). Ưu tiên kỳ gần nhất + các hồ sơ từng bị trả về/hỏi lại vì tên.'],
    ['4. File để LOCAL (ngoài repo). Không gửi file này cho ai — chạy prepare.mjs trên máy.'],
  ],
  HoaDon: [['Mã hồ sơ', 'Tên bên bán', 'MST bên bán', 'Số hóa đơn', 'Tổng tiền'], ['GNOL0001', 'CÔNG TY TNHH ABC VIỆT NAM', '0101234565', '0000101', '100000000']],
  UNC: [['Mã hồ sơ', 'Tên người thụ hưởng', 'Số tài khoản', 'Ngân hàng', 'Số tiền', 'Nội dung'], ['GNOL0001', 'CTY TNHH ABC VN', '0123456789', 'VCB', '100000000', 'TT HD 101']],
}, { HuongDan: [120], HoaDon: [14, 50, 14, 12, 14], UNC: [14, 50, 16, 14, 14, 30] });
console.log('✓ ' + file + '\n  (dòng mẫu là giả lập — xóa đi rồi dán dữ liệu trích từ GNOL)');
