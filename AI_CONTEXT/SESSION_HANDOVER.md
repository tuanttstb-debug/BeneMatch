# SESSION HANDOVER — BeneMatch

**Từ phiên:** 2026-08-19 / Claude Code (Opus) · **Cho:** phiên kế tiếp

## Delta phiên (2026-08-19) #3 — Chốt kế hoạch & handover
- **Việc xong:** Chốt kế hoạch triển khai chi tiết **Phase 1 — Risk Engine Core** (8 bước: signal contract → A1 aggregation → A4 flag → A2 synthetic → C3 config → C2 audit → C1 harness → regression gate). Chuẩn bị handover + push git.
- **File đổi:** `SESSION_HANDOVER.md`, `PROJECT_STATE.md`, `TECH_DEBT.md` (delta); `TODO_NEXT.md` + `FEATURE_ROADMAP.md` đã cập nhật ở delta #2.
- **Quyết định:** Push thẳng lên `main` của repo BeneMatch (repo hub tài liệu, đọc từ main mỗi phiên; theo yêu cầu trực tiếp của [TT]). Registry AIOS commit riêng ở repo AIOS.
- **Blocker:** Chưa có endpoint/API key Dify Cloud (chặn Phase 0 GAS↔Dify). **Không chặn** prototype Phase 1 offline (logic Python thuần).
- **Bước kế:** Chờ [TT] chọn hướng — **(A)** prototype Phase 1 offline ngay · **(B)** hoàn tất Phase 0 nền demo trước · **(C)** commit/push xong rồi mới code.
- **Rủi ro hồi quy:** A1 (Phase 1) refactor Decision Engine → nguy cơ đổi hành vi 10 luật; **bắt buộc** chạy regression 7 case trước/sau, giữ field cũ trong `API_CONTRACT`, chỉ thêm field mới + bump version.

## Delta phiên (2026-08-19) #2 — Feature roadmap
- **Việc xong:** Đề xuất 15 tính năng (3 nhóm A/B/C), phân tích value/effort/phụ thuộc/xung đột ràng buộc, lập roadmap 5 phase. Chốt ưu tiên qua phỏng vấn.
- **File đổi:** Tạo `AI_CONTEXT/FEATURE_ROADMAP.md`; cập nhật `TODO_NEXT.md` (roadmap theo phase), `SESSION_HANDOVER.md`.
- **Quyết định:** (1) Sau Phase 0 làm **Phase 1 Risk engine core** trước. (2) Mở rộng **cả 4 bên** (payer/MST/account-holder/supplier-contract). (3) **B3 account holder = warn-only**, tách B3a synthetic (P2) / B3b FCC (P3). (4) **A2 screening = danh sách synthetic → kéo lên Phase 1**. (5) C5 mặc định đề xuất fail-open→REVIEW (chốt lại P3).
- **Blocker:** Vẫn chờ endpoint/API key Dify (Phase 0). Phase 1 refactor A1 phải giữ tương thích `API_CONTRACT`.
- **Bước kế:** Bắt đầu **Phase 1** — thiết kế A1 (schema risk_score/band/contributing_signals) + A4 flag + A2 synthetic list; hoặc hoàn tất Phase 0 nền demo trước (theo lựa chọn của [TT]).
- **Rủi ro hồi quy:** A1 refactor Decision Engine → nguy cơ đổi hành vi 10 luật hiện tại; phải chạy regression 7 case (`GOLDEN_DATASET`) trước/sau. Giữ field cũ trong response, chỉ thêm field mới + bump version.

## Delta phiên (2026-08-19) #1 — Khởi tạo dự án
- **Việc xong:** Scan 2 file nguồn (`Beneficiary Legal Entity Verification V2.yml` + `..._Handover.docx`); nắm toàn bộ nghiệp vụ + workflow Dify as-built. Phỏng vấn 2 vòng chốt scope/kiến trúc/định danh. Chạy `init-project` (PRJ-BM) → scaffold + đăng ký registry AIOS. Viết đủ bộ AI_CONTEXT: 5 lõi + DESIGN_SYSTEM + 8 design docs.
- **File đổi:** Tạo `AI_CONTEXT/*` (14 file) + `CLAUDE.md`. Trong AIOS: `04_Knowledge/projects/PRJ-BM.md`, `00_System/PORTFOLIO.md`, `00_System/INDEX.md`, `03_Skills/portfolio-digest/projects.json`.
- **Quyết định:** Stack mirror SG (FE Bootstrap → GAS → Dify → Sheet). Vị trí = chốt kiểm trong luồng SHTD. Demo kể 4 tuyến rủi ro. Data **chỉ synthetic** (được publish artifact). Timeline linh hoạt. ID = PRJ-BM. Owner PER-TTT.
- **Blocker:** Chưa có endpoint/API key Dify Cloud để GAS gọi (chờ [TT]).
- **Bước kế:** Xem `TODO_NEXT.md` mục Cao — lấy endpoint Dify; dựng dataset synthetic; quyết định xử lý [TD-BM-01] Warning Route; dựng GAS + Sheet.
- **Rủi ro hồi quy:** Chưa có code demo nên chưa có rủi ro hồi quy. Lưu ý as-built có 2 tech-debt đã ghi (`TECH_DEBT.md`) — đừng "sửa im lặng" nếu bản demo cố ý giữ để minh họa rủi ro.

## Cách bắt đầu một phiên (bắt buộc)
1. `git pull`.
2. Đọc `AI_CONTEXT/PROJECT_STATE.md` + `TODO_NEXT.md` + file này (delta mới nhất trên cùng).
3. Làm việc nhỏ → commit nhỏ → cập nhật context → `git push`.

## Gotchas
- **Nguồn sự thật của lõi verify = file `.yml` + `.docx`** ở gốc repo, KHÔNG phải trí nhớ. Dùng đúng code tuned trong đó làm baseline, không quay lại prototype cũ.
- Decision Engine cần **đủ 17 input** map đúng type (Boolean/Number/String) — thiếu 1 biến là `main()` lỗi positional argument.
- Số tài khoản luôn để **String** (tránh mất số 0 đầu). Không dùng Number.
- Đọc `.docx` bằng python cần ép **UTF-8** (`python -X utf8`) trên Windows, nếu không lỗi cp1252 với ký tự tiếng Việt.
- LLM chỉ nên chạy ở nhánh REVIEW+ai_eligible=true — hiện as-built chưa chặn (xem TD-BM-01).
