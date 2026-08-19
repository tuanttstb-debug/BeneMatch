# FEATURE_ROADMAP — BeneMatch

**Cập nhật:** 2026-08-19 · **Trạng thái:** đề xuất (chờ chốt ưu tiên).
**Mục tiêu:** tiến hóa BeneMatch từ "1 phép so tên bên thụ hưởng" → **dịch vụ sàng lọc rủi ro đối tác thanh toán** (Beneficiary & Counterparty Risk Screening), phục vụ **nhận diện rủi ro tự động** và **mở rộng các bên liên quan**, vẫn giữ **deterministic-first** (AI không quyết định).

---

## 0. Định hướng (vision)
Hôm nay: input 2 tên → Rule Engine → 1 `decision`. Đủ cho 1 chốt kiểm, nhưng khi tích hợp rộng vào luồng tín dụng thì rủi ro không chỉ nằm ở "tên bên thụ hưởng".

Định hướng: giữ nguyên lõi so tên (đã ổn), **bọc thêm một tầng "Risk Aggregation"** gom nhiều **signal** độc lập (mỗi signal deterministic, có `reason_code` + trọng số), sinh **risk_score + risk_band + contributing_signals[]**. Hard rules (khác pháp nhân) vẫn override. Mở rộng đối tượng so khớp từ "2 tên" → **N thực th/bên qua M chứng từ** (configurable party roles). Điều này biến BeneMatch thành **API sàng lọc dùng chung**, khớp mục tiêu "nhận diện rủi ro sớm khi tích hợp rộng hơn".

**Bất biến giữ nguyên:** quyết định cuối do Rule Engine deterministic; AI chỉ diễn giải (`used_for_decision=false`); khác loại hình pháp nhân → NOT_MATCH; account chỉ supporting signal (khác account **không** tự block); dữ liệu nhạy cảm không lên cloud/artifact; **không** RAG/vector/fine-tuning/autonomous agent; **không** auto-sửa OCR khi chưa có whitelist.

---

## 1. Danh mục tính năng đề xuất

Cột **Determ.** = thuần deterministic (không cần AI). **Ext.dep** = cần hệ ngoài. **⚠Ràng buộc** = chạm giới hạn/nguyên tắc đã ghi, cần quyết định.

### Theme A — Nhận diện rủi ro tự động (risk engine)
| Mã | Tính năng | Giá trị | Determ. | Ext.dep | ⚠Ràng buộc |
|---|---|---|---|---|---|
| **A1** | **Risk Aggregation Engine** — gom nhiều signal → `risk_score`+`risk_band`+`contributing_signals[]`; hard rule override; decision map từ band | Nền tảng cho mọi rủi ro sau; giải thích được | ✅ | — | Refactor Decision Engine (giữ tương thích output cũ) |
| **A2** | **Screening/blacklist signal** — đối chiếu beneficiary với danh sách cảnh báo/sanction | Chặn đối tác rủi ro AML/PEP | ✅ (lookup) | AML/VMS (`SYS-TPBANK`) | Dữ liệu thật → không synthetic; là **cảnh báo**, không tự BLOCK trừ khi policy |
| **A3** | **Duplicate/velocity** — phát hiện trùng invoice/beneficiary/amount trong cửa sổ thời gian | Chặn thanh toán trùng/bất thường | ✅ | Store lịch sử | Cần lưu lịch sử giao dịch (demo: Sheet; thật: DWH) |
| **A4** | **Data-quality / OCR-confidence flag** — gắn cờ input rủi ro (ký tự lạ, độ dài bất thường, nghi OCR) → REVIEW thay vì NOT_MATCH sai | Giảm quyết định sai do đầu vào rác | ✅ | — | **Chỉ flag**, KHÔNG auto-sửa OCR (`POSSIBLE_OCR_ERROR`) |
| **A5** | **Amount consistency** — nếu có số tiền hóa đơn vs lệnh CT → check khớp | Supporting signal chống sửa số tiền | ✅ | — | Supporting signal, không tự block |

