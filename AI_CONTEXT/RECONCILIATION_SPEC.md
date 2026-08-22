# RECONCILIATION_SPEC — BeneMatch (Batch Reconciliation)

Tầng **đối chiếu lô**: nhiều hóa đơn ↔ nhiều lệnh chuyển tiền, gộp theo người thụ hưởng, kiểm tổng tiền + duplicate + khớp tên (qua lõi verify V2). **Deterministic 100%** — không dùng AI ở tầng này; AI (nếu có) chỉ nằm trong verify tên từng cặp (Dify V2, nhánh REVIEW+`ai_eligible`).

**Nguồn:** module `src/recon/` (JS thuần, test offline). Chốt scope 2026-08-22 (phỏng vấn [TT]).

---

## 1. Mô hình dữ liệu vào

### 1.1 Invoice (sau OCR / synthetic — xem `OCR_SPEC.md`)
```jsonc
{
  "invoice_id": "INV-0001",          // số hóa đơn (bắt buộc, để dedup)
  "invoice_date": "2026-08-10",      // ISO; để dedup + truy vết
  "beneficiary_name": "CÔNG TY TNHH ABC VIỆT NAM",
  "beneficiary_mst": "0101234567",   // String; khóa nhóm chính
  "amount_total": 150000000,          // Number VND nguyên (đã gồm VAT)
  "source_file": "abc_hd01.jpg",     // truy vết file gốc
  "ocr_confidence": 0.98              // optional; <ngưỡng → cờ POSSIBLE_OCR_ERROR (A4)
}
```

### 1.2 Transfer order (parse từ CSV/Excel — không OCR)
```jsonc
{
  "transfer_id": "CT-0001",
  "beneficiary_name": "CTY TNHH ABC VIET NAM",
  "beneficiary_mst": "0101234567",   // String
  "account_number": "0123456789",    // String (giữ số 0 đầu) — supporting
  "amount": 150000000                 // Number VND nguyên
}
```

### 1.3 Config (config-driven — C3; xem `src/config/thresholds.json`)
```jsonc
{
  "amount": {
    "abs_tolerance_vnd": 1000,        // lệch tuyệt đối bỏ qua (làm tròn/phí)
    "rel_tolerance": 0.001            // hoặc 0.1% của tổng nhóm; lấy max hai ngưỡng
  },
  "ocr": { "min_confidence": 0.85 },
  "grouping": { "key": "mst_then_name" }, // MST nếu có, else core name
  "severity_weights": { /* xem §5 */ }
}
```

## 2. Chuẩn hóa & khóa nhóm

- **MST normalize:** chỉ giữ chữ số (`\D` → ''); rỗng → coi như thiếu MST.
- **Name normalize:** tái dùng `normalize_name()` + `extract_core_name()` của V2 (`NORMALIZATION_SPEC.md`) — cùng 1 nguồn logic, không viết lại (chống lệch).
- **Group key** (`grouping.key = mst_then_name`):
  - Có MST hợp lệ (≥10 chữ số) → key = `mst`.
  - Thiếu MST → key = `core_name` chuẩn hóa (fallback) + gắn cờ `GROUP_KEY_FALLBACK_NAME` (độ tin thấp hơn).
- Invoice và transfer gộp vào **cùng nhóm** khi cùng group key.

## 3. Đối chiếu theo nhóm (per-group)

Với mỗi nhóm `g`:
1. `sum_invoices = Σ invoice.amount_total`
2. `sum_transfers = Σ transfer.amount`
3. `diff = sum_transfers − sum_invoices`  (dương = **thừa chi/over**, âm = **thiếu chi/under**)
4. `tolerance = max(abs_tolerance_vnd, rel_tolerance × sum_invoices)`
5. **amount_status:**
   - `|diff| ≤ tolerance` → `AMOUNT_MATCH`
   - `diff > tolerance` → `AMOUNT_OVER_TOLERANCE` (chi nhiều hơn hóa đơn)
   - `diff < −tolerance` → `AMOUNT_UNDER_TOLERANCE`
6. **name verify:** gọi Dify V2 (1 cặp) với `invoice_beneficiary_name` = tên đại diện nhóm (invoice), `payment_beneficiary_name` = tên trên transfer cùng nhóm → lấy `decision` (MATCH/REVIEW/NOT_MATCH) + `reason_codes`. *(Offline test: stub trả MATCH; live: HTTP tới Dify.)*
7. **duplicate:** trong nhóm, cảnh báo invoice trùng `invoice_id`, hoặc trùng bộ `(mst, amount_total, invoice_date)` → `DUPLICATE_INVOICE`.
8. **OCR flag (A4):** invoice có `ocr_confidence < min_confidence` hoặc field nghi lỗi (ký tự lạ trong MST/amount) → `POSSIBLE_OCR_ERROR` (chỉ cờ, KHÔNG auto-sửa).

