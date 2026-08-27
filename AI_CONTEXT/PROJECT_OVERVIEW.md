---
id: PRJ-BM
type: project-card
title: BeneMatch — API xác minh tên pháp nhân bên thụ hưởng trước giải ngân (PoC/Demo TPBank)
status: active
owner: PER-TTT
tags: [beneficiary, verification, name-matching, legal-entity, dify, gas, poc, tpbank, shtd]
related: [PRJ-SHTD, SYS-TPBANK, REF-TPBANK-DELIVERY, PRJ-SG, PER-TTT]
created: 2026-08-19
updated: 2026-08-27
version: 2
source: https://github.com/tuanttstb-debug/BeneMatch
demo_url: https://tuanttstb-debug.github.io/BeneMatch/
---

## Tóm tắt điều hành
**BeneMatch** đối chiếu **lô hóa đơn ↔ lệnh chuyển tiền** để bắt bốn nhóm rủi ro chi tiền: **sai người thụ hưởng** (khác pháp nhân), **lệch số tiền** (thừa/thiếu ngoài dung sai), **hóa đơn trùng** (trả hai lần), **thiếu chứng từ**. Lõi khớp tên pháp nhân chạy trên **Dify Cloud** (rule-based deterministic + AI chỉ diễn giải cảnh báo). **Mục tiêu hiện tại (2026-08-27):** một **trang demo public trên GitHub Pages** giới thiệu năng lực cho nhân sự xem/thử và **lấy góp ý** — chạy hoàn toàn trong trình duyệt với **dữ liệu synthetic** (không PII thật). **PoC/Demo cho TPBank — chưa production.**

## Mục tiêu bản demo public (chốt 2026-08-27)
- **Đối tượng:** nhân sự nghiệp vụ TPBank (không kỹ thuật) — xem/thử qua **link chia sẻ**, phản hồi.
- **Hình thức:** static site `docs/index.html` trên **GitHub Pages**, tự chứa, offline-in-browser (không backend, không lộ endpoint) → an toàn cho link public.
- **Data-boundary:** **CHỈ synthetic** — không upload ảnh/hóa đơn/PII thật; banner cảnh báo rõ trên trang.
- **Kể chuyện rủi ro:** bộ **kịch bản có tên** (`data/synthetic/scenarios.json`) — bấm 1 phát thấy MATCH/REVIEW/NOT_MATCH + diễn giải.
- *(Đường live GAS→D→Dify + OCR vẫn tồn tại trong `gas/` cho nội bộ/nghiệm thu, KHÔNG nhúng vào trang public.)*

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
