# AI_INTEGRATION_CONTRACT — Hợp đồng tích hợp AI tư vấn BeneMatch (cho IT TPBank)

> Phiên bản 1.0 · 2026-10-08 · engine 3.2.0 · prompt `bm-advisor-prompt-1`. Đọc kèm `ADVISOR_SPEC.md` (chính sách, chỉ tiêu).
> **Mục tiêu:** khi tích hợp, IT **chỉ thay mô hình AI** (Gemini → AI nội bộ TPBank). OCR, logic đối chiếu, prompt, schema, lớp gác giữ nguyên.

## 1. Nguyên tắc (bất biến)
1. **AI chỉ tư vấn.** Kết luận KHỚP / CẦN KIỂM TRA / KHÔNG KHỚP do engine luật quyết định (`used_for_decision=false`). AI lỗi/không trả lời → hồ sơ vẫn ra kết luận bình thường.
2. **Chỉ gửi cặp tên** (tên bên bán trên hóa đơn + tên người thụ hưởng trên UNC) + tóm tắt engine. **Không** số tiền, STK, MST, thông tin KH vay, file hóa đơn.
3. **Chỉ hỏi ca khó:** CẦN KIỂM TRA (trừ thiếu dữ liệu) + KHÔNG KHỚP "mềm" (`LOW_NAME_SIMILARITY`, `DISTINCTIVE_NAME_DIFFERENT`). Không hỏi KHỚP, không hỏi khác loại hình pháp nhân (luật cứng). Thực tế ≈ 5–15% số cặp tên.
4. **OCR không đi qua AI/cloud:** đọc PDF/ảnh chạy tại máy (giai đoạn 1: trình duyệt) hoặc hệ thống nguồn (giai đoạn 2: BIZ).

## 2. Kiến trúc 3 lớp
```
[LOCAL — trình duyệt cán bộ / BIZ]   XML · PDF chữ · PDF scan · ảnh → OCR offline (pdf.js + tesseract nhúng, tự xoay, xoá kẻ)
                                     → bóc trường → cán bộ xác nhận → ENGINE ra kết luận (dữ liệu không rời máy)
            │  POST {action:"advise_names", pairs:[{invoice_name, payment_name}]}   (chỉ cặp tên)
            ▼
[LOGIC — GAS gas/Code.gs]            mã truy cập + hạn mức · TỰ TÍNH LẠI engine (không tin client) · chọn ca · dựng prompt
                                     (BM.advisor.prompt) · ADAPTER · đọc output (BM.advisor.parse) · LỚP GÁC (BM.advisor.guard) · log không tên
            │  AI_PROVIDER = gemini | openai_compat
            ▼
[AI — thay được]                     Hiện tại: Gemini API (gemini-3.8-flash) · Tích hợp: AI nội bộ TPBank (chuẩn /chat/completions)
```
Nguồn duy nhất của prompt + schema + gác: `src/engine/bm-engine.js` mục 6 (`BM.advisor.*`) — JS thuần, chạy được trên trình duyệt, GAS và Node.

## 3. Hai cách IT thay AI

### Cách A — giữ cổng GAS, đổi cấu hình (0 dòng code) — khuyến nghị cho pilot
Apps Script → Project Settings → Script Properties:

| Property | Giá trị |
|---|---|
| `AI_PROVIDER` | `openai_compat` |
| `AI_BASE_URL` | URL cổng AI nội bộ, vd `https://<ai-gateway>/v1` (tự nối `/chat/completions`; hoặc ghi URL đầy đủ kết thúc `/chat/completions`) |
| `AI_MODEL` | tên model nội bộ |
| `AI_MODEL_FALLBACKS` | (tùy chọn) model dự phòng khi model chính quá tải, cách nhau dấu phẩy — Gemini mặc định `gemini-3.5-flash-lite,gemini-3.6-flash`; nội bộ mặc định không có |
| `AI_API_KEY` | token do IT cấp |
| `AI_AUTH_HEADER` | mặc định `Authorization` (gửi `Bearer <token>`); tên khác (vd `api-key`) → gửi token thô |
| `AI_EXTRA_HEADERS` | (tùy chọn) JSON header phụ, vd `{"X-App-Id":"benematch"}` |
| `AI_RESPONSE_FORMAT` | `json_schema` (mặc định) · `json_object` · `none` — theo khả năng của model |
| `AI_ALLOW_REAL_DATA` | `true` — **chỉ bật khi model chạy trong hạ tầng TPBank / có cam kết dữ liệu** |

Kiểm: editor → chạy hàm `kiemTraAI` (1 cặp tên giả lập) → xem Execution log. **Điều kiện:** GAS (máy chủ Google) phải gọi được URL cổng AI — nếu cổng chỉ mở trong mạng nội bộ thì dùng Cách B.

### Cách B — IT dựng service trong hạ tầng TPBank (giai đoạn 2: BIZ → BPM)
Port `handleAdviseNames_` sang service nội bộ (Node chạy thẳng `bm-engine.js`; ngôn ngữ khác → port 4 hàm `eligible / payload / prompt / guard` + giữ nguyên chuỗi `SYSTEM_PROMPT`). Kiểm bằng §7 trước khi thay.

