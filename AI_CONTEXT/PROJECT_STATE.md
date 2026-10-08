# PROJECT STATE — BeneMatch

**Cập nhật:** 2026-10-08 · **Version:** 0.5.0 (engine 3.2.0) · **Prod:** https://tuanttstb-debug.github.io/BeneMatch/ · **Repo:** https://github.com/tuanttstb-debug/BeneMatch

## Delta (2026-10-08) — Kiến trúc 3 lớp: OCR tại máy · GAS logic + gọi AI trực tiếp · bỏ Dify
[TT] giao: đối chiếu bộ OCR của công cụ ẩn danh v3.6 → đánh giá + điều chỉnh kiến trúc; mục tiêu **gỡ Dify**, khi IT tích hợp **chỉ thay Gemini bằng AI nội bộ TPB**. [TT] duyệt đề xuất 4 điểm (Q1 Gemini miễn phí chỉ dữ liệu giả lập/ẩn danh · Q2 GAS = logic AI + API, trình duyệt vẫn tự kết luận · Q3 gỡ OCR GAS · Q4 nhúng thư viện ~8,5 MB).
**Đã làm:** (1) **OCR local** — `src/ocr/scan_lib.js` (chép nguyên công cụ ẩn danh v3.6: tự xoay, xoá kẻ) + pdf.js/tesseract/tiếng Việt/SheetJS **nhúng** (npm, không CDN — đóng TD-BM-08); PDF scan đọc ≤ 2 trang, độ tin thấp thử 180°; CSP chặn mạng trừ cổng GAS · `fe/index.html` = 1 file offline 8,5 MB (gitignore, gửi nội bộ) · Pages = `docs/index.html` + `docs/bm-vendor.js`. (2) **Engine 3.2.0** — prompt + schema + parse + gác nằm ở `BM.advisor` (nguồn duy nhất); `cleanName` bỏ rác OCR đầu tên. (3) **GAS** — adapter `AI_PROVIDER` `gemini` (generateContent + responseSchema, bỏ phần thought) | `openai_compat` (/chat/completions + json_schema, header/format tùy biến cho IT); cờ `AI_ALLOW_REAL_DATA` (tắt → bắt `data_attest:"ANONYMIZED"`); log `ai_log` có provider/model/token; hàm `kiemTraAI`; gỡ `OcrService.gs` + Drive API (`OCR_LOCAL_ONLY`). (4) **FE** — thẻ AI đọc chế độ cổng: chạy thử → khung cảnh báo + tick xác nhận ẩn danh bắt buộc. (5) Dify → `_archive/dify/`. (6) `AI_INTEGRATION_CONTRACT.md` cho IT.
**Test:** engine **140/140** · GAS **42/42** (2 nhà cung cấp) · Chrome `tools/dev/ui_smoke.mjs` **16/16** (scan thẳng/xoay 90°/ảnh/PDF chữ/XML đọc đủ tên-MST-tiền, 5 file 11 giây, **0 request ra Internet**, 0 lỗi JS, thẻ AI 2 chế độ) · **GAS live @13** (clasp, cùng URL; backup live = repo HEAD): doGet 3.2.0 · 9/9 kịch bản live ≡ local · verify_name 4/4 · OCR_LOCAL_ONLY · ACCESS_DENIED.
**Blocker:** [TT] đặt `AI_API_KEY` (Gemini) trong Script Properties → chạy `kiemTraAI` (cổng đang `configured:false`).

## Delta (2026-09-28 #3) — Đổi model AI tư vấn sang Gemini 3.8 Flash
[TT] duyệt sau đánh giá ảnh hưởng (`ADVISOR_SPEC §4b`): `dify/BeneMatch_Name_Advisor_v3.yml` = **Gemini 3.8 Flash** (thinking medium, không temperature, schema bỏ additionalProperties, không kèm dependency) · `…_v3_gpt5.yml` = dự phòng. Engine/GAS/FE không đổi logic. **Bắt buộc key Gemini trả phí.** Blocker: [TT] cài/cập nhật plugin Gemini + key trả phí + import + thay `DIFY_API_KEY` + `taoMaTruyCap`.

