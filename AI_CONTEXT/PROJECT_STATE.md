# PROJECT STATE — BeneMatch

**Cập nhật:** 2026-08-22 · **Version:** 0.2.0-dev · **Repo:** https://github.com/tuanttstb-debug/BeneMatch

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

