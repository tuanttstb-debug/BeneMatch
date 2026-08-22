# DIFY_OPTIMIZATION — BeneMatch (rule-first, minimize AI)

Kế hoạch tối ưu workflow Dify V2 theo hướng **rule tự xử lý tối đa, chỉ call AI khi thực sự cần** (chốt [TT] 2026-08-22: *Rule 100%, LLM chỉ khi REVIEW & `ai_eligible=true`*). Đồng thời trả 2 nợ **TD-BM-01** + **TD-BM-02**.

**Nguồn sự thật:** `Beneficiary Legal Entity Verification V2.yml` (backup: `*.BACKUP-20260822.yml`).

## 1. Vấn đề hiện tại (as-built)
`Warning Route` (if-else `1786437733421`) chỉ 2 case + else:
- `MATCH` → Build Match (0 token)
- `NOT_MATCH` → Build Not Match (0 token)
- **else (mọi REVIEW)** → **LLM** → Validate AI

⇒ Mọi REVIEW gọi LLM, kể cả `ai_eligible=false` (INSUFFICIENT_DATA, PARTIAL_CORE_NAME_MATCH, LEGAL_TYPE_MISSING_CORE_NAME_MATCH). Lãng phí token + latency + phụ thuộc AI không cần thiết.

Theo `DECISION_RULES.md`: chỉ **luật 9** (`NAME_SIMILAR_BUT_NOT_CONCLUSIVE`) đặt `ai_eligible=true`. Các REVIEW còn lại (luật 1, 7, 8) đáng lẽ dùng template deterministic 0 token.

## 2. Thiết kế đích — Warning Route 4 nhánh
```
Decision Engine → Warning Route
  ├ case A: decision contains "MATCH"      → Build Match Message        (0 token)
  ├ case B: decision contains "NOT_MATCH"  → Build Not Match Warning    (0 token)
  ├ case C: decision == "REVIEW" AND ai_eligible == false
  │                                        → Build Deterministic Review (0 token)  ★ NODE MỚI
  └ else  : decision == "REVIEW" AND ai_eligible == true
                                           → LLM → Validate AI Warning  (AI)
  (A|B|C|Validate AI) → Build API Response → OUTPUT
```

**Thứ tự điều kiện quan trọng** (Dify eval trên xuống): MATCH → NOT_MATCH → (REVIEW & !ai_eligible) → else(REVIEW & ai_eligible). Vì đã lọc MATCH/NOT_MATCH ở trên, case C chỉ cần điều kiện `ai_eligible == false`.

## 3. Node mới — Build Deterministic Review Warning
- **Type:** code (python), 0 token.
- **Vào:** `decision`, `reason_codes`/`reason_code`, `difference_percentage`, `difference_display`, các flag cần cho message.
- **Ra:** cùng shape với Build Match/Not Match để Build API Response gộp thống nhất: `warning_code, warning_title, warning_message, checks_required[≤3], generated_by_ai=false, ai_status="NOT_INVOKED"`.
- **Template theo reason_code:**
  - `INSUFFICIENT_DATA` → "Thiếu dữ liệu tên bên thụ hưởng để đối chiếu" + checks: bổ sung tên đầy đủ.
  - `PARTIAL_CORE_NAME_MATCH` → "Tên khớp một phần (tên rút gọn/chứa nhau)" + checks: xác minh tên pháp lý đầy đủ.
  - `LEGAL_TYPE_MISSING_CORE_NAME_MATCH` → "Lõi tên trùng nhưng thiếu loại hình pháp nhân một phía" + checks: xác nhận loại hình.
  - fallback → template REVIEW chung.

## 4. Fix TD-BM-02 — kiểu `generated_by_ai`
- Node `Build API Response`: input var `generated_by_ai` đổi `value_type: string` → `boolean`. Giữ `bool()` bọc phòng thủ. Không đổi hành vi, chỉ đúng schema.

## 5. Bất biến khi sửa (KHÔNG được vỡ)
- LLM **chỉ một đường vào** — từ nhánh else (REVIEW & ai_eligible=true). Không nối node khác thẳng vào LLM (tránh Dify chạy LLM ngoài nhánh).
- Decision Engine vẫn đủ **17 input** đúng type.
- `Build API Response` giữ: `decision_source="RULE_ENGINE"`, `used_for_decision=false` (account & AI), versions. Với nhánh C: `ai_status="NOT_INVOKED"`, `generated_by_ai=false`.
- Output contract (`API_CONTRACT.md`) **không đổi field cũ** — chỉ đảm bảo REVIEW-deterministic không còn cờ AI sai.

