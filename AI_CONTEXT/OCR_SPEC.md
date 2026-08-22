# OCR_SPEC — BeneMatch (Invoice ingestion, hybrid)

Bóc dữ liệu hóa đơn từ file đính kèm. **Kiến trúc hybrid** (chốt 2026-08-22): đường **OCR thật** (GAS + Google Vision) + đường **synthetic fixtures** cùng schema — chuyển bằng cờ `USE_OCR`, để demo chạy được ngay cả khi chưa có API key.

## 1. Nguyên tắc
- **Cùng một schema đầu ra** cho cả 2 đường (§2) → recon engine không cần biết nguồn.
- OCR **không nằm trên lõi verify**: bóc xong trả JSON có cấu trúc; verify tên vẫn do Dify V2 (rule-first). → giữ đúng hướng "rule tự xử lý tối đa, không call AI".
- **KHÔNG auto-sửa lỗi OCR** (V1ET→VIET…) khi chưa có whitelist ngữ cảnh — chỉ **gắn cờ** `POSSIBLE_OCR_ERROR` (A4).
- Ảnh/PDF hóa đơn thật = **dữ liệu nhạy cảm** → không commit, không đưa lên artifact. Chỉ synthetic được publish.

## 2. Schema đầu ra 1 hóa đơn
Xem `RECONCILIATION_SPEC.md §1.1`. Trường bắt buộc để matching + validate (chốt phỏng vấn):
- `beneficiary_name` (tên người bán/thụ hưởng)
- `beneficiary_mst` (String, khóa nhóm)
- `amount_total` (Number VND nguyên, đã gồm VAT)
- `invoice_id` (số hóa đơn) + `invoice_date` (dedup)
- `ocr_confidence` (optional), `source_file`

*(Bỏ khỏi lõi demo: tách tiền hàng/VAT riêng, số tài khoản trên hóa đơn — thêm sau nếu cần.)*

## 3. Đường A — OCR thật (GAS + Google Vision)
```
FE (upload ảnh/PDF) → GAS doPost (base64) → OcrService.gs
   → Vision API (DOCUMENT_TEXT_DETECTION) → text
   → parseInvoiceText_() (regex trường VN: "Mã số thuế", "Tổng cộng tiền thanh toán", "Số HĐ", "Ngày")
   → { invoice fields } + ocr_confidence từ Vision
```
- **Cần [TT] cung cấp:** Google Cloud Vision API key (hoặc bật Drive OCR), quota.
- Regex trích trường theo mẫu hóa đơn VAT VN (song ngữ). `parseInvoiceText_` để riêng, unit-test bằng text mẫu.
- MST: bắt `\b\d{10}(-\d{3})?\b` gần nhãn "Mã số thuế". Amount: bắt số gần "Tổng cộng tiền thanh toán / Total payment", loại dấu phân tách nghìn.

## 4. Đường B — Synthetic fixtures (mặc định demo)
- File `data/synthetic/invoices.json` = mảng object đúng schema §2 (mô phỏng "đã OCR").
- Cờ `USE_OCR=false` → GAS/harness đọc thẳng fixtures (bỏ qua Vision).
- Dùng cho: FE demo không cần key, regression harness, artifact publish.

## 5. Cờ chuyển & config
```jsonc
// trong GAS Script Properties hoặc config
{ "USE_OCR": false, "VISION_API_KEY": "", "OCR_MIN_CONFIDENCE": 0.85 }
```
- `USE_OCR=false` (mặc định): synthetic. `true`: gọi Vision (cần key).
- Confidence < `OCR_MIN_CONFIDENCE` → gắn `POSSIBLE_OCR_ERROR`, nâng nhóm MATCH→REVIEW (không loại).

## 6. Kiểm thử
- `parseInvoiceText_` test bằng vài block text hóa đơn mẫu (synthetic) → assert đúng field.
- Đường synthetic: recon harness chạy trực tiếp trên `invoices.json`.
- Đường thật: chỉ smoke-test khi có key ([TT] cung cấp) — không đưa ảnh thật vào repo.

## 7. Cần [TT] cung cấp (đường OCR thật)
1. **Google Vision API key** (hoặc xác nhận dùng Drive OCR) + quota.
2. Vài **ảnh/PDF hóa đơn mẫu** (có thể là synthetic/ẩn thông tin) để hiệu chỉnh regex `parseInvoiceText_`.
3. Xác nhận mẫu hóa đơn (VAT điện tử VN?) để chốt nhãn trường cần bắt.
