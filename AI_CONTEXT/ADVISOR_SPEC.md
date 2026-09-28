# ADVISOR_SPEC — AI tư vấn nhận diện tên (LLM Gemini 3.8 Flash qua Dify, chỉ tham khảo)

> Bổ sung cho `ENGINE_V3_SPEC.md`. Chốt phỏng vấn [TT] 2026-09-28 (vòng 3–5). Engine 3.1.0.

## 1. Quyết định ([TT] chốt)
| Chủ đề | Quyết định |
|---|---|
| Vì sao cần LLM | Tên KHDN phức tạp; luật không hiểu **nghĩa**: tên tiếng Anh/giao dịch, viết tắt thương hiệu, tổng cty ↔ cty con/CN, đổi tên / tên dài / lỗi OCR (cả 4 nhóm [TT] chọn). |
| Nền tảng | **Dify Cloud hiện tại** được phép dùng với dữ liệu thật · model **Gemini 3.8 Flash** (`gemini-3.8-flash`, GA 02/09/2026 — [TT] chốt 28/09 chiều, thay GPT-5) · **bắt buộc key Gemini TRẢ PHÍ** (gói miễn phí: Google được dùng dữ liệu để cải tiến + người duyệt đọc) · thinking **medium** (mặc định). GPT-5 giữ làm dự phòng. |
| Quyền của LLM | **Chỉ đề xuất + giải thích.** Kết luận engine giữ nguyên (`used_for_decision=false`). |
| Đường gọi (giai đoạn 1) | Công cụ cán bộ → **GAS proxy** (giữ key Dify) → Dify. Xác thực bằng **mã truy cập cấp riêng** (thu hồi được, hạn mức/ngày). |
| Lộ trình | G1: công cụ cán bộ + đo chất lượng trên lịch sử GNOL · G2: service trong luồng GNOL (BIZ → BPM) do IT xây theo spec. OCR đã có trên BIZ → G2 nhận output OCR của BIZ. |
| Nguồn tra cứu | Chưa có (chỉ tên HĐ + UNC). Mở rộng sau: tra cứu tên chủ TK, MST/ĐKKD, DS đối tác → sẽ là bằng chứng mạnh hơn LLM cho ca đổi tên, mẹ ↔ con. |
| Dữ liệu đo | Trích lịch sử GNOL (tên bên bán + MST, tên thụ hưởng UNC) — **không có cột kết luận** ⇒ cần **gán nhãn** (tools/eval). |

## 2. Luồng 3 lớp
1. **Engine luật (quyết định)** — như v3 + luật mới `GROUP_TIER_DIFFERENT` (Tổng công ty ↔ công ty không bao giờ tự KHỚP; vá lỗ hổng v3.0).
2. **LLM (tư vấn)** — chỉ hỏi khi `BM.advisor.eligible`: REVIEW (trừ thiếu dữ liệu) + NOT_MATCH "mềm" (`LOW_NAME_SIMILARITY`, `DISTINCTIVE_NAME_DIFFERENT`). **Không** hỏi: MATCH · khác loại hình (luật cứng). Payload = cặp tên + tóm tắt engine (**không** số tiền/STK/MST/KH vay) — server tự tính lại engine, không tin client.
3. **Lớp gác (2 nơi: node Dify "Validate & Guard" + `BM.advisor.guard`)** — ép enum, kẹp confidence; AI nói CÙNG khi khác loại hình → UNCERTAIN; mẹ ↔ con → RELATED; khác cấp Tổng cty → UNCERTAIN; RENAMED → confidence ≤ 0.6; output hỏng → FALLBACK/UNCERTAIN.

Output AI: `verdict` (SAME_ENTITY / DIFFERENT_ENTITY / RELATED_ENTITY / UNCERTAIN) · `relation` (IDENTICAL, ABBREVIATION, TRANSLATION, TRANSLITERATION, TRUNCATION, TYPO_OCR, BRANCH, PARENT_SUBSIDIARY, RENAMED, UNRELATED, UNKNOWN) · `confidence` · `evidence[≤4]` · `explanation` · `checks_for_officer[≤3]` · `guard_notes` · `used_for_decision=false`.

