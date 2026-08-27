# test/live — smoke-test đường LIVE (chạy tay)

Kiểm thử end-to-end đường thật GAS → Dify / Drive OCR / reconcile. **Dữ liệu synthetic**, không PII thật.

## Chuẩn bị
```bash
cp test/live/config.example.mjs test/live/config.mjs   # điền GAS_URL (/exec) thật — file này gitignored
```

## Chạy
```bash
node test/live/test_verify_name.mjs   # (a) verify tên qua Dify: MATCH/NOT_MATCH/REVIEW + ai_status
node test/live/test_ocr.mjs           # (b) OCR ảnh hóa đơn (Drive OCR free) -> parse -> reconcile
```

## File
- `invoice_synth_01.png` — ảnh hóa đơn EVD **synthetic** để test OCR.
- `config.mjs` — URL endpoint (local, **không commit**). `*_response.json` — output lưu lại (không commit).

> Cần: GAS đã deploy `Code.gs`+`OcrService.gs`+`Recon.gs`; `USE_OCR=true` (cho OCR); `OCR_PROVIDER=drive` (mặc định free) hoặc `vision`+`VISION_API_KEY`; `DIFY_API_URL`/`DIFY_API_KEY` (cho verify tên).