## 4. Nhóm không khớp (unmatched)

- Nhóm có invoice nhưng **không có transfer** → `TRANSFER_MISSING_FOR_GROUP`.
- Transfer có group key **không có invoice** nào → `INVOICE_MISSING_FOR_TRANSFER`.

## 5. Kết cục & mức độ (deterministic aggregation)

Mỗi signal ánh xạ severity; **group decision = xấu nhất** trong các signal của nhóm; **batch decision = xấu nhất** trong các nhóm + unmatched. Thang: `MATCH(0) < REVIEW(1) < NOT_MATCH(2)`.

| Signal / warning_code | decision | action | risk |
|---|---|---|---|
| `AMOUNT_MATCH` + name MATCH + no dup | MATCH | ALLOW | LOW |
| `AMOUNT_OVER_TOLERANCE` (thừa chi) | REVIEW | WARN | HIGH |
| `AMOUNT_UNDER_TOLERANCE` (thiếu chi) | REVIEW | WARN | MEDIUM |
| `DUPLICATE_INVOICE` | REVIEW | WARN | HIGH |
| `TRANSFER_MISSING_FOR_GROUP` | REVIEW | WARN | MEDIUM |
| `INVOICE_MISSING_FOR_TRANSFER` | REVIEW | WARN | HIGH |
| name = REVIEW (V2) | REVIEW | WARN | MEDIUM |
| name = NOT_MATCH (V2, khác pháp nhân) | NOT_MATCH | BLOCK | HIGH |
| `POSSIBLE_OCR_ERROR` | (nâng MATCH→REVIEW nếu đang MATCH) | WARN | MEDIUM |

**Bất biến (kế thừa V2):** khác loại hình pháp nhân → luôn NOT_MATCH; số tài khoản chỉ supporting (khác account **không** tự BLOCK); "lệch tiền" là **cảnh báo**, người duyệt quyết định — hệ thống không tự chặn giải ngân khi chỉ lệch tiền (fail chiều an toàn = REVIEW).

## 6. Output (batch response)

```jsonc
{
  "batch_id": "BM-BATCH-20260822-0001",
  "summary": {
    "decision": "MATCH|REVIEW|NOT_MATCH",
    "action": "ALLOW|WARN|BLOCK",
    "risk_level": "LOW|MEDIUM|HIGH",
    "grand_total_invoices": 0,
    "grand_total_transfers": 0,
    "grand_diff": 0,
    "group_count": 0,
    "warning_count": 0
  },
  "groups": [
    {
      "group_key": "0101234567",
      "key_type": "MST|NAME_FALLBACK",
      "beneficiary_display": "CÔNG TY TNHH ABC VIỆT NAM",
      "invoices": ["INV-0001","INV-0003"],
      "transfers": ["CT-0001"],
      "sum_invoices": 150000000,
      "sum_transfers": 150000000,
      "diff": 0,
      "tolerance": 150000,
      "amount_status": "AMOUNT_MATCH",
      "name_decision": "MATCH",
      "name_reason_codes": ["LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH"],
      "warnings": [ {"code":"…","severity":"…","message":"…"} ],
      "decision": "MATCH", "action": "ALLOW", "risk_level": "LOW"
    }
  ],
  "warnings": [ /* gom toàn batch, sort theo severity desc */ ],
  "audit": {                              // C2 explainability
    "config_version": "1.0",
    "recon_version": "1.0",
    "name_verify_source": "DIFY_V2|STUB",
    "computed_at": "ISO",
    "signal_trace": [ /* mỗi group: các signal + giá trị đầu vào */ ]
  }
}
```

## 7. Bất biến hợp đồng tầng recon
- Số tiền: **Number VND nguyên** (không thập phân, không tách VAT ở lõi demo).
- MST & account: **String**.
- Tầng recon **không gọi AI**; chỉ verify tên đi qua Dify V2 (nơi AI bị giới hạn).
- `diff = transfers − invoices`; dấu dương = thừa chi. Không đổi quy ước này (FE/GAS/harness bám theo).
- Ngưỡng dung sai & trọng số **đọc từ config** (C3) — không hardcode trong logic.

## 8. Ngoài phạm vi (giai đoạn này)
- Auto-match N–N tự do (đã chọn mode **gộp theo người thụ hưởng**; free-reconcile để sau nếu cần).
- Đối chiếu số tài khoản thật (B3b/FCC — Phase 3).
- Sửa lỗi OCR (chỉ gắn cờ — A4).
- Lưu lịch sử xuyên phiên để bắt duplicate liên lô (A3 velocity thật — cần store; demo chỉ trong 1 lô).
