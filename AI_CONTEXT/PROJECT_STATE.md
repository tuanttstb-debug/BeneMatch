# PROJECT STATE — BeneMatch

**Cập nhật:** 2026-08-19 · **Version:** 0.1.0 · **Repo:** https://github.com/tuanttstb-debug/BeneMatch

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

