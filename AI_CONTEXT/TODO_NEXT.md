# TODO NEXT — BeneMatch

Ưu tiên trên xuống. Owner: [CC]=Claude Code · [TT]=Tuân.

## Cao
1. [TT] Cung cấp **endpoint + API key** workflow Dify Cloud (để GAS gọi) + xác nhận app URL. → điền `SYSTEM_ARCHITECTURE.md` / config.
2. [CC] Dựng **bộ dataset synthetic** phủ 7 case regression (không dấu, viết tắt, đảo thứ tự, khác legal type, tên ngắn, mơ hồ, thiếu tên) — `GOLDEN_DATASET.md`.
3. [CC] Vá **[TD-BM-01] Warning Route** để đúng logic `ai_eligible` (thêm case REVIEW+ai_eligible=false → template deterministic; chỉ ai_eligible=true → LLM). Cân nhắc làm trong bản demo hay giữ nguyên as-built để "kể" như một rủi ro phát hiện được.
4. [CC] Dựng **GAS gateway** (doPost: nhận 5 biến → gọi Dify → trả result card) + **Google Sheet** log.

## Trung bình
- [CC] FE Bootstrap "TPBank BIZ" tím-first: form 5 biến + result card (MATCH/REVIEW/NOT_MATCH, difference %, checks_required) — `DESIGN_SYSTEM.md`.
- [CC] Trang/artifact **bản đồ tích hợp** (INTEGRATION_MAP) trực quan cho stakeholder — chỉ synthetic, được publish.
- [CC] Harness chạy 7 case regression tự động, in bảng kết quả + đo False Match.
- [TT] Xác nhận điểm nối thật vào SHTD (upstream OCR hóa đơn/đề nghị CT; downstream BPM/FCC).

## Roadmap tính năng (chốt 2026-08-19 — chi tiết `FEATURE_ROADMAP.md`)
**Phase 1 — Risk engine core** *(deterministic, synthetic, publish được — làm trước sau Phase 0):*
- [CC] **A1** Risk Aggregation Engine: refactor Decision Engine → thêm `risk_score`/`risk_band`/`contributing_signals[]`, giữ tương thích `API_CONTRACT` (thêm field, bump version).
- [CC] **A4** Data-quality/OCR flag (`POSSIBLE_OCR_ERROR`, chỉ gắn cờ) · **A2** Screening signal (danh sách **synthetic**) · **C2** audit trail · **C3** config-driven weights/threshold · **C1** harness metric.

**Phase 2 — Mở rộng bên liên quan** *(low-dep, synthetic):*
- [CC] **B5** entity model tổng quát (N party × M doc) → **B1** payer · **B2** MST matching · **B3a** account-holder match (synthetic, **warn-only**) · **A5** amount · **A3** duplicate/velocity (store = Sheet).

**Phase 3 — Tích hợp hệ ngoài** *(dữ liệu thật, KHÔNG publish, cần [OPEN]):*
- **B3b** account holder qua **FCC** · **A2** nâng lên AML/VMS thật · **B4** cross-document (nguồn hợp đồng) · **C5** resilience (chốt fail-open→REVIEW).

**Phase 4:** **C4** feedback (chỉ dataset) · tuning threshold/weights bằng golden dataset thật.

## Thấp / Backlog (KHÔNG tự triển khai — chờ dữ liệu thật/policy)
- OCR sửa lỗi có whitelist ngữ cảnh (V1ET→VIET, N4M→NAM, 0→O, 1→I).
- Mở rộng similarity (phonetic/abbrev mapping) nếu regression đòi hỏi.
- [OPEN] policy owner cho B3 (đã chốt warn-only) + fail-open/closed (C5).
