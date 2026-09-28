# BeneMatch

**Kiểm tra người thụ hưởng & chứng từ trước giải ngân — đối chiếu hóa đơn ↔ lệnh chuyển tiền (UNC) của một hồ sơ.**
Bắt: **chi sai người thụ hưởng** (khác pháp nhân / không có trên hóa đơn), **thừa chi**, **hóa đơn trùng**, **hóa đơn không xuất cho KH vay**, tên bị cắt cụt / chi nhánh / tên tiếng Anh cần kiểm tra.
**Kết luận 100% deterministic, dữ liệu không rời máy.** Tùy chọn **AI tư vấn** (GPT-5 qua Dify) cho ca tên khó — chỉ tham khảo, chỉ gửi cặp tên khi cán bộ bấm "Hỏi AI".

## 🔗 Công cụ

👉 **https://tuanttstb-debug.github.io/BeneMatch/**

Chạy hoàn toàn trong trình duyệt: hóa đơn, UNC, thông tin khách hàng **không được gửi đi** và không lưu lại (đóng tab là xóa). Ngoại lệ duy nhất: khi cán bộ bấm **"Hỏi AI"**, riêng **cặp tên** của ca cần kiểm tra được gửi qua cổng BeneMatch (mã truy cập) tới Dify. Thư viện đọc Excel/PDF/ảnh chỉ được tải khi cần; file không bị upload.

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
| `dify/` | Workflow **BeneMatch Name Advisor v3** (LLM tư vấn, sinh từ `build_advisor_dsl.py`). Spec: `AI_CONTEXT/ADVISOR_SPEC.md`. `Beneficiary Legal Entity Verification V2.yml` = baseline cũ để tham chiếu. |
| `tools/eval/` | Đo chất lượng engine + AI trên lịch sử GNOL — chạy trên máy [TT], dữ liệu không vào repo. |

## Phát triển
```bash
node test/engine.test.mjs        # regression gate (133 ca: golden tên, 22 ca khó, parity Python difflib, 9 kịch bản, IO, advisor)
node test/gas_advisor.test.mjs   # GAS proxy AI tư vấn (17 ca, Dify giả lập)
PYTHONUTF8=1 python dify/build_advisor_dsl.py   # sinh workflow Dify
node fe/build.mjs           # sinh docs/ + fe/ + gas/Engine.gs
```
Sửa logic **chỉ** trong `src/engine/bm-engine.js` (không sửa `docs/index.html`, `gas/Engine.gs` — file sinh).

## Dữ liệu
Kịch bản mẫu (`data/synthetic/scenarios.json`) và fixtures (`test/fixtures/`) là **giả lập**. Dữ liệu khách hàng thật **không bao giờ** được commit (xem `.gitignore`).
