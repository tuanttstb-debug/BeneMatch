# ADVISOR_SPEC — AI tư vấn nhận diện tên (LLM, chỉ tham khảo)

> Bổ sung cho `ENGINE_V3_SPEC.md`. Chốt phỏng vấn [TT] 2026-09-28 (vòng 3–5). **Cập nhật 2026-10-08 (engine 3.2.0): bỏ Dify** — [TT] duyệt kiến trúc 3 lớp: OCR tại máy · GAS xử lý logic + gọi AI trực tiếp · Gemini (gói miễn phí, chỉ dữ liệu giả lập/ẩn danh) → khi tích hợp IT thay bằng AI nội bộ TPBank. Hợp đồng cho IT: **`AI_INTEGRATION_CONTRACT.md`**.

## 1. Quyết định ([TT] chốt)
| Chủ đề | Quyết định |
|---|---|
| Vì sao cần LLM | Tên KHDN phức tạp; luật không hiểu **nghĩa**: tên tiếng Anh/giao dịch, viết tắt thương hiệu, tổng cty ↔ cty con/CN, đổi tên / tên dài / lỗi OCR (cả 4 nhóm [TT] chọn). |
| Nền tảng | **(08/10)** GAS gọi **Gemini API trực tiếp** (structured output) — model chính **`gemini-3.5-flash-lite`** ([TT] chốt 08/10 vì 3.8 Flash quá tải liên tục), dự phòng `gemini-3.6-flash → gemini-3.8-flash` — **không qua Dify**. Key Gemini **gói miễn phí** ⇒ `AI_ALLOW_REAL_DATA` TẮT: chỉ tên giả lập/đã ẩn danh, FE bắt tick xác nhận (gói miễn phí: Google được dùng dữ liệu + người duyệt đọc). Dữ liệu thật: chờ **AI nội bộ TPBank** (`AI_PROVIDER=openai_compat`) hoặc key trả phí. *(28/09: Dify Cloud + Gemini trả phí — đã thay.)* |
| Quyền của LLM | **Chỉ đề xuất + giải thích.** Kết luận engine giữ nguyên (`used_for_decision=false`). |
| Đường gọi (giai đoạn 1) | Công cụ cán bộ → **GAS** (giữ key AI, tự tính lại engine, dựng prompt, gác) → model. Xác thực bằng **mã truy cập cấp riêng** (thu hồi được, hạn mức/ngày). |
| Lộ trình | G1: công cụ cán bộ + đo chất lượng trên lịch sử GNOL · G2: service trong luồng GNOL (BIZ → BPM) do IT xây theo spec. OCR đã có trên BIZ → G2 nhận output OCR của BIZ. |
| Nguồn tra cứu | Chưa có (chỉ tên HĐ + UNC). Mở rộng sau: tra cứu tên chủ TK, MST/ĐKKD, DS đối tác → sẽ là bằng chứng mạnh hơn LLM cho ca đổi tên, mẹ ↔ con. |
| Dữ liệu đo | Trích lịch sử GNOL (tên bên bán + MST, tên thụ hưởng UNC) — **không có cột kết luận** ⇒ cần **gán nhãn** (tools/eval). |

## 2. Luồng 3 lớp
1. **Engine luật (quyết định)** — như v3 + luật mới `GROUP_TIER_DIFFERENT` (Tổng công ty ↔ công ty không bao giờ tự KHỚP; vá lỗ hổng v3.0).
2. **LLM (tư vấn)** — chỉ hỏi khi `BM.advisor.eligible`: REVIEW (trừ thiếu dữ liệu) + NOT_MATCH "mềm" (`LOW_NAME_SIMILARITY`, `DISTINCTIVE_NAME_DIFFERENT`). **Không** hỏi: MATCH · khác loại hình (luật cứng). Payload = cặp tên + tóm tắt engine (**không** số tiền/STK/MST/KH vay) — server tự tính lại engine, không tin client.
3. **Lớp gác (`BM.advisor.guard`, chạy ở GAS sau khi gọi model + lần 2 ở trình duyệt)** — ép enum, kẹp confidence; AI nói CÙNG khi khác loại hình → UNCERTAIN; mẹ ↔ con → RELATED; khác cấp Tổng cty → UNCERTAIN; RENAMED → confidence ≤ 0.6; output hỏng → FALLBACK/UNCERTAIN.

Output AI: `verdict` (SAME_ENTITY / DIFFERENT_ENTITY / RELATED_ENTITY / UNCERTAIN) · `relation` (IDENTICAL, ABBREVIATION, TRANSLATION, TRANSLITERATION, TRUNCATION, TYPO_OCR, BRANCH, PARENT_SUBSIDIARY, RENAMED, UNRELATED, UNKNOWN) · `confidence` · `evidence[≤4]` · `explanation` · `checks_for_officer[≤3]` · `guard_notes` · `used_for_decision=false`.

