# API_CONTRACT — BeneMatch

Hợp đồng I/O giữa GAS ↔ Dify Workflow (và FE ↔ GAS). **Ổn định** — đổi phải bump version + ghi handover.

## Input (START — 5 biến, đều String)
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `request_id` | ✅ | Mã truy vết, vd `GNOL-20260811-000001` |
| `invoice_beneficiary_name` | ✅ | Tên bên thụ hưởng trên **hóa đơn** (nguồn chuẩn) |
| `payment_beneficiary_name` | ✅ | Tên trên **đề nghị chuyển tiền** |
| `invoice_account_number` | ❌ | **String** (giữ số 0 đầu) — supporting signal |
| `payment_account_number` | ❌ | **String** — supporting signal |

Ví dụ (synthetic):
```json
{
  "request_id": "GNOL-20260811-000001",
  "invoice_beneficiary_name": "CÔNG TY TNHH ABC VIỆT NAM",
  "payment_beneficiary_name": "CTY TNHH ABC VIET NAM",
  "invoice_account_number": "0123456789",
  "payment_account_number": "0123456789"
}
```

## Output (OUTPUT.result = object `response`)
```jsonc
{
  "request_id": "…",
  "decision": "MATCH|REVIEW|NOT_MATCH",
  "action": "ALLOW|WARN|BLOCK",
  "risk_level": "LOW|MEDIUM|HIGH",
  "decision_source": "RULE_ENGINE",
  "name_verification": {
    "invoice_name": "…", "payment_name": "…",
    "invoice_normalized": "…", "payment_normalized": "…",
    "similarity_score": 0.0,          // = name_similarity (weighted)
    "name_difference_rate": 0.0,
    "difference_percentage": 0,
    "similarity_details": { "sequence_similarity": 0.0, "token_similarity": 0.0 },
    "invoice_legal_type": "…", "payment_legal_type": "…",
    "legal_type_match": false
  },
  "account_verification": {
    "invoice_account": "…", "payment_account": "…",
    "account_data_available": false,
    "same_account": false,
    "used_for_decision": false          // LUÔN false
  },
  "user_warning": {
    "warning_code": "…", "title": "…", "message": "…",
    "checks_required": ["…"],           // ≤ 3
    "difference_display": "Mức độ khác biệt tên: NN%",
    "difference_metric_note": "…",      // disclaimer: không phải xác suất khác pháp nhân
    "generated_by_ai": false,
    "used_for_decision": false,         // LUÔN false
    "ai_status": "SUCCESS|FALLBACK|NOT_INVOKED|INVALID_OUTPUT"
  },
  "reason_codes": ["…"],
  "workflow_version": "2.0", "rule_engine_version": "1.0",
  "normalization_version": "1.0", "similarity_version": "1.0",
  "ai_warning_version": "2.0.0", "prompt_version": "2.0.0"
}
```

## reason_code (tập giá trị)
`NORMALIZED_NAME_EXACT_MATCH`, `LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH`, `LEGAL_TYPE_AND_CORE_TOKEN_SET_MATCH`, `HIGH_CORE_NAME_SIMILARITY`, `PARTIAL_CORE_NAME_MATCH`, `LEGAL_TYPE_MISSING_CORE_NAME_MATCH`, `NAME_SIMILAR_BUT_NOT_CONCLUSIVE`, `INSUFFICIENT_DATA`, `LEGAL_ENTITY_TYPE_CONFLICT`, `LOW_NAME_SIMILARITY`.

## Bất biến hợp đồng
- `used_for_decision` (account & AI) **luôn false**; `decision_source` luôn `RULE_ENGINE`.
- Account number là **String** ở mọi lớp (FE/GAS/Dify) — không parse Number.
- `checks_required` tối đa 3 phần tử.

## GAS ↔ Dify (tham khảo)
`POST {DIFY_API_URL}/workflows/run` · Header `Authorization: Bearer {DIFY_API_KEY}` · Body `{ "inputs": {…5 biến…}, "response_mode": "blocking", "user": "{request_id}" }` · Đọc `data.outputs.result`.
