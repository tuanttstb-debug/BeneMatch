# DECISION_RULES — BeneMatch (Rule Engine)

**Node:** Decision Engine (`1786420410096`). **Nguyên tắc:** quyết định cuối **luôn deterministic**; AI/fuzzy không override. Luật xét **theo thứ tự trên xuống**, trúng luật nào trả luật đó.

## Kết cục & ánh xạ
| decision | action | risk_level | Ý nghĩa |
|---|---|---|---|
| MATCH | ALLOW | LOW | Đủ căn cứ cùng pháp nhân |
| REVIEW | WARN | MEDIUM | Có thể cùng pháp nhân, chưa đủ căn cứ → người dùng kiểm tra |
| NOT_MATCH | BLOCK | HIGH | Có căn cứ khác pháp nhân |

`ai_eligible` (Boolean) + `review_mode` (`NONE`/`DETERMINISTIC_WARNING`/`AI_WARNING`) điều khiển nhánh cảnh báo.

## 10 luật (thứ tự ưu tiên)
| # | Điều kiện chính | decision | reason_code | ai_eligible |
|---|---|---|---|---|
| 1 | Thiếu tên (invoice/payment rỗng) | REVIEW | `INSUFFICIENT_DATA` | false (determ.) |
| 2 | `legal_type_conflict` (khác họ pháp nhân) | NOT_MATCH | `LEGAL_ENTITY_TYPE_CONFLICT` | — (hard rule) |
| 3 | `full_name_exact_match` (trùng sau normalize) | MATCH | `NORMALIZED_NAME_EXACT_MATCH` | — |
| 4 | `legal_type_match` & `core_name_exact_match` & ≥2 token & không tên ngắn | MATCH | `LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH` | — |
| 5 | `legal_type_match` & `same_core_token_set` (khác thứ tự) & ≥2 token & không tên ngắn | MATCH | `LEGAL_TYPE_AND_CORE_TOKEN_SET_MATCH` | — |
| 6 | `legal_type_match` & core_seq≥0.96 & core_token≥0.90 & containment≥0.90 & ≥3 token & không tên ngắn | MATCH | `HIGH_CORE_NAME_SIMILARITY` | — |
| 7 | `short_name_detected` & containment≥1.0 | REVIEW | `PARTIAL_CORE_NAME_MATCH` | false (determ.) |
| 8 | (legal_type UNKNOWN 1 phía) & `core_name_exact_match` & ≥2 token & không tên ngắn | REVIEW | `LEGAL_TYPE_MISSING_CORE_NAME_MATCH` | false (determ.) |
| 9 | name_sim≥0.82 **hoặc** core_seq≥0.82 **hoặc** core_token≥0.75 | REVIEW | `NAME_SIMILAR_BUT_NOT_CONCLUSIVE` | **true (AI)** |
| 10 | còn lại | NOT_MATCH | `LOW_NAME_SIMILARITY` | — |

## Thresholds (⚠ prototype — chưa tuning bằng Golden Dataset)
- MATCH mạnh (luật 6): `core_sequence ≥ 0.96`, `core_token ≥ 0.90`, `core_containment ≥ 0.90`, `min_core_token ≥ 3`.
- REVIEW→AI (luật 9): `name_similarity ≥ 0.82` OR `core_sequence ≥ 0.82` OR `core_token ≥ 0.75`.
- Guard: `min_core_token ≥ 2` cho luật 4/5/8; `short_name_detected` chặn auto-match tên quá ngắn.
- **Mục tiêu tuning:** ưu tiên **False Match thấp** (chặn nhầm ALLOW hơn là REVIEW dư).

## Chỉ once REVIEW mới gọi AI
- `ai_eligible=true` **chỉ** ở luật 9. Các REVIEW còn lại (luật 1,7,8) dùng **template deterministic**.
- ⚠ Warning Route as-built chưa tôn trọng điều này (TD-BM-01) — hiện gọi LLM cho mọi REVIEW.

## Bất biến (không được vi phạm)
- Khác loại hình pháp nhân → **luôn NOT_MATCH** (luật 2 thắng mọi similarity/AI).
- Số tài khoản chỉ **supporting signal**; **khác account KHÔNG** dùng để kết luận NOT_MATCH (`used_for_decision=false`).
- "Tỷ lệ khác biệt tên" = khác biệt kỹ thuật sau chuẩn hóa, **không phải** xác suất khác pháp nhân, **không** xác minh chủ tài khoản.
