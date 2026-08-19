# DESIGN_SYSTEM — BeneMatch (FE demo)

Kế thừa nhận diện **"TPBank BIZ" tím-first** (như `PRJ-SG`/`PRJ-SHTD`). FE là **1 trang Bootstrap 5**, gọn để demo cho stakeholder — không dashboard.

## Nguyên tắc
- **Tím-first** (TPBank BIZ) làm màu thương hiệu; trạng thái dùng màu ngữ nghĩa.
- Ngôn ngữ **ít kỹ thuật**, hướng nghiệp vụ; mọi con số kèm chú thích (đặc biệt "difference %").
- **Theme-aware** nếu publish artifact (light/dark).
- Không lộ chi tiết kỹ thuật gây hiểu nhầm (không gọi similarity là "xác suất").

## Màu trạng thái (result card)
| decision | action | Màu | Ý nghĩa hiển thị |
|---|---|---|---|
| MATCH | ALLOW | 🟢 xanh lá | "Tên bên thụ hưởng phù hợp" |
| REVIEW | WARN | 🟡 vàng/cam | "Cần kiểm tra tên bên thụ hưởng" |
| NOT_MATCH | BLOCK | 🔴 đỏ | "Tên bên thụ hưởng không phù hợp" |

## Layout đề xuất (1 trang)
1. **Header** — logo/tên "BeneMatch" + tag "PoC/Demo TPBank".
2. **Form nhập** (card): request_id · invoice_beneficiary_name · payment_beneficiary_name · invoice_account_number · payment_account_number. Nút "Kiểm tra".
   - Chip **case mẫu** (7 case synthetic) để demo nhanh.
3. **Result card** (đổi màu theo decision):
   - Badge decision/action/risk.
   - `warning_title` + `warning_message`.
   - `checks_required` (list ≤3) khi REVIEW/NOT_MATCH.
   - `difference_display` ("Mức độ khác biệt tên: NN%") + **nút info** hiện `difference_metric_note` (disclaimer).
   - Dòng nhỏ: `decision_source=RULE_ENGINE` · `generated_by_ai` · `ai_status` — **nhấn ranh giới AI/rule**.
4. **Panel phụ (tùy chọn cho stakeholder):**
   - "Bản đồ tích hợp" (từ `INTEGRATION_MAP.md`) — nơi BeneMatch chèn vào luồng SHTD.
   - "Vì sao không chỉ dùng AI" — minh họa deterministic-first.

## Thành phần nhấn mạnh cho 4 tuyến demo
- **Nghiệp vụ core:** result card rõ ràng, case mẫu chạy tức thì.
- **Bản đồ tích hợp:** sơ đồ luồng + risk register rút gọn.
- **Ranh giới AI/rule:** hiển thị `decision_source`, `used_for_decision=false`, badge "AI chỉ diễn giải".
- **Chất lượng nhận diện:** (tùy chọn) bảng chạy 7 case + kết quả pass/fail.

## Component tokens
- Dùng Bootstrap 5 utilities; primary = tím TPBank BIZ. Nếu cần chuẩn token chi tiết → tham chiếu `PRJ-SG/AI_CONTEXT/DESIGN_SYSTEM.md`.

## Ràng buộc
- FE **không** chứa API key (đi qua GAS).
- Chỉ dữ liệu synthetic → FE/artifact được publish (RULE-data-boundary).