## 6. Hiệu quả kỳ vọng (token profile)
| Case | as-built | sau tối ưu |
|---|---|---|
| MATCH | 0 | 0 |
| NOT_MATCH | 0 | 0 |
| REVIEW & ai_eligible=false (luật 1,7,8) | **LLM (tốn token)** | **0 token (template)** |
| REVIEW & ai_eligible=true (luật 9) | LLM | LLM |
⇒ Chỉ **luật 9** còn chạm LLM. Ước lượng phần lớn REVIEW chuyển về 0 token; latency giảm; hết phụ thuộc AI cho case đã đủ căn cứ.

## 7. Cách sửa an toàn (Task #4)
1. Đã backup yml gốc.
2. Đọc block node `Warning Route` + `LLM` + edges trong yml → thêm case C + node code mới + 2 edge (Warning Route→node mới, node mới→Build API Response).
3. Validate YAML parse được (không vỡ cấu trúc), đối chiếu số node/edge tăng đúng (+1 node, +2 edge, +1 case).
4. **Không tự import lên Dify Cloud** — [TT] import + smoke-test 4 nhánh (đặc biệt REVIEW luật 1/7/8 = 0 token, luật 9 = có narrative).

## 8. Cần [TT] làm sau khi sửa file
- Import yml đã tối ưu lên Dify Cloud, kiểm 4 nhánh.
- Cung cấp **DIFY_API_URL + DIFY_API_KEY** (workflow API) để GAS gọi verify tên từng nhóm.

## 9. Phát sinh khi sửa (2026-08-22)

### TD-BM-03 (MỚI) — Warning Route dùng `contains` gây misroute NOT_MATCH → Build Match
Case 1 as-built: `decision contains "MATCH"`. Nhưng chuỗi **`"NOT_MATCH"` chứa substring `"MATCH"`**, và case 1 xét **trước** case 2 → **mọi NOT_MATCH rơi vào Build Match Message** (routing sai). Đây là lỗi tiềm ẩn ngoài TD-BM-01. **Đã sửa** trong cùng lần tối ưu: đổi cả 2 case sang `comparison_operator: is` (khớp chính xác), không còn substring. **[TT] khi import phải smoke-test riêng ca NOT_MATCH** (Delta Mekong / khác loại hình) để xác nhận đi đúng Build Not Match.

### Cách nội dung cảnh báo được tạo (đã kiểm bằng đọc code)
`Build API Response` tính `warning_valid = code&title&message`. Các nhánh **không-AI** để title/message rỗng (chỉ Validate AI mới điền đủ) → luôn rơi vào **`build_fallback_warning(decision, reason_code, …)`** (deterministic, đã có sẵn, xử lý đúng MATCH/NOT_MATCH/LEGAL_ENTITY_TYPE_CONFLICT + catch-all REVIEW theo `reason_code`). ⇒ Nhánh REVIEW-deterministic mới trả nội dung qua `build_fallback_warning` (0 token), **đúng & xác định**. Node `Build Deterministic Review Warning` đóng vai **đích route** (như Build Not Match — output không được Build API Response đọc trực tiếp; giữ cùng schema cho nhất quán/tương lai).

### Residual (thấp)
- Nhánh REVIEW-deterministic hiện có `ai_status="FALLBACK"` (từ catch-all `build_fallback_warning`) thay vì `"NOT_INVOKED"` — lệch nhãn nhẹ, không ảnh hưởng quyết định. Template giàu hơn trong node mới **chưa** hiển thị ra response (do Build API Response single-source). Muốn dùng template node mới cần refactor phần hội tụ biến của Build API Response (rủi ro cao hơn) — để sau nếu cần.

### Đã verify (offline, không cần Dify Cloud)
YAML parse OK (js-yaml); nodes 13→14, edges 14→16; Warning Route 3 case toàn `is`; case 3 `review_mode is DETERMINISTIC_WARNING`; **LLM chỉ 1 edge vào** (else `false`) — giữ bất biến; `generated_by_ai` → boolean; code node mới compile + chạy đúng (Python). **Chưa** import Dify Cloud (chờ [TT]).
