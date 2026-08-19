---
id: PRJ-BM
type: project-card
title: BeneMatch — API xác minh tên pháp nhân bên thụ hưởng trước giải ngân (PoC/Demo TPBank)
status: active
owner: PER-TTT
tags: [beneficiary, verification, name-matching, legal-entity, dify, gas, poc, tpbank, shtd]
related: [PRJ-SHTD, SYS-TPBANK, REF-TPBANK-DELIVERY, PRJ-SG, PER-TTT]
created: 2026-08-19
updated: 2026-08-19
version: 1
source: https://github.com/tuanttstb-debug/BeneMatch
---

## Tóm tắt điều hành
**BeneMatch** là API **xác minh tên pháp nhân bên thụ hưởng** trước khi giải ngân: đối chiếu **tên trên hóa đơn** với **tên trên đề nghị chuyển tiền**, kết luận **MATCH / REVIEW / NOT_MATCH** để chặn sai lệch người nhận tiền. Lõi đã chạy trên **Dify Cloud** (rule-based deterministic + AI chỉ diễn giải cảnh báo). Dự án này dựng **bản demo** (FE + GAS gateway + Dify) để **nhận diện rủi ro sớm khi tích hợp rộng hơn** vào luồng tín dụng. **PoC/Demo cho TPBank — chưa production.**

## Bối cảnh nghiệp vụ
- **Người dùng:** cán bộ tín dụng/giải ngân TPBank; điểm kiểm nằm trong luồng **SHTD (`PRJ-SHTD`)** — giải ngân theo hóa đơn.
- **Vấn đề:** tên bên thụ hưởng trên hóa đơn và trên lệnh chuyển tiền thường lệch do viết tắt (CTY/CTCP/TNHH/JSC/LTD), có dấu/không dấu, dấu câu, `&`, đảo thứ tự token, hoặc lỗi OCR — cần phân biệt "khác cách viết" với "khác pháp nhân".
- **Ràng buộc bất biến:** quyết định cuối **luôn do Rule Engine deterministic**; AI/fuzzy **không được override**. Khác loại hình pháp nhân là **hard rule → NOT_MATCH**. Xem `DECISION_RULES.md`.

## Mục tiêu bản demo (4 tuyến kể cho stakeholder TPBank)
1. **Nghiệp vụ core** — chặn sai lệch pháp nhân bên thụ hưởng khi giải ngân theo hóa đơn.
2. **Bản đồ tích hợp** — lộ điểm chạm & rủi ro khi nối API vào luồng tín dụng (xem `INTEGRATION_MAP.md`).
3. **Ranh giới AI/rule** — chứng minh AI không tham gia quyết định (`used_for_decision=false`), trấn an compliance.
4. **Chất lượng nhận diện** — đo MATCH/REVIEW/NOT_MATCH & False Match trên bộ mẫu (`GOLDEN_DATASET.md`).

## Phạm vi & không thuộc phạm vi
- **Trong:** verify tên pháp nhân (VN) + supporting signal số tài khoản; FE demo nhập/hiển thị kết quả; GAS gateway; workflow Dify hiện có; bộ mẫu **synthetic**; regression 7 case.
- **Ngoài (giai đoạn này):** OCR sửa lỗi tự động (V1ET→VIET…); xóa hàng loạt từ ngành nghề/địa danh; dùng account mismatch để block; RAG/vector DB/fine-tuning/autonomous Agent; xác minh chủ tài khoản/mã số thuế; dữ liệu khách hàng thật (chỉ synthetic — RULE-data-boundary).

## Quan hệ với dự án khác / AIOS
- **Kiến trúc** mirror **`PRJ-SG` (Smart Guarantee)**: FE Bootstrap → GAS gateway → Dify Workflow → Google Sheet.
- **Nghiệp vụ/luồng** gắn **`PRJ-SHTD`** (tín dụng) và bối cảnh hệ thống **`SYS-TPBANK`** (FCC/BPM/ESignHub/CBadmin…).
- **UI/UX** kế thừa nhận diện "TPBank BIZ" tím-first như SG/SHTD — xem `DESIGN_SYSTEM.md`.
