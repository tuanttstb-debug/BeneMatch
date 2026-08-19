# TECH DEBT — BeneMatch

Nợ kỹ thuật & hiện tượng lặp lại. Mới nhất trên cùng. ID: `TD-BM-nn`.

**Trạng thái (2026-08-19 #2):** Không phát sinh nợ mới phiên này. **Theo dõi:** Phase 1 sẽ refactor Decision Engine (A1 Risk Aggregation) → chạm cùng vùng code với **TD-BM-01** (Warning Route/`ai_eligible`); cân nhắc **trả TD-BM-01 chung** khi làm A1 để tránh sửa 2 lần. **TD-BM-02** (type `generated_by_ai`) nên gộp vào lần chỉnh `Build API Response` của A1.

## TD-BM-02 — `generated_by_ai` khai báo sai type ở Build API Response (2026-08-19)
**Hiện tượng:** Trong node `Build API Response`, input variable `generated_by_ai` được map với `value_type: string` trong khi bản chất là Boolean (nguồn từ Validate AI Warning / Build Match / Build Not Match).
**Nguyên nhân:** Cấu hình Input Variable trên canvas Dify chọn nhầm kiểu.
**Ảnh hưởng:** Thấp — code Python có `bool(generated_by_ai)` bọc nên không vỡ; nhưng lệch schema, dễ gây hiểu nhầm khi maintain.
**Hướng trả nợ:** Đổi `value_type` sang `boolean` cho đúng. · **Ưu tiên:** thấp.

## TD-BM-01 — Warning Route bỏ qua `ai_eligible`, gọi LLM cho mọi REVIEW (2026-08-19)
**Hiện tượng:** Node `Warning Route` (if-else `1786437733421`) chỉ có 2 case:
- `true`: decision contains `MATCH` → Build Match Message
- case-2: decision contains `NOT_MATCH` → Build Not Match Warning
- `false` (else): → **LLM** → Validate AI Warning

⇒ Mọi `REVIEW` (kể cả `ai_eligible=false`: INSUFFICIENT_DATA, PARTIAL_CORE_NAME_MATCH, LEGAL_TYPE_MISSING_CORE_NAME_MATCH) đều **rơi vào nhánh else và gọi LLM**, trái thiết kế "template deterministic 0 token cho các case này".
**Nguyên nhân:** Nhánh route chưa thêm điều kiện `ai_eligible`; thiếu node "Build Deterministic Review Warning" trong canvas (thiết kế có, as-built chưa dựng).
**Ảnh hưởng:** Trung bình — (1) tốn token LLM không cần thiết; (2) tăng latency & phụ thuộc LLM cho case đã đủ căn cứ cảnh báo bằng template; (3) lệch nguyên tắc tối ưu trong handover (Mục 10 + Bảng "Nguyên tắc tối ưu").
**Hướng trả nợ:** Sửa Warning Route thành 4 nhánh: MATCH → Build Match; NOT_MATCH → Build Not Match; REVIEW & `ai_eligible=false` → Build Deterministic Review Warning (0 token); REVIEW & `ai_eligible=true` → LLM → Validate AI. **Lưu ý:** cân nhắc giữ nguyên trong bản demo để *minh họa rủi ro phát hiện sớm* — quyết định trước khi vá. · **Ưu tiên:** trung/cao.