## Delta (2026-09-28 #2) — AI tư vấn nhận diện tên (LLM qua Dify, chỉ tham khảo) · engine 3.1.0
[TT] phản hồi: OCR đã có trên BIZ; cần LLM vì tên KHDN phức tạp. Phỏng vấn 3 vòng chốt: **Dify Cloud + GPT-5 được phép với dữ liệu thật** · LLM **chỉ đề xuất + giải thích** · giai đoạn 1 công cụ cán bộ qua **GAS proxy + mã truy cập**, giai đoạn 2 service GNOL (BIZ→BPM) · chưa có nguồn tra cứu (tên chủ TK/ĐKKD) · dữ liệu đo = trích lịch sử GNOL (**không có cột kết luận → phải gán nhãn**).
**Đã làm:** luật `GROUP_TIER_DIFFERENT` (vá lỗ hổng: Tổng cty ↔ cty từng có thể KHỚP) · `BM.advisor` (eligible/payload/collect/guard) · workflow Dify mới `dify/BeneMatch_Name_Advisor_v3.yml` (GPT-5, structured output, node gác Python) · GAS `advise_names` (mã truy cập, hạn mức, server tự tính lại engine, log không tên) · FE thẻ "AI tư vấn" + ý kiến dưới từng cặp + cột AI trong Excel/phiếu + nút ở Check nhanh · `tools/eval` (template → prepare → gán nhãn → score ẩn danh; chặn ghi vào repo) · `advisor_smoke` 22 ca khó giả lập · mock proxy. Test: engine **133/133** · GAS **17/17** · e2e FE + eval qua mock OK. Phát hiện 2 lỗi workflow V2 (biến prompt sai cú pháp → LLM không nhận tên; temperature với GPT-5).
**GAS live (clasp, [TT] giao):** deployment @9 cùng URL — engine 3.1.0 + `advise_names`, smoke live 9/9 kịch bản, verify_name ≡ local; URL cổng gắn sẵn vào công cụ. **Blocker:** [TT] gắn GPT-5 + import workflow Dify + thay `DIFY_API_KEY` + chạy `taoMaTruyCap` · trích GNOL.