## 4. Yêu cầu với endpoint AI nội bộ (`openai_compat`)
**Request** (GAS gửi):
```json
POST {AI_BASE_URL}/chat/completions
Authorization: Bearer <AI_API_KEY>
{
  "model": "<AI_MODEL>",
  "messages": [
    { "role": "system", "content": "<BM.advisor.SYSTEM_PROMPT>" },
    { "role": "user",   "content": "Tên bên bán trên HÓA ĐƠN: CÔNG TY TNHH SAO VIỆT\nTên người thụ hưởng trên UNC: VIETSTAR COMPANY LIMITED\n\nKết quả engine luật (tham khảo): NOT_MATCH — mã DISTINCTIVE_NAME_DIFFERENT — độ tương đồng kỹ thuật 32%\nDiễn giải engine: …\nLoại hình (họ): hóa đơn = TNHH; UNC = TNHH\nTên lõi sau chuẩn hóa: hóa đơn = SAO VIET; UNC = VIETSTAR\n\nĐánh giá hai tên và trả JSON theo schema." }
  ],
  "response_format": { "type": "json_schema", "json_schema": { "name": "benematch_advice", "strict": true, "schema": { …§5… } } }
}
```
**Response** tối thiểu: `choices[0].message.content` = chuỗi JSON đúng §5 (chấp nhận có ```json hoặc chữ thừa quanh JSON — GAS tự bóc). `usage.prompt_tokens/completion_tokens` nếu có (ghi log chi phí).

| Tiêu chí | Yêu cầu |
|---|---|
| Ngôn ngữ | Hiểu tiếng Việt có dấu/không dấu + tên tiếng Anh doanh nghiệp |
| Độ trễ | ≤ 40 giây / lô 10 cặp gọi **song song** (GAS `fetchAll`, 10 request đồng thời) |
| Lỗi tạm thời | trả HTTP 429/5xx → GAS tự gọi lại tối đa 2 lần (chờ 2,5 s · 5 s), vẫn lỗi → chuyển model trong `AI_MODEL_FALLBACKS` |
| Lưu trữ | Không lưu/huấn luyện trên nội dung request (tên KH) — xác nhận bằng văn bản trước khi bật `AI_ALLOW_REAL_DATA` |
| Tham số | Không bắt buộc temperature; nếu model hỗ trợ, để thấp/mặc định |

## 5. Output schema (JSON Schema — nguồn: `BM.advisor.schema()`)
```json
{
  "type": "object", "additionalProperties": false,
  "required": ["verdict", "relation", "confidence", "evidence", "explanation", "checks_for_officer"],
  "properties": {
    "verdict":  { "type": "string", "enum": ["SAME_ENTITY", "DIFFERENT_ENTITY", "RELATED_ENTITY", "UNCERTAIN"] },
    "relation": { "type": "string", "enum": ["IDENTICAL", "ABBREVIATION", "TRANSLATION", "TRANSLITERATION", "TRUNCATION", "TYPO_OCR", "BRANCH", "PARENT_SUBSIDIARY", "RENAMED", "UNRELATED", "UNKNOWN"] },
    "confidence": { "type": "number" },
    "evidence": { "type": "array", "items": { "type": "string" }, "maxItems": 4 },
    "explanation": { "type": "string" },
    "checks_for_officer": { "type": "array", "items": { "type": "string" }, "maxItems": 3 }
  }
}
```
Adapter Gemini tự chuyển sang dạng schema của Gemini (kiểu viết hoa, bỏ `additionalProperties`).

## 6. Lớp gác (luôn chạy sau AI — GAS và trình duyệt)
- verdict/relation ngoài enum → `UNCERTAIN` / `UNKNOWN`; confidence kẹp 0..1; output hỏng → `ai_status=FALLBACK`.
- AI nói CÙNG nhưng **khác loại hình** → `UNCERTAIN`, confidence ≤ 0,5.
- AI nói CÙNG + `PARENT_SUBSIDIARY` → `RELATED_ENTITY` · một bên là Tổng công ty → `UNCERTAIN` · `RENAMED` → confidence ≤ 0,6.

## 7. Nghiệm thu khi thay model (bắt buộc)
1. `node test/gas_advisor.test.mjs` (adapter, không gọi AI thật) — 100% pass.
2. `node tools/eval/advisor_smoke.mjs --ai-url <URL cổng> --ai-code <mã>` — 22 ca khó GIẢ LẬP: **AI nói CÙNG sai = 0**, **FALLBACK = 0**, chấp nhận được ≥ 18/22.
3. Đo lịch sử GNOL đã gán nhãn (`tools/eval/README.md`) theo chỉ tiêu `ADVISOR_SPEC §5`: AI nói CÙNG nhưng thực tế KHÁC ≤ 2%; độ đúng khi trả lời dứt khoát ≥ 90%; engine khớp nhầm = 0.
4. Đạt → bật `AI_ALLOW_REAL_DATA=true`. Không đạt → chỉnh prompt (đổi `PROMPT_VERSION`) hoặc ngưỡng hiển thị, đo lại.

## 8. Mã lỗi cổng (`advise_names`)
| error | Ý nghĩa |
|---|---|
| `ACCESS_DENIED` | Sai/thu hồi mã truy cập |
| `ADVISOR_NOT_CONFIGURED` | Thiếu `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` hoặc `AI_PROVIDER` lạ |
| `REAL_DATA_NOT_ALLOWED` | Cổng ở chế độ thử (`AI_ALLOW_REAL_DATA` tắt) và request không kèm `data_attest:"ANONYMIZED"` |
| `QUOTA_EXCEEDED` | Vượt `ADVISOR_DAILY_LIMIT` cặp/mã/ngày |
| (từng cặp) `ai_status=FALLBACK` + `diag` | Model lỗi/không đúng schema — kết luận engine không đổi |

## 9. Hiện trạng (2026-10-08)
- Mô hình đang gắn: **Gemini API trực tiếp (gói miễn phí)** — chỉ dùng tên giả lập/đã ẩn danh (`AI_ALLOW_REAL_DATA` tắt; giao diện bắt cán bộ tick xác nhận).
- Đã bỏ hoàn toàn Dify (file cũ ở `_archive/dify/`).
