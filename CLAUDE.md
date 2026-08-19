# CLAUDE.md — BeneMatch

Repo này theo chuẩn **AI OS Registry (Hub-and-Spoke)**. Tri thức dự án sống ở `AI_CONTEXT/`; danh mục trung tâm ở repo **AIOS** (`D:\Workspace\AIOS`). ID dự án: **PRJ-BM**.

## Bắt đầu mỗi phiên (BẮT BUỘC)
1. `git pull`.
2. Đọc theo thứ tự: `AI_CONTEXT/PROJECT_OVERVIEW.md` → `PROJECT_STATE.md` → `TODO_NEXT.md` → `SESSION_HANDOVER.md` (**delta mới nhất trên cùng**) → `TECH_DEBT.md`.
3. **Không quét toàn repo.** Chỉ mở module liên quan việc đang làm.

## Quy tắc làm việc
- Việc nhỏ → commit nhỏ → cập nhật `AI_CONTEXT/` → `git push`.
- **Kết thúc phiên:** ghi delta vào `SESSION_HANDOVER.md` đủ **6 trường** — task completed · files changed · decision made · blocker · next step · regression risk. Cập nhật `PROJECT_STATE`/`TODO_NEXT`/`TECH_DEBT` nếu đổi.
- Commit chỉ khi được yêu cầu; nếu đang ở nhánh chính thì tạo nhánh trước. Không skip hook.
- **Dữ liệu khách hàng / nhạy cảm: KHÔNG đưa lên cloud/artifact** (RULE-data-boundary).

## Định danh registry
- Thẻ dự án: `AIOS/04_Knowledge/projects/PRJ-BM.md` · Danh mục: `AIOS/00_System/PORTFOLIO.md`.
- Chuẩn khung `AI_CONTEXT/` + quy ước ID/tên/front-matter: `AIOS/02_Rules/naming-convention.md`.
- Trạng thái đa dự án (tự sinh): `AIOS/00_System/PORTFOLIO_DIGEST.md`.

## Kiến trúc & bối cảnh
Xem `AI_CONTEXT/PROJECT_OVERVIEW.md` + design docs: `SYSTEM_ARCHITECTURE.md`, `DIFY_WORKFLOW.md`, `DECISION_RULES.md`, `NORMALIZATION_SPEC.md`, `API_CONTRACT.md`, `INTEGRATION_MAP.md`, `GOLDEN_DATASET.md`, `DATA_MODEL.md`, `DESIGN_SYSTEM.md`.

## Nguồn sự thật của lõi verify
- Workflow Dify: `Beneficiary Legal Entity Verification V2.yml` (Dify Cloud) + bàn giao `Beneficiary_Verification_Dify_V2_Handover.docx`. **Dùng đúng code tuned trong đó làm baseline**, không quay lại prototype cũ.
- Số tài khoản luôn **String**; Decision Engine cần **đủ 17 input** đúng type; LLM chỉ chạy ở REVIEW+`ai_eligible=true` (lưu ý TD-BM-01).
