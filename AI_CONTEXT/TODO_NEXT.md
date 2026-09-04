# TODO NEXT — BeneMatch

Ưu tiên trên xuống. Owner: [CC]=Claude Code · [TT]=Tuân.

## ▣ Delta (2026-09-04 #2) — Form tự nhập nhanh 1↔1 & nhiều HĐ↔1 lệnh

XONG [CC] (thuần FE, rebuild, push origin/main): ✅ form nhập nhanh theo trường đơn (2 chế độ **1 HĐ↔1 lệnh** · **nhiều HĐ↔1 lệnh** + thêm/xóa dòng) · ✅ "Đối chiếu thử" chạy **đúng luồng `reconcileBatch`** (đổ về ô Nâng cao → runOffline) → KPI+bảng+JSON+email ĐVKD · ✅ nút "Điền mẫu" · ✅ verify Chrome (1↔1 MATCH/NOT_MATCH · gộp nhiều HĐ 90+60=150) + recon 14/14. Ưu tiên tiếp:
- [TT] Test tự nhập: 1↔1 (đổi tên HĐ khác pháp nhân → KHÔNG KHỚP; lệch tiền → CẦN KIỂM TRA) · nhiều HĐ↔1 lệnh (tổng ≠ lệnh → thừa/thiếu; 2 HĐ cùng số/ngày → nghi trùng).
- [CC] (tùy chọn) thêm chiều **nhiều lệnh ↔ 1 HĐ**; nút "Xóa form"; format số tiền có phân tách khi gõ.

## ▣ Delta (2026-09-04) — CR: Email cảnh báo gửi ĐVKD dưới outcome demo

XONG [CC] (thuần FE, rebuild 3 file, đã push origin/main): ✅ email cảnh báo gửi ĐVKD **bên dưới outcome JSON** — **1 email/nhóm xếp chồng**, preview-only · ✅ **bôi màu 3 mức** (🟢 MATCH · 🟡 REVIEW · 🔴 NOT_MATCH); mỗi cảnh báo callout riêng có màu; nhóm sạch → callout xanh · ✅ metadata synthetic (GNOL/khoản vay deterministic; ĐVKD/mục đích từ `scenarios.json.request`) · ✅ verify Chrome 4 mức + lô 9 email + mobile 360px 0 tràn · ✅ recon **14/14** (engine không đụng). Ưu tiên tiếp:
- [TT] Xem `docs/index.html` (hoặc Pages sau khi bật) → nghiệm thu email từng kịch bản; báo em nếu muốn chỉnh **nhãn** (Cho qua/Kiểm soát/Chặn), **ĐVKD/mục đích mặc định**, hay **format GNOL/số khoản vay**.
- [CC] (tùy chọn) nếu cần GNOL/số khoản vay **thật theo từng nhà cung cấp** thay vì sinh deterministic → thêm field vào invoice/transfer data + đọc trong `genRequestMeta`.

## ▣ Delta (2026-08-27) — Pivot demo public GitHub Pages + OCR free + nghiệm thu live

XONG [CC] (đã push origin/main): ✅ **trang demo public** `docs/index.html` (showcase + 6 kịch bản, offline-only, synthetic) · ✅ `scenarios.json` verify **6/6** · ✅ **Free OCR** Drive (đa provider) — **nghiệm thu LIVE** ảnh→OCR→parse→reconcile→Dify **MATCH** · ✅ route `verify_name` + passthrough `ai_status` (routing đúng) · ✅ vá **TD-BM-05** (invoice_id) · ✅ dời test/EVD vào `test/live/`. Ưu tiên tiếp:
- [TT] **Bật GitHub Pages** (Settings → Pages → branch `main` · folder `/docs` → Save) → link **https://tuanttstb-debug.github.io/BeneMatch/** gửi nhân sự demo. *(deliverable chính — chưa xong)*
- [TT] (tùy chọn) **Redeploy `OcrService.gs`** áp vá `invoice_id` (không gấp — quyết định không đổi).
- [TT] (tùy chọn, phía Dify) Gắn **credential model gpt-5** trong workflow → node LLM hết FALLBACK (nay ~<10% ca REVIEW dùng template thay AI; quyết định vẫn đúng).
- [CC] khi [TT] xác nhận Pages live → kiểm link lần cuối; (tùy chọn) đổi `FEEDBACK_EMAIL` sang email công việc; đóng nốt `WRITE-TRANSPORT-01` nếu còn.

## ▣ Delta (2026-08-22) — Scope Batch Reconciliation ĐÃ DỰNG (chờ [TT] cung cấp để chạy live)

XONG [CC] (offline, đã verify): ✅ recon engine `src/recon/` + regression harness **14/14 pass** · ✅ dataset synthetic 9 nhóm · ✅ tối ưu Dify yml (4 nhánh, trả TD-BM-01/02/03; validate + code node chạy) · ✅ `gas/` gateway + OCR + Sheet + **parity Recon.gs ≡ src/recon** · ✅ FE `fe/index.html` (verify render trình duyệt) · ✅ artifact publish (private).

**CẦN [TT] CUNG CẤP để chạy end-to-end thật (ưu tiên #1):**
1. [TT] **Import yml đã tối ưu** lên Dify Cloud → smoke-test 4 nhánh (đặc biệt **NOT_MATCH** — xem TD-BM-03) → cấp **DIFY_API_URL + DIFY_API_KEY**.
2. [TT] **Google Vision API key** (+ quota) cho đường OCR thật; và vài **ảnh/PDF hóa đơn mẫu** (ẩn thông tin) để hiệu chỉnh `parseInvoiceText_` (TD-BM-05).
3. [TT] **Deploy GAS** (`gas/Code.gs`+`Recon.gs`+`OcrService.gs`) làm Web App → cấp URL; đặt Script Properties (DIFY_*, VISION_API_KEY, USE_OCR, SHEET_ID).
4. [TT] Google **Sheet ID** cho log (chạy `setupConfigSheet()` 1 lần).

**Tiếp theo [CC] khi có (2):** nối FE "Live" → GAS; smoke-test OCR ảnh thật; hiệu chỉnh regex; (tùy chọn) trả TD-BM-04.

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