### Theme B — Mở rộng các bên liên quan (multi-party)
| Mã | Tính năng | Giá trị | Determ. | Ext.dep | ⚠Ràng buộc |
|---|---|---|---|---|---|
| **B1** | **Payer/Applicant identity** — verify tên bên trả tiền/người đề nghị nhất quán giữa chứng từ | Mở rộng chốt kiểm sang bên mua/vay | ✅ | — | Tái dùng normalize/similarity hiện có |
| **B2** | **Tax code (MST) matching** — thêm MST làm chiều xác nhận pháp nhân mạnh | MST khớp + tên gần → **giảm REVIEW**, tăng tự tin | ✅ | — | Cần input MST (từ OCR hóa đơn) |
| **B3** | **Account holder verification** — đối chiếu tên với **chủ tài khoản thật** tại NH | Bịt lỗ hổng lớn nhất (tiền tới đúng chủ TK) | ✅ (match) | **FCC** | **Đổi phạm vi:** hiện disclaim "không xác minh chủ TK". Cần chốt policy + tích hợp FCC |
| **B4** | **Cross-document party check** — đối chiếu bên trên hóa đơn ↔ hợp đồng ↔ lệnh CT | Phát hiện lệch xuyên chứng từ | ✅ | Nguồn hợp đồng | Cần thêm nguồn dữ liệu hợp đồng |
| **B5** | **Generalize entity model** — "verify 2 tên" → "verify N party × M document" (config party roles) | Biến thành API dùng chung đa sản phẩm | ✅ | — | Refactor API contract (versioned) |

### Theme C — Nền tảng & vận hành (enablers)
| Mã | Tính năng | Giá trị | Determ. | Ext.dep | ⚠Ràng buộc |
|---|---|---|---|---|---|
| **C1** | **Batch API + regression harness** — chạy hàng loạt, in metric | Đo chất lượng, tuning threshold | ✅ | — | Dùng `GOLDEN_DATASET.md` |
| **C2** | **Explainability & audit trail** — log đầy đủ signal contributions + versions | Compliance, truy vết | ✅ | Store | — |
| **C3** | **Config-driven thresholds/weights** — externalize để tuning không deploy | Vận hành linh hoạt | ✅ | — | Tránh "2 nguồn sự thật" (xem `DATA_MODEL.md`) |
| **C4** | **Feedback loop** — cán bộ đánh dấu đúng/sai → làm giàu dataset | Cải thiện liên tục | ✅ | Store | **Chỉ dataset**, KHÔNG fine-tuning/autonomous |
| **C5** | **Resilience** — timeout + fallback (fail-open→REVIEW) khi signal service lỗi | Không để verify treo chặn giải ngân (R1) | ✅ | — | Chốt fail-open vs fail-closed |

---

## 2. Phân tích

### 2.1 Value × Effort (định tính)
- **Quick win, thuần deterministic, demo-able bằng synthetic:** A1, A4, B1, B2, A5, C1, C2, C3. → Lõi giá trị cao, không phụ thuộc hệ ngoài, publish artifact được.
- **High value nhưng phụ thuộc hệ ngoài / dữ liệu thật:** A2 (AML), A3 (store lịch sử), B3 (FCC), B4 (hợp đồng). → Sau demo, cần [OPEN] tích hợp.
- **Nền tảng bắt buộc trước khi mở rộng:** A1 (risk aggregation) và B5 (entity model) là **refactor gốc** — làm sớm để các signal sau "cắm" vào.

### 2.2 Phụ thuộc
```
A1 (risk aggregation)  ← nền cho A2,A3,A4,A5,B2,B3 (mỗi cái là 1 signal cắm vào)
B5 (entity model)      ← nền cho B1,B3,B4 (đa bên/đa chứng từ)
C3 (config)            ← điều kiện tuning cho A1 weights + threshold
C2 (audit)             ← cần cho A2/B3 (bằng chứng compliance)
Store (Sheet→DWH)      ← điều kiện cho A3,C4
```

### 2.3 Rủi ro & xung đột ràng buộc (phải quyết trước khi làm)
- **B3 account holder** mâu thuẫn tuyên bố hiện tại ("không xác minh chủ TK"). Đây là **mở rộng phạm vi có chủ đích** theo yêu cầu "mở rộng bên liên quan" — nhưng cần **policy owner chốt**: dùng làm cảnh báo hay điều kiện chặn; và tích hợp FCC (🔴 rủi ro cao).
- **A2 screening** dễ tạo **false positive** (trùng tên danh sách) → phải REVIEW, không auto-BLOCK; và là dữ liệu thật → **không publish**.
- **A1 refactor** rủi ro hồi quy output hiện tại → phải **giữ tương thích** `API_CONTRACT` (thêm field, không đổi field cũ; bump version).
- **A4** dễ trượt sang auto-sửa OCR (đang cấm) → giới hạn **chỉ gắn cờ**.
- **C4 feedback** dễ trượt sang fine-tuning/agent (đang cấm) → giới hạn **chỉ dataset synthetic/ẩn danh**.
- **Fail-open vs fail-closed** (C5): fail-open (lỗi→REVIEW) tránh chặn giải ngân nhưng nới rủi ro; cần chốt theo khẩu vị.