## 3. Thành phần
| File | Vai trò |
|---|---|
| `src/engine/bm-engine.js` `BM.advisor.*` | **Nguồn duy nhất:** eligible · payload · key · collect · **SYSTEM_PROMPT · userPrompt · schema · prompt · parse** · guard · `PROMPT_VERSION`. Không phụ thuộc nhà cung cấp. |
| `gas/Code.gs` action `advise_names` | Cổng logic + **adapter AI** (`AI_PROVIDER` = `gemini` → `generateContent` + responseSchema · `openai_compat` → `/chat/completions` + json_schema). Mã truy cập (`ACCESS_CODES`), hạn mức/ngày, ≤ `ADVISOR_MAX_PAIRS`/lần, `fetchAll` song song + gọi lại khi 429/5xx, cờ `AI_ALLOW_REAL_DATA` (tắt → cần `data_attest:"ANONYMIZED"`), gác, log `ai_log` (nhãn mã, provider/model, phân bố, token — không tên). Hàm chạy tay `kiemTraAI`, `taoMaTruyCap`. Cấu hình đầy đủ: `AI_INTEGRATION_CONTRACT.md §3`. |
| `_archive/dify/` | Workflow Dify V2/V3 + generator DSL — **không còn dùng** (lưu tham chiếu). |
| FE (tab Kiểm tra hồ sơ) | Thẻ "🧭 AI tư vấn": URL cổng (cấu hình sẵn qua `src/config/advisor.json`) + mã truy cập (ghi nhớ tùy chọn) + **đọc chế độ cổng (GET): chạy thử → khung cảnh báo + ô tick "tên giả lập / đã ẩn danh" bắt buộc** + nút "Hỏi AI (N cặp)". Ý kiến hiện dưới từng cặp tên; Excel + phiếu in có cột AI. Tab Check nhanh: nút "Hỏi AI cặp tên này". |
| `tools/eval/` | Đo trên máy [TT]: `template` → `prepare` (engine + AI, xuất file gán nhãn) → `score` (báo cáo ẩn danh) · `advisor_smoke` (22 ca giả lập qua cổng thật). Chặn ghi vào repo. |
| `tools/dev/mock_proxy.mjs` + `test/gas_harness.mjs` | Chạy đúng `Code.gs` trong Node với model giả lập (định dạng Gemini hoặc openai_compat; `mock_proxy … real` = AI nội bộ giả lập) — thử FE/eval không cần deploy. |

## 4. (Lịch sử) Lỗi phát hiện ở workflow V2 (giải thích FALLBACK 08/2026)
1. Prompt V2 dùng `{{reason_code}}` thay vì `{{#node.var#}}` ⇒ LLM **không nhận được tên** cần xét.
2. `temperature: 0.7` với GPT-5 (chỉ nhận mặc định) + chưa gắn credential (TD-BM-06) ⇒ lỗi/timeout ~93s.

## 4b. (Lịch sử) Đánh giá chuyển GPT-5 → Gemini 3.8 Flash qua Dify (2026-09-28)
| Hạng mục | Ảnh hưởng |
|---|---|
| Engine/kết luận/GAS/FE/bộ đo | Không (AI chỉ tư vấn; proxy không phụ thuộc model; không cần deploy lại GAS). |
| Workflow Dify | Thấp — đổi provider/model, bỏ `additionalProperties`, bỏ dependency OpenAI. |
| Tham số | Gemini 3.8 bỏ temperature/top_p/top_k → workflow vốn không đặt; thinking medium mặc định (min "minimal" không hỗ trợ). |
| Dữ liệu | Tên KH đi qua Dify tới **Google** → **bắt buộc key trả phí** (gói miễn phí cho phép Google dùng dữ liệu + người duyệt). |
| Chất lượng | Chưa đo trên tên KHDN tiếng Việt — phải qua `advisor_smoke` + đo GNOL theo §5 trước khi mở cho cán bộ. |
| Chi phí | $0.75 / $3.75 mỗi 1M token vào/ra → ước ~$0.005–0.008/cặp (gồm thinking), ~$1–1.5/ngày ở 200 cặp. |
| Tốc độ | Flash nhanh hơn GPT-5; lô 10 cặp song song ≪ giới hạn 6 phút GAS. |

## 5. Chỉ tiêu chấp nhận (đề xuất — [TT] duyệt khi có số đo thật)
- Engine: **khớp nhầm = 0** trên mẫu KHỚP đã gán nhãn.
- AI: **"nói CÙNG nhưng thực tế KHÁC" ≤ 2%** số ca hỏi; độ đúng khi trả lời dứt khoát ≥ 90%; ≥ 50% ca "engine chặn nhưng thực tế cùng" được AI chỉ đúng.
- Độ trễ: ≤ 40 giây / lô 10 cặp.
- Nếu không đạt: siết prompt/ngưỡng hiển thị (vd chỉ hiện SAME khi confidence ≥ 0.9) trước khi mở rộng người dùng.