## Delta (2026-09-28) — ENGINE v3: tổng rà soát & nâng cấp lên mức vận hành thực tế
**Pivot:** từ demo synthetic → **công cụ offline vận hành thật** (Prod https://tuanttstb-debug.github.io/BeneMatch/ — [TT] bật Pages 28/09). Dữ liệu KH thật xử lý trong trình duyệt, không lưu, không gửi đi. Phỏng vấn [TT] chốt 8 điểm (xem `ENGINE_V3_SPEC.md §1`).
**Rà soát phát hiện:** check tên tồn tại 4 bản lệch nhau (Dify 10 luật vs 3 stub Jaccard ≥ 0.6 ở FE/GAS/src) · gộp nhóm giả định UNC có MST (thực tế không) → biến sai tên thành "thiếu hóa đơn" · mỗi nhóm chỉ so tên HĐ[0] ↔ UNC[0] · Dify/LLM trên đường quyết định (timeout ~93s, data-boundary) · thiếu chi nhánh/HKD/tên tiếng Anh/cắt cụt.
**Đã làm:** `src/engine/bm-engine.js` = **nguồn logic duy nhất** (FE/GAS/Node) — port 10 luật Dify V2 + `difflib` chuẩn Python (parity 74/74) + luật mới (chi nhánh, cắt cụt, tên riêng khác/trùng, lệch số hiệu, tiếng Anh) · ghép UNC ↔ bên bán theo tên + số HĐ trong nội dung · check **mọi** UNC · HĐ trùng không cộng tổng · MST checksum · người mua ≠ KH vay · UNC trùng · Σ UNC vs số giải ngân. FE viết lại: hồ sơ 4 bước, nhập XML TT78/PDF/ảnh OCR/Excel/dán/tay, xuất Excel 5 sheet, in phiếu có ô ký, email ĐVKD, tab check nhanh tên, tab quy tắc. GAS dùng `gas/Engine.gs` sinh tự động, bỏ Dify. Test **81/81** (golden 37 cặp, False Match = 0).
**Version:** 0.3.0 (engine 3.0.0). **Đã push `2462421` + smoke Prod 28/09:** Pages live ~20s; 9/9 kịch bản đúng kết luận; luồng thật XML TT78 + PDF (pdf.js CDN) + dán 3 UNC → ghép đúng bên bán, bắt UNC "TNHH" trả bên bán "CP" (CHẶN) + thừa chi 5tr; tự điền KH vay từ XML; SheetJS CDN tạo workbook OK (không tải file). **Blocker:** không.

## Delta (2026-09-04 #3) — Định dạng số tiền + đổi quy tắc rủi ro số tiền/chứng từ
2 CR. **CR1 (FE):** ô **số tiền** tự thêm dấu chấm nghìn khi gõ (chỉ số tiền, không MST/STK/số HĐ). **CR2 (engine `gas/Recon.gs`+`src/recon/reconcile.js`):** BỎ cảnh báo `TRANSFER_MISSING_FOR_GROUP` (hóa đơn chưa chi) + BỎ `AMOUNT_UNDER_TOLERANCE` (ΣHĐ>ΣCT chi ít hơn — không rủi ro); GIỮ thừa chi + `INVOICE_MISSING_FOR_TRANSFER` (chi thiếu hóa đơn). So tổng theo TỪNG bên thụ hưởng (không đổi). Parity OK + harness **14/14** (EXPECT 0103/0104→MATCH). **Blocker:** CR2 chạm engine GAS → [TT] **redeploy `Recon.gs`** cho đường live (demo public offline đã áp qua build).

## Delta (2026-09-04 #2) — Form tự nhập nhanh 1↔1 & nhiều HĐ↔1 lệnh (thuần FE)
Thêm **form nhập nhanh theo trường đơn** trên demo (`docs/index.html`) cho người dùng nghiệp vụ tự test không cần JSON/CSV. 2 chế độ: **1 HĐ ↔ 1 lệnh** · **nhiều HĐ ↔ 1 lệnh** (thêm/xóa dòng HĐ). Nhập tên/MST/số tiền (+số HĐ/ngày) → "Đối chiếu thử" → chạy **đúng luồng `reconcileBatch`** → KPI+bảng+JSON+**email cảnh báo ĐVKD**. Dùng chung đường `runOffline` (đổ về ô Nâng cao). Sửa `fe/index.template.html`, rebuild. KHÔNG đụng engine/GAS. Verify Chrome (1↔1 MATCH/NOT_MATCH · gộp nhiều HĐ) + recon **14/14**. **Blocker:** không.

## Delta (2026-09-04) — CR: Email cảnh báo gửi ĐVKD dưới outcome demo (thuần FE)
Thêm **email cảnh báo gửi ĐVKD** render có màu **bên dưới outcome JSON** ở màn demo (`docs/index.html`). [TT] chốt: **1 email/mỗi nhóm người thụ hưởng, xếp chồng** + **chỉ xem trước**. Mỗi `group` → 1 thẻ email theo khung mẫu [TT] (Kính gửi ĐVKD · GNOL · công ty · số tiền/mục đích/số khoản vay · Kết quả/Hành động/Chi tiết cảnh báo/Mức rủi ro). **Bôi màu 3 mức** theo risk/decision (🟢 MATCH/ALLOW · 🟡 REVIEW/WARN · 🔴 NOT_MATCH/BLOCK); mỗi cảnh báo là callout riêng có màu; nhóm sạch → callout xanh. Metadata giải ngân **synthetic** (GNOL/số khoản vay deterministic từ `group_key`; ĐVKD/mục đích từ `scenarios.json.request`, branch parse từ ĐVKD). Sửa `fe/index.template.html`+`scenarios.json`, rebuild 3 file. **KHÔNG đụng engine/GAS.** Verify Chrome đủ 4 mức + lô 9 email + mobile 360px 0 tràn; recon harness **14/14**. **Blocker:** không (offline, không redeploy GAS).

## Delta (2026-08-27) — Pivot: demo public GitHub Pages (synthetic) + OCR free + nghiệm thu live
**Mục tiêu dự án chuyển thành trang demo public** giới thiệu năng lực cho nhân sự + lấy góp ý (chốt [TT] 2026-08-27). Dựng `docs/index.html` — static site tự chứa cho **GitHub Pages** (`/docs`, offline-in-browser, chỉ **synthetic**): showcase + **scenario picker 6 kịch bản** (verify 6/6). **Free OCR** = Google Drive OCR (thay/bổ sung Vision) — `OcrService.gs` đa provider; **nghiệm thu LIVE trọn** ảnh→OCR→parse→reconcile→Dify **MATCH**. Thêm route debug `verify_name` (Code.gs). Vá TD-BM-05. Đẩy 8 commit (`39b1606`→`faa9be5`, push origin/main). **Blocker:** không — chờ [TT] **bật GitHub Pages** (link: https://tuanttstb-debug.github.io/BeneMatch/). Ghi chú: node LLM Dify trả FALLBACK (chưa gắn model credential — việc phía Dify).

## Delta (2026-08-22) — Scope mới: Batch Reconciliation (đa hóa đơn ↔ đa lệnh CT)
Phỏng vấn tổng thể 2 vòng chốt **mở rộng scope** từ "verify 1 cặp tên" → **đối chiếu lô**: upload nhiều hóa đơn (file) + nhiều lệnh CT (CSV) → OCR hybrid → **gộp nhóm theo người thụ hưởng (MST)** → kiểm **tổng nhóm + grand total** (dung sai, over/under) + **duplicate** + **khớp tên qua lõi V2** → dashboard cảnh báo. Chốt: OCR **hybrid** (GAS+Vision thật + synthetic fallback); mapping **gộp theo beneficiary**; validate đủ 4 (grand+nhóm · tolerance+chiều lệch · duplicate · khớp tên); output **FE + artifact**; Dify **rule-first** (LLM chỉ REVIEW&ai_eligible=true → trả TD-BM-01); recon engine **module JS riêng** (test offline) + Dify verify tên; lệnh CT **upload CSV**; OCR fields **tên+MST · tổng tiền · số HĐ+ngày**. Đây là hợp nhất cụ thể A1/A2/A3/A4/A5/B1/B2/B5/C1/C2/C3. Bộ context mới: `RECONCILIATION_SPEC.md`, `OCR_SPEC.md`, `DIFY_OPTIMIZATION.md`; cập nhật `API_CONTRACT` (batch), `SYSTEM_ARCHITECTURE`. **Đang dựng code** (recon engine + dataset + harness + yml tối ưu + GAS + FE + artifact).

## Tóm tắt
Lõi verify là **Dify Workflow "Beneficiary Legal Entity Verification V2"** (workflow mode, chạy trên **Dify Cloud**, app version 0.7.0). Deterministic rule engine + 1 node LLM (gpt-5) chỉ sinh text cảnh báo cho REVIEW. Nguồn sự thật của lõi: file `Beneficiary Legal Entity Verification V2.yml` + tài liệu bàn giao `Beneficiary_Verification_Dify_V2_Handover.docx` (bàn giao 2026-08-11). Lớp demo (FE + GAS + Sheet) **chưa dựng** — mới khởi tạo context.

## Đã có
- **Dify workflow V2** đã import & chạy được: START → Normalize Names → Extract Legal Type → Calculate Similarity → Calculate Warning Metrics → Decision Engine → Warning Route → (Build Match / Build Not Match / LLM→Validate AI) → Build API Response → OUTPUT. Chi tiết node: `DIFY_WORKFLOW.md`.
- **Rule Engine 10 luật** + reason codes + thresholds prototype (0.96/0.90/0.82) — `DECISION_RULES.md`.
- **Chuẩn hóa tên** (bỏ dấu, viết tắt pháp lý, `&`, core name/tokens) + **similarity** (sequence/jaccard/containment full+core) — `NORMALIZATION_SPEC.md`.
- **API contract** input 5 biến String / output object `response` — `API_CONTRACT.md`.
- Lỗi bàn giao cuối (`Decision Engine: main() missing legal_type_match`) **đã fix** trong file .yml hiện tại (đủ 17 input).
- **Bộ context AIOS** khởi tạo hôm nay: 5 lõi + design docs + đăng ký registry (PRJ-BM).

## Nguồn dữ liệu / tích hợp
- **Dify Cloud** (endpoint workflow API — cần điền khi dựng GAS). Plugin: `langgenius/openai` (gpt-5).
- **Dự kiến:** GAS gateway (doPost) · Google Sheet (log request/response + config threshold) · FE Bootstrap. Upstream thật: OCR hóa đơn + đề nghị chuyển tiền trong luồng SHTD (chưa nối).

## Đang treo
- Chưa có: FE demo, GAS gateway, Google Sheet log, dataset synthetic, harness regression.
- Chưa tạo endpoint/API key Dify trong config demo. Chưa xác định URL app Dify Cloud trong context (cần lấy).

## Rủi ro / hiện tượng đã biết
- **[TD-BM-01] Warning Route bỏ qua `ai_eligible`:** node if-else chỉ có 2 case (MATCH, NOT_MATCH); **mọi REVIEW rơi vào nhánh else → gọi LLM**, kể cả case đáng lẽ deterministic 0 token (INSUFFICIENT_DATA, PARTIAL_CORE_NAME_MATCH, LEGAL_TYPE_MISSING_CORE_NAME_MATCH). Lệch thiết kế + tốn token. Xem `TECH_DEBT.md`.
- **[TD-BM-02]** `Build API Response` khai báo `generated_by_ai` là `string` (thực chất Boolean) — lệch type nhẹ, code có `bool()` bọc.
- Thresholds 0.96/0.90/0.82 là **prototype**, chưa tuning bằng Golden Dataset; ưu tiên **False Match thấp**.

## Delta (2026-08-19) #1
Khởi tạo dự án PRJ-BM: scan 2 file nguồn (yml + docx), phỏng vấn chốt scope/kiến trúc/định danh, chạy `init-project`, dựng đủ bộ AI_CONTEXT (5 lõi + DESIGN_SYSTEM + 8 design docs) và đăng ký registry AIOS. Ghi nhận 2 tech-debt từ as-built. Chưa viết code demo.

## Delta (2026-08-19) #2
Bổ sung `FEATURE_ROADMAP.md`: 15 tính năng (3 nhóm A/B/C) + roadmap 5 phase. Chốt ưu tiên: sau Phase 0 làm **Phase 1 Risk Engine Core** trước; mở rộng **cả 4 bên** (payer/MST/account-holder/supplier-contract); **B3 warn-only**; **A2 screening dùng danh sách synthetic** (kéo lên Phase 1). Lập kế hoạch chi tiết Phase 1 (8 bước, prototype offline được — không chờ endpoint Dify). Vẫn chưa viết code. State hiện có thêm trục **roadmap tính năng** ngoài lõi verify V2.

