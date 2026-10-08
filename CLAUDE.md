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
Xem `AI_CONTEXT/PROJECT_OVERVIEW.md` + **`ENGINE_V3_SPEC.md` (nguồn chuẩn)** + design docs (lịch sử): `SYSTEM_ARCHITECTURE.md`, `DECISION_RULES.md`, `NORMALIZATION_SPEC.md`, `API_CONTRACT.md`, `INTEGRATION_MAP.md`, `GOLDEN_DATASET.md`, `DATA_MODEL.md`, `DESIGN_SYSTEM.md`.

## Nguồn sự thật (từ 2026-09-28 — engine v3)
- **Logic duy nhất:** `src/engine/bm-engine.js` (chạy trình duyệt / GAS / Node). Spec: `AI_CONTEXT/ENGINE_V3_SPEC.md`.
- `docs/index.html`, `fe/index.html`, `fe/present.html`, `gas/Engine.gs` là **file sinh** bởi `node fe/build.mjs` — không sửa tay.
- Gate trước khi build/push: `node test/engine.test.mjs` (golden tên, ca khó, parity Python difflib, kịch bản hồ sơ, IO, advisor) **và** `node test/gas_advisor.test.mjs` (cổng GAS + adapter AI 2 nhà cung cấp) pass 100%; False Match = 0.
- Kênh vận hành: **công cụ offline** Prod https://tuanttstb-debug.github.io/BeneMatch/ — dữ liệu KH thật chỉ xử lý trong trình duyệt, không lưu, không gửi đi. Không thêm bất kỳ network call nào mang dữ liệu hồ sơ.
- **Kiến trúc 3 lớp (từ 2026-10-08, bỏ Dify):** (1) **OCR tại máy** — `src/ocr/scan_lib.js` (chép từ công cụ ẩn danh v3.6 trong AIOS; sửa ở gốc rồi chép lại) + pdf.js/tesseract/SheetJS nhúng từ `node_modules` (`npm ci`) — không CDN, CSP chặn mạng trừ cổng GAS · (2) **GAS xử lý logic** (`gas/Code.gs`): mã truy cập, tự tính lại engine, prompt/gác, adapter AI · (3) **AI thay được**: `AI_PROVIDER=gemini` (hiện tại, gói miễn phí ⇒ `AI_ALLOW_REAL_DATA` tắt, chỉ tên giả lập/ẩn danh) → `openai_compat` (AI nội bộ TPB khi IT tích hợp). Không thêm OCR/đọc file vào GAS.
- **AI tư vấn:** chỉ đề xuất + giải thích, KHÔNG đổi kết luận engine; chỉ gửi cặp tên. Prompt + schema + gác = `BM.advisor.*` trong engine (nguồn duy nhất). Spec `AI_CONTEXT/ADVISOR_SPEC.md` · hợp đồng cho IT `AI_CONTEXT/AI_INTEGRATION_CONTRACT.md`. Dify (V2/V3) chỉ còn ở `_archive/dify/`.
- Kiểm UI thật (Chrome) sau khi đụng FE/OCR: `node tools/dev/ui_smoke.mjs` — OCR scan/xoay/ảnh/PDF chữ/XML + 0 request ra mạng + thẻ AI 2 chế độ (fixtures giả lập: `tools/dev/make_scan_fixtures.py`).
- Đo trên dữ liệu thật: `tools/eval/` chạy trên máy [TT]; dữ liệu GNOL/file gán nhãn KHÔNG vào repo (script tự chặn); chỉ báo cáo ẩn danh được gửi [CC].
