# TECH DEBT — BeneMatch

Nợ kỹ thuật & hiện tượng lặp lại. Mới nhất trên cùng. ID: `TD-BM-nn`.

**Trạng thái (2026-09-04 #3) — Định dạng số tiền + đổi quy tắc rủi ro:** Không nợ mới. CR2 chạm engine (`gas/Recon.gs`+`src/recon/reconcile.js`) — **parity OK + harness 14/14** (cập nhật 2 EXPECT). Quy tắc mới: chỉ **thừa chi** (ΣCT>ΣHĐ) + **chi thiếu hóa đơn** là rủi ro; ΣHĐ>ΣCT và hóa-đơn-chưa-chi KHÔNG cảnh báo. **Deploy-gated:** [TT] redeploy `Recon.gs` để áp trên đường GAS live (demo public offline đã áp qua build). Các code `TRANSFER_MISSING_FOR_GROUP`/`AMOUNT_UNDER_TOLERANCE` còn trong `WARN_META` (không push nữa) — vô hại, giữ để tương thích/tham chiếu.

**Trạng thái (2026-09-04 #2) — Form tự nhập nhanh (thuần FE):** Không nợ mới. Form nhập trường đơn dùng chung đường `runOffline` (không tạo path recon thứ 2), 0 đụng engine/GAS (recon 14/14). Ghi chú (không phải nợ): hiện hỗ trợ **1↔1** và **nhiều HĐ↔1 lệnh**; chiều "nhiều lệnh↔1 HĐ" chưa có (tùy chọn tương lai). Số tiền nhập tự do (parse bỏ ký tự lạ).

**Trạng thái (2026-09-04) — CR Email cảnh báo ĐVKD (thuần FE):** Không nợ mới. Thuần trình bày FE (`index.template.html`+`scenarios.json`), 0 đụng engine/GAS (recon 14/14). Đã **fix** overflow ngang tiềm ẩn (`.grid>.card{min-width:0}` — cột 1fr từng nở theo min-content thẻ email). Ghi chú (không phải nợ): số **GNOL/khoản vay là synthetic deterministic** từ `group_key` (đủ cho demo); nếu cần số thật theo nhà cung cấp → thêm field vào invoice/transfer data. TD-BM-05/06 dưới đây giữ nguyên.

**Trạng thái (2026-08-31) — [TT] redeploy GAS + smoke test XONG:** ✅ **TD-BM-05 phần deploy-gated ĐÓNG** — `OcrService.gs` (vá `parseInvoiceText_` yêu cầu số HĐ chứa chữ số) đã redeploy trên live; nghiệm thu LIVE Drive OCR bóc đúng tên/MST/tiền → MATCH. **Còn tồn (KHÔNG đóng được bằng deploy):** regex vẫn theo mẫu VAT chung — layout hóa đơn khác có thể cần chỉnh; cần [TT] cấp thêm ảnh mẫu đa layout (ẩn thông tin) để hiệu chỉnh (ưu tiên trung, chỉ đường OCR thật). 🆕 **TD-BM-06 vẫn mở** — node LLM Dify FALLBACK: gắn credential model gpt-5 là **việc phía workspace Dify của [TT]**, không phải nợ code repo; quyết định deterministic vẫn đúng.

**Trạng thái (2026-08-27):** Pivot demo public. 🔧 **TD-BM-05 vá phần lớn** — `parseInvoiceText_` yêu cầu số hóa đơn chứa chữ số (hết bắt nhầm "thue"); nghiệm thu LIVE Drive OCR bóc đúng tên/MST/tiền → MATCH; test_parse 2/2. **Còn:** cần [TT] redeploy `OcrService.gs` để áp vá; regex vẫn theo mẫu VAT chung, mẫu layout khác có thể cần chỉnh tiếp. 🆕 **TD-BM-06** (node LLM Dify trả FALLBACK/timeout — chưa gắn model credential, việc phía Dify; không ảnh hưởng quyết định deterministic). Đường **OCR nay có bản MIỄN PHÍ** (Google Drive OCR, `OCR_PROVIDER=drive`) — giảm phụ thuộc Vision trả phí. Demo public offline-only nên **không** phát sinh nợ backend cho trang nhân sự.

## TD-BM-06 — Node LLM Dify trả FALLBACK (chưa gắn model credential) (2026-08-27)
Ca REVIEW + `ai_eligible=true` (luật 9, `NAME_SIMILAR_BUT_NOT_CONCLUSIVE`) route đúng sang nhánh AI, nhưng node LLM trên Dify Cloud trả `ai_status="FALLBACK"` sau ~93s (timeout) → dùng template deterministic thay vì AI diễn giải. **Nguyên nhân:** workflow chưa gắn credential model gpt-5 (hoặc plugin openai chưa cấu hình) trên workspace Dify của [TT]. **Ảnh hưởng:** thấp — quyết định vẫn deterministic đúng; chỉ mất phần diễn giải AI cho ~<10% ca REVIEW + latency cao. **Hướng:** [TT] gắn credential model trong workflow Dify. Quan sát bằng route debug `verify_name` (`ai_status`/`generated_by_ai`). Ưu tiên thấp.

**Trạng thái (2026-08-22):** Scope Batch Reconciliation. ✅ **TD-BM-01 GIẢI QUYẾT** (Warning Route 4 nhánh, LLM chỉ REVIEW+ai_eligible=true qua `review_mode is DETERMINISTIC_WARNING`). ✅ **TD-BM-02 GIẢI QUYẾT** (`generated_by_ai` → boolean). 🆕 **TD-BM-03** (phát hiện + đã vá: Warning Route dùng `contains "MATCH"` misroute NOT_MATCH → Build Match; đổi sang `is`). 🆕 **TD-BM-04** (ai_status "FALLBACK" cho nhánh REVIEW-deterministic — nhãn nhẹ) + **TD-BM-05** (OCR regex `parseInvoiceText_` cần hiệu chỉnh bằng ảnh mẫu thật). Các nợ mới đều **thấp**. ⚠ Toàn bộ thay đổi Dify **chưa import Dify Cloud** — [TT] phải import + smoke-test.

## TD-BM-05 — OCR parseInvoiceText_ regex chưa hiệu chỉnh mẫu thật (2026-08-22)
`gas/OcrService.gs::parseInvoiceText_` bắt trường (tên/MST/tiền/số HĐ/ngày) bằng regex theo mẫu hóa đơn VAT VN chung; đã test 1 text mẫu synthetic (5/5 field đúng) nhưng **chưa** chạy trên hóa đơn thật đa mẫu → nhiều layout có thể trượt. **Hướng:** [TT] cấp vài ảnh/PDF hóa đơn mẫu (ẩn thông tin) → hiệu chỉnh regex; cân nhắc bắt theo vùng toạ độ Vision thay vì text thuần. Ưu tiên trung (chỉ ảnh hưởng đường OCR thật; đường synthetic không dùng).

## TD-BM-04 — Nhánh REVIEW-deterministic trả ai_status "FALLBACK" (2026-08-22)
Sau khi định tuyến REVIEW+ai_eligible=false sang node `Build Deterministic Review Warning`, nội dung cảnh báo thực tế do `build_fallback_warning()` (trong Build API Response) sinh (vì Build API Response single-source biến warning) → `ai_status="FALLBACK"` thay vì `"NOT_INVOKED"`, và template giàu hơn trong node mới không hiển thị ra response. Không ảnh hưởng quyết định/độ chính xác; chỉ lệch nhãn. **Hướng:** refactor phần hội tụ biến của Build API Response để đọc warning từ đúng nhánh (rủi ro cao hơn) — để sau nếu cần nhãn chuẩn. Ưu tiên thấp.

## TD-BM-03 — Warning Route dùng `contains "MATCH"` misroute NOT_MATCH (2026-08-22 → ĐÃ VÁ)
As-built: case 1 `decision contains "MATCH"` xét trước case 2. Vì chuỗi `"NOT_MATCH"` **chứa** substring `"MATCH"`, mọi NOT_MATCH rơi vào case 1 → **Build Match Message** (routing sai). **Đã vá** cùng lần tối ưu 2026-08-22: đổi cả 2 case sang `comparison_operator: is` (khớp chính xác). **Kiểm khi import:** [TT] smoke-test riêng ca NOT_MATCH (khác loại hình pháp nhân) để chắc đi đúng Build Not Match. Xem `DIFY_OPTIMIZATION.md §9`.
 **Theo dõi:** Phase 1 sẽ refactor Decision Engine (A1 Risk Aggregation) → chạm cùng vùng code với **TD-BM-01** (Warning Route/`ai_eligible`); cân nhắc **trả TD-BM-01 chung** khi làm A1 để tránh sửa 2 lần. **TD-BM-02** (type `generated_by_ai`) nên gộp vào lần chỉnh `Build API Response` của A1.

## ✅ TD-BM-02 — `generated_by_ai` khai báo sai type ở Build API Response (2026-08-19 → GIẢI QUYẾT 2026-08-22)
**Đã sửa:** `value_type: string` → `boolean` trong Build API Response (yml). Giữ `bool()` bọc phòng thủ.

**Hiện tượng:** Trong node `Build API Response`, input variable `generated_by_ai` được map với `value_type: string` trong khi bản chất là Boolean (nguồn từ Validate AI Warning / Build Match / Build Not Match).
**Nguyên nhân:** Cấu hình Input Variable trên canvas Dify chọn nhầm kiểu.
**Ảnh hưởng:** Thấp — code Python có `bool(generated_by_ai)` bọc nên không vỡ; nhưng lệch schema, dễ gây hiểu nhầm khi maintain.
**Hướng trả nợ:** Đổi `value_type` sang `boolean` cho đúng. · **Ưu tiên:** thấp.

## ✅ TD-BM-01 — Warning Route bỏ qua `ai_eligible`, gọi LLM cho mọi REVIEW (2026-08-19 → GIẢI QUYẾT 2026-08-22)
**Đã sửa:** Warning Route nay 4 nhánh — MATCH/NOT_MATCH (`is`), REVIEW+`review_mode is DETERMINISTIC_WARNING` → node mới `Build Deterministic Review Warning` (0 token), else (AI_WARNING) → LLM. LLM chỉ còn 1 edge vào. Chi tiết `DIFY_OPTIMIZATION.md`. (nội dung gốc bên dưới để tham chiếu)

**Hiện tượng:** Node `Warning Route` (if-else `1786437733421`) chỉ có 2 case:
- `true`: decision contains `MATCH` → Build Match Message
- case-2: decision contains `NOT_MATCH` → Build Not Match Warning
- `false` (else): → **LLM** → Validate AI Warning

⇒ Mọi `REVIEW` (kể cả `ai_eligible=false`: INSUFFICIENT_DATA, PARTIAL_CORE_NAME_MATCH, LEGAL_TYPE_MISSING_CORE_NAME_MATCH) đều **rơi vào nhánh else và gọi LLM**, trái thiết kế "template deterministic 0 token cho các case này".
**Nguyên nhân:** Nhánh route chưa thêm điều kiện `ai_eligible`; thiếu node "Build Deterministic Review Warning" trong canvas (thiết kế có, as-built chưa dựng).
**Ảnh hưởng:** Trung bình — (1) tốn token LLM không cần thiết; (2) tăng latency & phụ thuộc LLM cho case đã đủ căn cứ cảnh báo bằng template; (3) lệch nguyên tắc tối ưu trong handover (Mục 10 + Bảng "Nguyên tắc tối ưu").
**Hướng trả nợ:** Sửa Warning Route thành 4 nhánh: MATCH → Build Match; NOT_MATCH → Build Not Match; REVIEW & `ai_eligible=false` → Build Deterministic Review Warning (0 token); REVIEW & `ai_eligible=true` → LLM → Validate AI. **Lưu ý:** cân nhắc giữ nguyên trong bản demo để *minh họa rủi ro phát hiện sớm* — quyết định trước khi vá. · **Ưu tiên:** trung/cao.