## 3. Thành phần
| File | Vai trò |
|---|---|
| `dify/build_advisor_dsl.py` → `dify/BeneMatch_Name_Advisor_v3.yml` (**Gemini 3.8 Flash — bản chính**) + `…_v3_gpt5.yml` (dự phòng) | Workflow Dify: START → LLM (structured output) → Validate & Guard (Python) → Output. Prompt/schema/gác **giống nhau** giữa 2 bản. Không đặt temperature (Gemini 3.8 bỏ hẳn temperature/top_p/top_k; GPT-5 chỉ nhận mặc định). Bản Gemini bỏ `additionalProperties` khỏi schema + không kèm dependency plugin. Biến prompt đúng cú pháp `{{#node.var#}}`. |
| `gas/Code.gs` action `advise_names` | Proxy: mã truy cập (`ACCESS_CODES`), hạn mức/ngày (`ADVISOR_DAILY_LIMIT`), ≤ `ADVISOR_MAX_PAIRS`/lần, `UrlFetchApp.fetchAll` song song, gác, log `advisor_log` (nhãn mã + số lượng + phân bố — không tên). |
| `src/engine/bm-engine.js` `BM.advisor.*` | eligible · payload · key · collect · guard. |
| FE (tab Kiểm tra hồ sơ) | Thẻ "🧭 AI tư vấn": URL cổng (cấu hình sẵn qua `src/config/advisor.json`) + mã truy cập (ghi nhớ tùy chọn) + nút "Hỏi AI (N cặp)". Ý kiến hiện dưới từng cặp tên; Excel + phiếu in có cột AI. Tab Check nhanh: nút "Hỏi AI cặp tên này". |
| `tools/eval/` | Đo trên máy [TT]: `template` → `prepare` (engine + AI, xuất file gán nhãn) → `score` (báo cáo ẩn danh) · `advisor_smoke` (22 ca giả lập qua cổng thật). Chặn ghi vào repo. |
| `tools/dev/mock_proxy.mjs` + `test/gas_harness.mjs` | Chạy đúng `Code.gs` trong Node với Dify giả lập — thử FE/eval không cần deploy. |

## 4. Lỗi phát hiện ở workflow V2 (giải thích FALLBACK 08/2026)
1. Prompt V2 dùng `{{reason_code}}` thay vì `{{#node.var#}}` ⇒ LLM **không nhận được tên** cần xét.
2. `temperature: 0.7` với GPT-5 (chỉ nhận mặc định) + chưa gắn credential (TD-BM-06) ⇒ lỗi/timeout ~93s.

## 4b. Đánh giá chuyển GPT-5 → Gemini 3.8 Flash (2026-09-28, [TT] duyệt)
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

## 6. Checklist cài đặt
**GAS — [CC] ĐÃ LÀM 2026-09-28 (clasp):** project `152L4fFoZoj3irSWt4XBHKPJWmembuOj2PR2a3hdkPaZ3DCtpVVxTkd1L` — thay `Code`, thêm `Engine`, cập nhật `OcrService`, xóa `Recon`; cập nhật deployment `AKfycbwWIUJ…MBiTNMw` @8 → **@9** (URL giữ nguyên, rollback = chọn lại version 8). Smoke live: doGet engine 3.1.0 · 9/9 kịch bản · verify_name ≡ local 8/8 · advise_names mã sai → ACCESS_DENIED. Backup bản cũ: scratchpad phiên `gas_bm_backup_20260928` + git `0915d62`. URL cổng đã gắn sẵn trong công cụ (`src/config/advisor.json`).

**[TT] làm:**
1. **Dify Cloud:** Plugins → cài/**cập nhật plugin Gemini** (bản có `gemini-3.8-flash`) → Model Provider → Gemini → gắn **API key TRẢ PHÍ** (Google AI Studio project đã bật billing, hoặc Vertex AI) — **không dùng key miễn phí**. Studio → Import DSL → `dify/BeneMatch_Name_Advisor_v3.yml` → kiểm node LLM chọn đúng `gemini-3.8-flash` (thinking để mặc định medium) → Publish → API Access → tạo **API Key** của app. Thử 1 lần: "CÔNG TY TNHH SAO VIỆT" / "VIETSTAR COMPANY LIMITED". *(Dự phòng: import `…_v3_gpt5.yml` nếu cần quay về GPT-5.)*
2. **GAS → Project Settings → Script Properties:** thay giá trị **`DIFY_API_KEY`** = API key app mới (giữ `DIFY_API_URL`, thường `https://api.dify.ai/v1`). *(Đến khi thay, key cũ trỏ workflow V2 → AI trả FALLBACK, kết luận không ảnh hưởng.)*
3. **GAS editor → chọn hàm `taoMaTruyCap` → sửa `NHAN` → Run** (lần đầu cấp quyền) → mã `BM-XXXXXXXXXX` in ở Execution log. Mỗi đơn vị/cán bộ 1 mã. Không cần deploy lại khi đổi Script Properties.
4. **Thử:** `node tools/eval/advisor_smoke.mjs --ai-url <URL cổng> --ai-code <mã>` → gửi em kết quả (22 ca giả lập).
5. **Đo thật:** `tools/eval/README.md`.
6. **Thu hồi mã:** sửa `ACCESS_CODES` trong Script Properties.
