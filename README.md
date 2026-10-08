# BeneMatch

**Kiểm tra người thụ hưởng & chứng từ trước giải ngân — đối chiếu hóa đơn ↔ lệnh chuyển tiền (UNC) của một hồ sơ.**
Bắt: **chi sai người thụ hưởng** (khác pháp nhân / không có trên hóa đơn), **thừa chi**, **hóa đơn trùng**, **hóa đơn không xuất cho KH vay**, tên bị cắt cụt / chi nhánh / tên tiếng Anh cần kiểm tra.
**Kết luận 100% deterministic, dữ liệu không rời máy.** **OCR PDF scan/ảnh chạy ngay trên máy** (thư viện nhúng sẵn). Tùy chọn **AI tư vấn** cho ca tên khó qua cổng GAS — hiện dùng Gemini (chạy thử, chỉ tên giả lập/ẩn danh), khi tích hợp thay bằng AI nội bộ TPBank — chỉ tham khảo, chỉ gửi cặp tên khi cán bộ bấm "Hỏi AI".

## 🔗 Công cụ

👉 **https://tuanttstb-debug.github.io/BeneMatch/**

Chạy hoàn toàn trong trình duyệt: hóa đơn, UNC, thông tin khách hàng **không được gửi đi** và không lưu lại (đóng tab là xóa). Ngoại lệ duy nhất: khi cán bộ bấm **"Hỏi AI"**, riêng **cặp tên** của ca cần kiểm tra được gửi qua cổng BeneMatch (GAS, mã truy cập) tới mô hình AI. Thư viện đọc Excel/PDF/ảnh (OCR tiếng Việt) **nhúng sẵn** — không tải từ Internet, file không bị upload; trang chặn mọi kết nối mạng khác (CSP).

Bản gửi nội bộ (1 file, mở thẳng bằng Chrome/Edge, không cần mạng): `fe/index.html` sinh bởi `node fe/build.mjs` (~8,5 MB).

## Cách dùng (4 bước)
1. **Thông tin hồ sơ** — số GNOL, KH vay + MST, ĐVKD, ngày & số tiền giải ngân.
2. **Hóa đơn** — kéo-thả **XML hóa đơn điện tử** (chính xác nhất) · PDF · ảnh (đọc tự động → phải tick "Đã đối chiếu") · dán bảng kê từ Excel · nhập tay.
3. **UNC** — dán danh sách từ Excel (tên người thụ hưởng, STK, ngân hàng, số tiền, nội dung). Không cần MST.
4. **Kiểm tra hồ sơ** → xử lý cảnh báo → **Xuất Excel / In phiếu / Email ĐVKD**.

Tab **Check nhanh tên**: gõ 2 tên → kết luận + mức tương đồng + chi tiết chấm điểm. Tab **Quy tắc**: toàn bộ luật & mã cảnh báo.

## Kiến trúc
| Thành phần | Vai trò |
|---|---|
| `src/engine/bm-engine.js` | **Nguồn logic duy nhất** — chuẩn hóa tên, 10+ luật khớp tên, ghép UNC ↔ bên bán, đối chiếu hồ sơ, đọc bảng/text hóa đơn, **prompt + schema + lớp gác AI** (`BM.advisor`). Spec: `AI_CONTEXT/ENGINE_V3_SPEC.md`. |
| `src/ocr/scan_lib.js` | OCR offline (pdf.js + tesseract nhúng, tự xoay trang, xoá đường kẻ) — chép từ công cụ ẩn danh v3.6 (AIOS). |
| `fe/index.template.html` → `fe/build.mjs` | Sinh `docs/index.html` + `docs/bm-vendor.js` (GitHub Pages), `fe/index.html` (1 file offline), `fe/present.html`, `gas/Engine.gs`. Thư viện lấy từ `node_modules` (`npm ci`). |
| `src/config/thresholds.json` | Ngưỡng tên, dung sai tiền, mức cảnh báo. |
| `gas/Code.gs` | **Cổng logic + AI** (Google Apps Script): mã truy cập, hạn mức, tự tính lại engine, adapter AI `gemini` / `openai_compat` (AI nội bộ TPB), gác, log không tên. API `reconcile` / `verify_name` cho tích hợp. Hợp đồng cho IT: `AI_CONTEXT/AI_INTEGRATION_CONTRACT.md`. |
| `_archive/dify/` | Workflow Dify V2/V3 cũ — không còn dùng (từ 2026-10-08). |
| `tools/eval/` | Đo chất lượng engine + AI trên lịch sử GNOL — chạy trên máy [TT], dữ liệu không vào repo. |

## Phát triển
```bash
npm ci                           # 1 lần: thư viện nhúng offline (pdf.js, tesseract + tiếng Việt, SheetJS) + puppeteer-core
node test/engine.test.mjs        # regression gate (140 ca: golden tên, 22 ca khó, parity Python difflib, 9 kịch bản, IO, advisor + prompt/schema)
node test/gas_advisor.test.mjs   # cổng GAS + adapter AI (42 ca: Gemini + openai_compat giả lập)
node fe/build.mjs                # sinh docs/ + fe/ + gas/Engine.gs
node tools/dev/ui_smoke.mjs      # Chrome thật: OCR scan/xoay/ảnh/PDF/XML · 0 request mạng · thẻ AI 2 chế độ (16 ca)
```
Sửa logic **chỉ** trong `src/engine/bm-engine.js` (không sửa `docs/index.html`, `gas/Engine.gs` — file sinh).

## Dữ liệu
Kịch bản mẫu (`data/synthetic/scenarios.json`) và fixtures (`test/fixtures/`) là **giả lập**. Dữ liệu khách hàng thật **không bao giờ** được commit (xem `.gitignore`).
