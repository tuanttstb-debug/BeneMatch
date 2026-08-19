# DATA_MODEL — BeneMatch (demo store & records)

Store demo = **Google Sheet** (mirror SG). Chỉ synthetic. Số tài khoản luôn **text**.

## Sheet `log` — 1 dòng / lần verify
| Cột | Kiểu | Nguồn | Ghi chú |
|---|---|---|---|
| `timestamp` | datetime | GAS | thời điểm nhận request |
| `request_id` | text | input | truy vết |
| `invoice_name` | text | input | tên hóa đơn (raw) |
| `payment_name` | text | input | tên chuyển tiền (raw) |
| `invoice_account` | **text** | input | giữ số 0 đầu |
| `payment_account` | **text** | input | |
| `decision` | text | response | MATCH/REVIEW/NOT_MATCH |
| `action` | text | response | ALLOW/WARN/BLOCK |
| `risk_level` | text | response | LOW/MEDIUM/HIGH |
| `reason_code` | text | response | reason_codes[0] |
| `name_similarity` | number | response | similarity_score |
| `difference_percentage` | number | response | |
| `invoice_legal_type` | text | response | |
| `payment_legal_type` | text | response | |
| `legal_type_match` | bool | response | |
| `same_account` | bool | response | supporting signal |
| `generated_by_ai` | bool | response | true chỉ khi REVIEW+AI |
| `ai_status` | text | response | SUCCESS/FALLBACK/NOT_INVOKED/INVALID_OUTPUT |
| `warning_code` | text | response | user_warning.warning_code |
| `latency_ms` | number | GAS | đo GAS→Dify→GAS |
| `workflow_version` | text | response | |

## Sheet `config` — key/value (tham chiếu/tuning)
| key | ví dụ | dùng cho |
|---|---|---|
| `threshold_core_sequence` | 0.96 | tham chiếu (nguồn quyết định thật vẫn ở Rule Engine Dify) |
| `threshold_core_token` | 0.90 | |
| `threshold_review_ai` | 0.82 | |
| `feature_ai_warning` | true | bật/tắt nhánh LLM cho demo |
| `demo_mode` | synthetic | chặn nhập dữ liệu thật ở FE |

> **Lưu ý:** để tránh "hai nguồn sự thật", giai đoạn demo **không** để Sheet override threshold chạy thực — Rule Engine trong Dify là nguồn duy nhất. Sheet `config` chỉ để hiển thị/tuning thủ công. Nếu sau này muốn config-driven thật → đẩy threshold vào Dify env/variable, không phải Sheet.

## Record trung gian (trong Dify, không lưu Sheet)
- Normalize: `*_normalized`, `*_core_name`, `*_core_tokens`, `*_name_token_count`.
- Similarity: 6 số + các flag Boolean (xem `NORMALIZATION_SPEC.md`).
- Decision: decision/action/risk/reason_code/ai_eligible/review_mode.

## Ranh giới
- Demo: mọi bản ghi là **synthetic**. Bản thật (tương lai): log vào **ECM/DWH nội bộ**, không Google Sheet công khai (RULE-data-boundary).
