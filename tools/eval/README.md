# tools/eval — đo chất lượng BeneMatch (engine + AI tư vấn) trên dữ liệu GNOL

**Chạy trên máy anh. Dữ liệu thật KHÔNG vào repo** — script tự chặn ghi vào thư mục repo. Chỉ file báo cáo `BeneMatch_danh_gia_<ngày>.md` (đã ẩn danh) được gửi cho em.

## Cài 1 lần
```bash
cd D:\Workspace\Production\BeneMatch\tools\eval
npm install
```

## Quy trình
| Bước | Lệnh | Kết quả |
|---|---|---|
| 1. Lấy file mẫu | `node tools/eval/template.mjs --out "D:\Công việc\BeneMatch_eval"` | `BeneMatch_GNOL_trich_MAU.xlsx` (sheet HoaDon + UNC) |
| 2. Trích GNOL | Dán dữ liệu trích lịch sử GNOL vào file mẫu (≥ 200 cặp tên; ưu tiên hồ sơ từng bị hỏi lại vì tên) | `GNOL_<kỳ>.xlsx` (local) |
| 3. Chuẩn bị gán nhãn | `node tools/eval/prepare.mjs --in "D:\Công việc\BeneMatch_eval\GNOL_<kỳ>.xlsx" --out "D:\Công việc\BeneMatch_eval" --ai-url <URL cổng> --ai-code <mã>` | `BeneMatch_gan_nhan_<ngày>.xlsx` — toàn bộ ca không khớp/cần kiểm tra + mẫu ca khớp, có sẵn ý kiến AI |
| 4. Gán nhãn | Cán bộ điền cột **NHÃN**: `CUNG` / `KHAC` / `LIEN_QUAN` / `KHONG_RO` (+ nhóm ca khó). Nên ẩn cột AI khi gán để không bị thiên lệch. | file gán nhãn (local) |
| 5. Chấm điểm | `node tools/eval/score.mjs --in "<file gán nhãn>" --out "D:\Công việc\BeneMatch_eval"` | `BeneMatch_danh_gia_<ngày>.md` — **gửi em file này** |

Bỏ `--ai-url/--ai-code` ở bước 3 nếu chỉ muốn đo engine (không gửi gì ra ngoài).

## Thử cổng AI trên 22 ca giả lập (sau khi deploy)
```bash
node tools/eval/advisor_smoke.mjs --ai-url <URL cổng …/exec> --ai-code <mã>
```

## Thử không cần deploy (cổng giả lập)
```bash
node tools/dev/mock_proxy.mjs          # URL http://127.0.0.1:8790/exec · mã DEV-LOCAL (AI giả lập, số liệu không có ý nghĩa)
```
