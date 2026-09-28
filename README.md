# BeneMatch

**Kiểm tra người thụ hưởng & chứng từ trước giải ngân — đối chiếu hóa đơn ↔ lệnh chuyển tiền (UNC) của một hồ sơ.**
Bắt: **chi sai người thụ hưởng** (khác pháp nhân / không có trên hóa đơn), **thừa chi**, **hóa đơn trùng**, **hóa đơn không xuất cho KH vay**, tên bị cắt cụt / chi nhánh / tên tiếng Anh cần kiểm tra.
**100% deterministic — không AI, dữ liệu không rời máy.**

## 🔗 Công cụ

👉 **https://tuanttstb-debug.github.io/BeneMatch/**

Chạy hoàn toàn trong trình duyệt: hóa đơn, UNC, thông tin khách hàng **không được gửi đi** và không lưu lại (đóng tab là xóa). Thư viện đọc Excel/PDF/ảnh chỉ được tải khi cần; file không bị upload.

## Cách dùng (4 bước)
1. **Thông tin hồ sơ** — số GNOL, KH vay + MST, ĐVKD, ngày & số tiền giải ngân.
2. **Hóa đơn** — kéo-thả **XML hóa đơn điện tử** (chính xác nhất) · PDF · ảnh (đọc tự động → phải tick "Đã đối chiếu") · dán bảng kê từ Excel · nhập tay.
3. **UNC** — dán danh sách từ Excel (tên người thụ hưởng, STK, ngân hàng, số tiền, nội dung). Không cần MST.
4. **Kiểm tra hồ sơ** → xử lý cảnh báo → **Xuất Excel / In phiếu / Email ĐVKD**.

Tab **Check nhanh tên**: gõ 2 tên → kết luận + mức tương đồng + chi tiết chấm điểm. Tab **Quy tắc**: toàn bộ luật & mã cảnh báo.

## Kiến trúc
| Thành phần | Vai trò |
|---|---|
| `src/engine/bm-engine.js` | **Nguồn logic duy nhất** — chuẩn hóa tên, 10+ luật khớp tên (port Dify V2 + nâng cấp), ghép UNC ↔ bên bán, đối chiếu hồ sơ, đọc bảng/text hóa đơn. Spec: `AI_CONTEXT/ENGINE_V3_SPEC.md`. |
| `fe/index.template.html` → `fe/build.mjs` | Sinh `docs/index.html` (GitHub Pages), `fe/index.html`, `fe/present.html`, `gas/Engine.gs`. |
| `src/config/thresholds.json` | Ngưỡng tên, dung sai tiền, mức cảnh báo. |
| `gas/` | Đường API tùy chọn (Google Apps Script) dùng cùng engine; log Sheet chỉ ghi kết luận, không ghi tên/STK. |
| `Beneficiary Legal Entity Verification V2.yml` | Workflow Dify cũ — **chỉ để tham chiếu**, không còn trên đường quyết định. |

## Phát triển
```bash
node test/engine.test.mjs   # regression gate (81 ca: golden tên, parity Python difflib, 9 kịch bản, IO)
node fe/build.mjs           # sinh docs/ + fe/ + gas/Engine.gs
```
Sửa logic **chỉ** trong `src/engine/bm-engine.js` (không sửa `docs/index.html`, `gas/Engine.gs` — file sinh).

## Dữ liệu
Kịch bản mẫu (`data/synthetic/scenarios.json`) và fixtures (`test/fixtures/`) là **giả lập**. Dữ liệu khách hàng thật **không bao giờ** được commit (xem `.gitignore`).
