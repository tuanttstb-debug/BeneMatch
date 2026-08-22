# SYSTEM ARCHITECTURE — BeneMatch (demo)

**Cập nhật:** 2026-08-22 · Kiến trúc mirror `PRJ-SG`. Configuration-driven.

> **v0.2 — thêm tầng Batch Reconciliation** (đa hóa đơn ↔ đa lệnh CT). Luồng verify 1 cặp tên (bên dưới) **giữ nguyên** làm lõi; tầng recon gọi lại lõi này cho từng nhóm người thụ hưởng. Xem `RECONCILIATION_SPEC.md` + `OCR_SPEC.md`.

## Sơ đồ Batch Reconciliation (v0.2)
```
[FE Bootstrap]  upload N hóa đơn (ảnh/PDF) + 1 CSV lệnh CT
     │  POST multipart/base64
     ▼
[GAS Gateway]  doPost
   1. OCR hóa đơn:  USE_OCR=true → Vision (OcrService.gs) | false → synthetic fixtures   (OCR_SPEC)
   2. Parse CSV lệnh CT → transfer_orders[]
   3. Recon.gs = port của src/recon:  normalize → group theo MST/tên
        → sum nhóm + grand total → tolerance/over-under → duplicate → OCR flag
   4. Verify tên từng nhóm:  POST Dify V2 (1 cặp/nhóm)   ← chỉ đây mới (có thể) chạm AI
   5. Aggregate deterministic → batch response (RECONCILIATION_SPEC §6)
   6. Log Sheet + trả FE
     │
     ▼
[Dify V2]  verify tên 1 cặp/nhóm (rule-first, LLM chỉ REVIEW&ai_eligible=true — DIFY_OPTIMIZATION)
[Google Sheet]  log batch + config threshold/weights (C3) + audit (C2)
```
- **Recon engine `src/recon/`** = JS thuần, **test offline** (`test/recon.test.mjs`) không cần endpoint; `Recon.gs` là bản port chạy trong GAS. Cùng logic, cùng dataset synthetic.

---

## Sơ đồ verify 1 cặp (lõi, giữ nguyên)

## Sơ đồ tổng thể
```
[FE HTML + Bootstrap]  (form 5 biến + result card, TPBank BIZ tím-first)
        │  POST (JSON)
        ▼
[GAS Gateway]  Apps Script Web App — doPost()
   - Validate input (5 biến; account là String)
   - Gọi Dify Workflow API (endpoint + API key ở Script Properties)
   - Ghi log request/response vào Google Sheet
   - Trả result card JSON cho FE
        │  HTTPS (Bearer API key)
        ▼
[Dify Workflow — Beneficiary Legal Entity Verification V2]  (Dify Cloud)
   START → Normalize → Extract Legal Type → Similarity → Warning Metrics
         → Decision Engine → Warning Route → (Build Match | Build Not Match
         | LLM→Validate AI) → Build API Response → OUTPUT
        │
        ▼
[Google Sheet]  log (1 dòng/lần) + config (threshold, feature flags)
```

## Thành phần & trách nhiệm
| Lớp | Công nghệ | Trách nhiệm | Không làm |
|---|---|---|---|
| FE | HTML + Bootstrap 5 | Nhập/hiển thị; gọi GAS; render result card | Không chứa API key; không tự quyết định |
| Gateway | Google Apps Script (Web App) | Xác thực input, proxy sang Dify, log Sheet, che API key | Không chứa business logic verify |
| Verify core | Dify Workflow (Cloud) | Chuẩn hóa, similarity, **Rule Engine quyết định**, LLM diễn giải | AI **không** ra quyết định |
| Store | Google Sheet | Log giao dịch + config threshold | Không chứa dữ liệu KH thật (demo = synthetic) |

## Luồng dữ liệu (happy path)
1. FE gửi `{request_id, invoice_beneficiary_name, payment_beneficiary_name, invoice_account_number?, payment_account_number?}`.
2. GAS validate → `POST` Dify `/workflows/run` với `inputs` = 5 biến, `response_mode: blocking`.
3. Dify trả `data.outputs.result` (object `response`, xem `API_CONTRACT.md`).
4. GAS log Sheet + trả về FE.
5. FE render card theo `decision`/`action`/`risk_level` + `user_warning`.

## Cấu hình (configuration-driven)
- **Script Properties (GAS):** `DIFY_API_URL`, `DIFY_API_KEY`, `SHEET_ID`, `LOG_SHEET_NAME`.
- **Sheet `config`:** threshold overrides (chỉ để tham chiếu/tuning; nguồn quyết định vẫn là Rule Engine trong Dify), feature flags demo.
- **Không hard-code** endpoint/key trong FE.

## Ranh giới an toàn (RULE-data-boundary)
- Demo **chỉ synthetic** → FE/artifact được publish.
- Nếu về sau dùng mẫu thật: **không** đẩy lên artifact/cloud ngoài phạm vi TPBank; xử lý local.

## [CHỜ NỘI DUNG]
- `DIFY_API_URL` + `DIFY_API_KEY` thật (chờ [TT]).
- Google Sheet ID + cấu trúc tab (xem `DATA_MODEL.md`).
- URL Web App GAS sau khi deploy.