## 6. Checklist cài đặt (từ 2026-10-08 — không Dify)
**[TT] làm (Gemini gói miễn phí, chế độ thử):**
1. Google AI Studio → **Get API key** (key đang gắn trong Dify trước đây dùng lại được).
2. **GAS → Project Settings → Script Properties:** thêm `AI_API_KEY` = key Gemini. Giữ `AI_ALLOW_REAL_DATA` **không đặt / false**. (Tùy chọn: `AI_MODEL` nếu muốn model khác, `AI_THINKING_LEVEL` = `low` để tiết kiệm hạn mức miễn phí.) Có thể xóa `DIFY_API_URL` / `DIFY_API_KEY` (không còn đọc).
3. (Tùy chọn) Run **`danhSachModel`** → log liệt kê model Flash key được dùng. Model chính `gemini-3.5-flash-lite` (từ GAS @15); quá tải 503 → tự chuyển `AI_MODEL_FALLBACKS` (mặc định `gemini-3.6-flash,gemini-3.8-flash`). Muốn đổi: đặt `AI_MODEL` trong Script Properties (không cần deploy).
4. GAS editor → chọn hàm **`kiemTraAI`** → Run → Execution log phải ra `ai_status:"OK"` cho cặp "SAO VIỆT / VIETSTAR". Không cần deploy lại khi đổi Script Properties.
5. `node tools/eval/advisor_smoke.mjs --ai-url <URL cổng> --ai-code <mã>` (22 ca giả lập, tự gửi xác nhận ẩn danh) → gửi em kết quả.
6. Cấp/thu hồi mã: hàm `taoMaTruyCap` · sửa `ACCESS_CODES`.
7. **Khi IT tích hợp AI nội bộ:** theo `AI_INTEGRATION_CONTRACT.md §3–§7` (đổi 6–8 Script Properties, nghiệm thu, rồi bật `AI_ALLOW_REAL_DATA=true`).

*(Lịch sử)* **GAS — [CC] ĐÃ LÀM 2026-09-28 (clasp):** project `152L4fFoZoj3irSWt4XBHKPJWmembuOj2PR2a3hdkPaZ3DCtpVVxTkd1L` — thay `Code`, thêm `Engine`, cập nhật `OcrService`, xóa `Recon`; cập nhật deployment `AKfycbwWIUJ…MBiTNMw` @8 → **@9** (URL giữ nguyên, rollback = chọn lại version 8). Smoke live: doGet engine 3.1.0 · 9/9 kịch bản · verify_name ≡ local 8/8 · advise_names mã sai → ACCESS_DENIED. Backup bản cũ: scratchpad phiên `gas_bm_backup_20260928` + git `0915d62`. URL cổng đã gắn sẵn trong công cụ (`src/config/advisor.json`).

**[TT] làm (bản Dify cũ — KHÔNG còn áp dụng):**
1. **Dify Cloud:** Plugins → cài/**cập nhật plugin Gemini** (bản có `gemini-3.8-flash`) → Model Provider → Gemini → gắn **API key TRẢ PHÍ** (Google AI Studio project đã bật billing, hoặc Vertex AI) — **không dùng key miễn phí**. Studio → Import DSL → `dify/BeneMatch_Name_Advisor_v3.yml` → kiểm node LLM chọn đúng `gemini-3.8-flash` (thinking để mặc định medium) → Publish → API Access → tạo **API Key** của app. Thử 1 lần: "CÔNG TY TNHH SAO VIỆT" / "VIETSTAR COMPANY LIMITED". *(Dự phòng: import `…_v3_gpt5.yml` nếu cần quay về GPT-5.)*
2. **GAS → Project Settings → Script Properties:** thay giá trị **`DIFY_API_KEY`** = API key app mới (giữ `DIFY_API_URL`, thường `https://api.dify.ai/v1`). *(Đến khi thay, key cũ trỏ workflow V2 → AI trả FALLBACK, kết luận không ảnh hưởng.)*
3. **GAS editor → chọn hàm `taoMaTruyCap` → sửa `NHAN` → Run** (lần đầu cấp quyền) → mã `BM-XXXXXXXXXX` in ở Execution log. Mỗi đơn vị/cán bộ 1 mã. Không cần deploy lại khi đổi Script Properties.
4. **Thử:** `node tools/eval/advisor_smoke.mjs --ai-url <URL cổng> --ai-code <mã>` → gửi em kết quả (22 ca giả lập).
5. **Đo thật:** `tools/eval/README.md`.
6. **Thu hồi mã:** sửa `ACCESS_CODES` trong Script Properties.
