# DIFY_WORKFLOW — BeneMatch (as-built)

**Nguồn sự thật:** `Beneficiary Legal Entity Verification V2.yml` (app version 0.7.0, workflow mode, Dify Cloud).
Tài liệu này mô tả **đúng canvas hiện tại**. Chỗ lệch thiết kế được đánh dấu ⚠ và tham chiếu `TECH_DEBT.md`.

## Danh sách node (theo id) & vai trò
| id | Title | Type | Vai trò |
|---|---|---|---|
| 1786418696006 | START | start | Nhận 5 biến input (xem `API_CONTRACT.md`) |
| 1786418729517 | Normalize Names | code | Bỏ dấu, viết tắt pháp lý, `&`, core name/tokens |
| 1786420138295 | Extract Legal Type | code | `legal_type`/`legal_family`; `legal_type_match`/`legal_type_conflict` (Boolean) |
| 1786420298962 | Calculate Similarity | code | sequence/jaccard/containment full+core; weighted `name_similarity`; các flag match |
| 1786437687922 | Calculate Warning Metrics | code | `name_difference_rate`, `difference_percentage`, `difference_display` |
| 1786420410096 | Decision Engine | code | **10 luật** → decision/action/risk/reason_code/**ai_eligible**/review_mode |
| 1786437733421 | Warning Route | if-else | Rẽ nhánh theo `decision` ⚠ (xem dưới) |
| 1786438595926 | Build Match Message | code | Template MATCH (0 token) |
| 1786439414501 | Build Not Match Warning | code | Template NOT_MATCH (0 token) |
| 1786439735565 | LLM | llm | gpt-5, structured output; **chỉ diễn giải** cảnh báo REVIEW |
| 1786441161904 | Validate AI Warning | code | Whitelist `warning_code`; gán `generated_by_ai`/`ai_status`; fallback nếu invalid |
| 1786421027184 | Build API Response | code | Gộp object `response` cuối |
| 1786421797177 | OUTPUT | end | Xuất `result` = response |

## Thứ tự thực thi (edges)
```
START → Normalize → Extract Legal Type → Similarity → Warning Metrics → Decision Engine → Warning Route
Warning Route ─ true (contains MATCH)      → Build Match Message ─┐
              ─ case2 (contains NOT_MATCH)  → Build Not Match     ─┤→ Build API Response → OUTPUT
              ─ false (else)                → LLM → Validate AI   ─┘
```

## ⚠ Warning Route — lệch thiết kế (TD-BM-01)
Canvas hiện chỉ có **2 case** + else:
- `true`: `decision` contains `MATCH` → Build Match Message
- case `d9da26db…`: `decision` contains `NOT_MATCH` → Build Not Match Warning
- `false` (else) → **LLM**

⇒ **Mọi REVIEW đi vào LLM**, kể cả `ai_eligible=false`. Thiết kế đúng (handover Mục 10 / Table 16) phải là **4 nhánh**, thêm "Build Deterministic Review Warning" cho REVIEW+`ai_eligible=false` (0 token). Xem `TECH_DEBT.md`.

## Node LLM (diễn giải, không quyết định)
- Model: `gpt-5`, temperature 0.7, structured output bật.
- **System prompt** ràng buộc: không đổi/không phản biện quyết định REVIEW; không suy đoán chủ TK/MST; không gọi similarity là xác suất; không tạo MATCH/REVIEW/NOT_MATCH/ALLOW/BLOCK; chỉ trả structured output.
- **Output schema:** `{warning_code, warning_title, warning_message, checks_required[≤3]}`.
- `generated_by_ai`/`ai_status` **do Code node gán**, LLM không tự set.

## Validate AI Warning
- Whitelist `warning_code` hợp lệ: `PARTIAL_CORE_NAME_MATCH`, `NAME_SIMILAR_BUT_NOT_CONCLUSIVE`, `INSUFFICIENT_DATA`, `PAYMENT_LEGAL_TYPE_UNKNOWN`, `POSSIBLE_OCR_ERROR`.
- Nếu code/nội dung không hợp lệ → fallback `AI_WARNING_FALLBACK`, `generated_by_ai=false`, `ai_status="INVALID_OUTPUT"`.

## Build API Response — bảo vệ ranh giới AI
- Nếu `decision != REVIEW`: ép `generated_by_ai=false`, `ai_status="NOT_INVOKED"`.
- `ai_used_for_decision = false` (cứng); `account.used_for_decision = false`.
- `decision_source = "RULE_ENGINE"`. Versions: workflow 2.0, rule_engine 1.0, ai_warning 2.0.0.
- ⚠ Input `generated_by_ai` map `value_type: string` (nên là boolean) — TD-BM-02.

## Quy tắc Dify quan trọng
- LLM **chỉ một đường vào** từ nhánh REVIEW mong muốn — không nối trực tiếp node trước vào LLM (tránh Dify chạy LLM ngoài nhánh).
- Decision Engine cần **đủ 17 input**, đúng type; thiếu `legal_type_match` (Boolean) từng gây `main() missing positional argument` (đã fix).
