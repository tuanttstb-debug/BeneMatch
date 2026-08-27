# BeneMatch

**Đối chiếu lô hóa đơn ↔ lệnh chuyển tiền — bắt sai người thụ hưởng, lệch tiền, hóa đơn trùng, thiếu chứng từ.**
Deterministic-first: quyết định về tiền & trùng theo luật (không AI); AI chỉ diễn giải cảnh báo cho số ít ca khớp tên mơ hồ.

## 🔗 Demo trực tuyến

👉 **https://tuanttstb-debug.github.io/BeneMatch/**

> ⚠️ Trang demo chạy **hoàn toàn trong trình duyệt** với **dữ liệu mẫu (synthetic)**. **Không nhập hóa đơn, số tài khoản hay dữ liệu khách hàng thật.** Đây là bản giới thiệu năng lực để lấy góp ý — chưa phải hệ thống production.

## Demo cho thấy gì?

Chọn một tình huống, BeneMatch gộp theo người thụ hưởng và cho kết luận **MATCH** (cho qua) / **REVIEW** (cần kiểm tra) / **NOT_MATCH** (chặn):

| Tình huống | Kết luận | Bắt được gì |
|---|---|---|
| Khớp sạch | MATCH | Tên & tiền khớp — cho qua |
| Sai người thụ hưởng (khác pháp nhân) | NOT_MATCH | Hóa đơn CỔ PHẦN nhưng lệnh TNHH → chặn chuyển sai thực thể |
| Lệch tiền (thừa chi) | REVIEW | Chi 50tr cho hóa đơn 40tr — vượt dung sai |
| Hóa đơn trùng | REVIEW | Hai hóa đơn cùng tiền/ngày — nghi trả hai lần |
| Thiếu chứng từ | REVIEW | Hóa đơn thiếu lệnh CT (hoặc ngược lại) |
| Tên gần giống | REVIEW | Tên lệch nhẹ — cần người kiểm (AI diễn giải) |
| Lô tổng hợp | (trộn) | Một lô thực tế nhiều nhóm, xếp rủi ro cao lên trước |

## Kiến trúc

- **Lõi logic** `src/recon/` — engine đối chiếu deterministic (gộp nhóm → tổng nhóm/grand total → dung sai → duplicate → OCR flag → verify tên). Nguồn logic **duy nhất**.
- **Khớp tên pháp nhân** — workflow Dify "Beneficiary Legal Entity Verification V2" (rule engine + AI chỉ cho ~<10% ca REVIEW mơ hồ). Bản offline dùng stub deterministic tương đương.
- **Bản port GAS** `gas/Recon.gs` — parity byte-identical với `src/recon` (gate `gas/verify_recon.mjs`), phục vụ gateway live + OCR hóa đơn (Google Drive OCR **miễn phí** / Google Vision).
- **Trang demo** `docs/index.html` — sinh từ template + engine + dữ liệu synthetic qua `fe/build.mjs`. Tự chứa, tĩnh, host trên GitHub Pages.

## Chạy / build

```bash
node fe/build.mjs          # sinh fe/index.html + docs/index.html (bản host Pages)
node test/recon.test.mjs   # regression engine (14 case)
node gas/verify_recon.mjs  # parity Recon.gs ≡ src/recon
```

Xem trọn bối cảnh nghiệp vụ, luật quyết định, kiến trúc tích hợp trong `AI_CONTEXT/`.

## Dữ liệu & bảo mật

Toàn bộ dữ liệu trong repo và trang demo là **synthetic** (tên/MST/số tài khoản hư cấu). Không có dữ liệu khách hàng thật. Trang public không lưu trữ đầu vào — đối chiếu chạy tại chỗ trong trình duyệt.

---
*PoC/Demo cho TPBank. Owner: PER-TTT.*