---

## 3. Kế hoạch triển khai (phased)

> Nguyên tắc: mỗi phase **chạy được + demo được** độc lập; ưu tiên deterministic + synthetic trước; hệ ngoài để sau khi có [OPEN].

### Phase 0 — Nền demo (đang dang dở, từ `TODO_NEXT`)
- Dataset synthetic (`GOLDEN_DATASET`), GAS gateway + Sheet + FE, quyết định TD-BM-01/02.
- **Ra:** demo hiện trạng chạy end-to-end.

### Phase 1 — Risk engine core *(thuần deterministic, synthetic, publish được)*
- **A1** Risk Aggregation Engine (refactor Decision Engine, giữ tương thích output; thêm `risk_score/risk_band/contributing_signals`).
- **A4** Data-quality flag · **C2** audit trail · **C3** config-driven weights/threshold · **C1** harness metric.
- **Ra:** BeneMatch hiển thị **vì sao rủi ro** (đa signal), tuning được, đo được. Kể mạnh tuyến "nhận diện rủi ro tự động" + "chất lượng".

### Phase 2 — Mở rộng bên liên quan (low-dep) *(synthetic-friendly)*
- **B5** entity model tổng quát (N party × M doc, versioned contract) → **B1** payer identity · **B2** MST matching · **A5** amount consistency.
- **A3** duplicate/velocity (bắt đầu bằng store = Sheet).
- **Ra:** verify đa bên; giảm REVIEW nhờ MST; chống thanh toán trùng. Kể tuyến "mở rộng bên liên quan".

### Phase 3 — Tích hợp hệ ngoài *(dữ liệu thật, KHÔNG publish, cần [OPEN])*
- **A2** AML/screening signal (qua `SYS-TPBANK` AML/VMS) · **B3** account holder qua FCC · **B4** cross-document (nguồn hợp đồng) · **C5** resilience/fallback.
- **Điều kiện:** chốt policy B3, auth API qua Kong, fail-open/closed, SLA trước FCC.
- **Ra:** sàng lọc rủi ro tích hợp thật trong luồng SHTD.

### Phase 4 — Cải thiện liên tục
- **C4** feedback loop (dataset) · tuning threshold/weights bằng golden dataset thật · hiệu chỉnh trọng số A1.

---

## 4. Quyết định đã chốt (2026-08-19)
1. **Ưu tiên sau Phase 0:** làm **Phase 1 — Risk engine core** trước.
2. **Bên liên quan đưa vào:** **cả 4** — Payer (B1), MST (B2), Account holder (B3), Supplier/Contract (B4).
3. **B3 account holder:** **chỉ cảnh báo (REVIEW/WARN)**, KHÔNG tự BLOCK — giữ triết lý "account là supporting signal". Tách: **B3a** logic match (synthetic, Phase 2) khỏi **B3b** tích hợp FCC thật (Phase 3).
4. **A2 screening:** **danh sách tĩnh synthetic** cho demo → publish được → **kéo lên Phase 1** làm signal thứ 2 minh họa aggregation. Nguồn AML/VMS thật để Phase 3.
5. **C5 fail-open vs fail-closed:** [OPEN] — mặc định đề xuất **fail-open → REVIEW** (không để lỗi hệ thống tự BLOCK), chốt lại ở Phase 3.

## 4b. Roadmap sau khi chốt
- **Phase 1:** A1 · A4 · **A2 (synthetic list)** · C1 · C2 · C3.
- **Phase 2:** B5 → B1 · B2 · **B3a (account holder synthetic, warn-only)** · A5 · A3.
- **Phase 3:** **B3b (FCC)** · A2 nâng lên AML/VMS thật · B4 (nguồn hợp đồng) · C5.
- **Phase 4:** C4 feedback · tuning threshold/weights.

## 5. Không thuộc phạm vi (giữ nguyên)
RAG/vector DB/fine-tuning/autonomous agent; auto-sửa OCR không whitelist; xóa hàng loạt từ ngành nghề/địa danh; dùng account/screening mismatch để **tự động** BLOCK khi chưa có policy; đưa dữ liệu KH thật lên cloud/artifact.
