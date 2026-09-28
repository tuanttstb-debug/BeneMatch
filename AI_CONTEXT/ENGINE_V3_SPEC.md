# ENGINE_V3_SPEC — BeneMatch Engine v3 (nguồn sự thật từ 2026-09-28)

> **Thay thế** `DECISION_RULES.md` · `NORMALIZATION_SPEC.md` · `RECONCILIATION_SPEC.md` · `DIFY_*.md` cho phần logic quyết định. Tài liệu cũ giữ để tra lịch sử (Dify V2 = baseline đã port).
> Code: `src/engine/bm-engine.js` (1 file, chạy trình duyệt / GAS / Node). Test: `node test/engine.test.mjs`.

## 1. Bối cảnh vận hành (chốt phỏng vấn [TT] 28/09/2026)
| Chủ đề | Quyết định |
|---|---|
| Môi trường | **Công cụ offline** — 1 file HTML chạy trong trình duyệt cán bộ; dữ liệu KH thật **không rời máy**, không lưu (đóng tab là xóa). Prod: https://tuanttstb-debug.github.io/BeneMatch/ |
| Lõi check tên | **1 engine JS deterministic** dùng chung FE/GAS/Node. **Bỏ Dify/LLM khỏi đường quyết định** (không AI). |
| UNC | Chỉ có **tên + STK + ngân hàng + số tiền + nội dung**, KHÔNG có MST → ghép UNC ↔ bên bán bằng **tên** + **số HĐ trong nội dung**. |
| Chi nhánh ↔ công ty mẹ | **CẦN KIỂM TRA** (không tự khớp). |
| Tên UNC bị cắt cụt | **CẦN KIỂM TRA** + ghi rõ lý do (False Match = 0). |
| Đơn vị xử lý | **1 hồ sơ giải ngân** (1 KH vay, n hóa đơn ↔ m UNC, nhiều nhà cung cấp). |
| Đầu vào HĐ | XML HĐĐT (TT78) · Excel/CSV/dán bảng kê · nhập tay · PDF (lớp chữ) · ảnh/PDF scan (OCR Tesseract trong trình duyệt). |
| Đầu ra | Xuất Excel (5 sheet) · In phiếu / PDF (có ô ký) · Email ĐVKD (copy dán Outlook). |
| Em tự chốt (anh có thể đổi qua `severity`) | UNC không khớp bên bán nào → **KHÔNG KHỚP/Chặn**. Tên chỉ khớp sau khi dịch tiếng Anh → tối đa **CẦN KIỂM TRA**. |

## 2. Chuẩn hóa tên (`normalizeNameEx` / `parseName`)
1. IN HOA, bỏ dấu (NFD, Đ→D); `- CN …` / `CN CONG TY…` → `CHI NHANH`; `&` → `VA`.
2. Dấu câu → khoảng trắng (giữ dấu chấm cho viết tắt) → bảng viết tắt pháp lý: CTY/C.TY → CONG TY · CTCP/CT CP/CONG TY CP/JSC/JOINT STOCK → CONG TY CO PHAN · T.N.H.H/TRACH NHIEM HUU HAN → TNHH · TNHH MTV/1TV → TNHH MOT THANH VIEN · 2TV · DNTN · HTX · HKD · VPDD · DDKD · TCT · CO., LTD/COMPANY LIMITED/LLC/LTD → CONG TY TNHH.
3. Mở rộng viết tắt ngành (không xóa): TM · DV · TMDV · XNK · SX · XD · KD · DTXD … · VN/VIETNAM → VIET NAM.
4. Từ tiếng Anh → Việt (TRADING, SERVICE, CONSTRUCTION, IMPORT EXPORT…) + tên hậu tố "ABC CO., LTD" → đưa loại hình lên đầu ⇒ cờ `translated`.
5. Tách **chi nhánh** (`CHI NHANH …`, `… CHI NHANH …`, `TAI <nơi>`) → `parent` + `branch.label`.
6. **Loại hình** (họ): TNHH (gồm MTV/2TV) · CO_PHAN · DNTN · HTX · HOP_DANH · HKD · UNKNOWN.
7. **Tên lõi** = bỏ cụm pháp lý ở bất kỳ vị trí. **Phần tên riêng (distinctive)** = tên lõi bỏ cụm từ ngành/chung (THUONG MAI, DICH VU, XAY DUNG, VIET NAM…) — chỉ dùng cho luật chặn khớp nhầm, không xóa khỏi tên.

## 3. Độ tương đồng (parity Dify V2)
`seqRatio` = port chuẩn `difflib.SequenceMatcher.ratio()` (test so Python 74/74 khớp tuyệt đối). `name_similarity` = full_seq·0.15 + full_token·0.15 + core_seq·0.25 + core_token·0.30 + core_containment·0.15. Thêm: `distinctive_overlap/sequence`, `numbers_conflict`, `truncated_payment`. **% chỉ là độ giống kỹ thuật — kết luận do luật.**

## 4. Luật khớp tên (thứ tự; trúng luật nào dừng)
| # | Điều kiện | Kết quả | Mã |
|---|---|---|---|
| 1 | Thiếu tên | REVIEW | INSUFFICIENT_DATA |
| (chi nhánh) | Một bên chi nhánh: công ty mẹ khớp → REVIEW; cùng chi nhánh → theo mẹ; khác chi nhánh → REVIEW | REVIEW | BRANCH_VS_PARENT · DIFFERENT_BRANCH |
| 2 | Khác họ loại hình | NOT_MATCH | LEGAL_ENTITY_TYPE_CONFLICT |
| 3 | Trùng sau chuẩn hóa | MATCH | NORMALIZED_NAME_EXACT_MATCH |
| 3a | UNC là tiền tố của tên HĐ (≥ 20 ký tự) | REVIEW | TRUNCATED_BENEFICIARY_NAME |
| 4 | Cùng loại hình + trùng tên lõi (≥2 từ, không ngắn) | MATCH | LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH |
| 5 | Cùng loại hình + cùng bộ từ | MATCH | LEGAL_TYPE_AND_CORE_TOKEN_SET_MATCH |
| 6 | Cùng loại hình, lõi ≥96/90/90%, ≥3 từ, **tên riêng trùng, không lệch số** | MATCH | HIGH_CORE_NAME_SIMILARITY |
| 7 | Tên ngắn, chứa trọn | REVIEW | PARTIAL_CORE_NAME_MATCH |
| 8 | Một bên thiếu loại hình, trùng tên lõi | REVIEW | LEGAL_TYPE_MISSING_CORE_NAME_MATCH |
| 8a | Tên riêng trùng, khác từ ngành | REVIEW | INDUSTRY_WORDS_DIFFERENT |
| 8b | Tên riêng khác hẳn (overlap 0, seq < 0.75) | NOT_MATCH | DISTINCTIVE_NAME_DIFFERENT |
| 9 | name ≥ .82 / core_seq ≥ .82 / core_tok ≥ .75 | REVIEW | NAME_SIMILAR_BUT_NOT_CONCLUSIVE · NUMBER_TOKEN_DIFFERENT |
| 10 | Còn lại | NOT_MATCH | LOW_NAME_SIMILARITY |
| + | MATCH nhưng có quy đổi tiếng Anh | REVIEW | TRANSLATED_NAME_MATCH |

Khác Dify V2: thêm chi nhánh, cắt cụt, 8a/8b (chặn khớp nhầm do trùng từ ngành), guard tên riêng + số ở luật 6, tiếng Anh, HKD/Hợp danh. Bỏ `ai_eligible`/LLM.

## 5. Đối chiếu hồ sơ (`reconcileCase`)
1. Gộp HĐ theo **MST bên bán** (thiếu MST → tên lõi, ghi chú). Cùng MST mà tên khác → cảnh báo.
2. **Đánh dấu HĐ trùng** (MST + ký hiệu + số; thiếu số → MST + tiền + ngày) — **không cộng vào tổng được chi**.
3. **Ghép từng UNC**: chấm tên với mọi bên bán; xếp hạng `MST(nếu có) > MATCH > REVIEW > khác loại hình nhưng lõi ≥ .82 > số HĐ trong nội dung > điểm`. Không bên nào đủ điều kiện → **UNC mồ côi** (BENEFICIARY_NOT_IN_INVOICES, chặn). Hòa điểm 2 bên → AMBIGUOUS. Nội dung nhắc HĐ bên khác → CONTENT_REFERS_OTHER_SUPPLIER.
4. Mỗi bên bán: **mọi UNC đều check tên** (không chỉ UNC đầu) · STK khác STK in trên HĐ (ghi chú) · Σ UNC vs Σ HĐ (thừa chi > dung sai = cảnh báo; chi ít hơn = ghi chú) · MST checksum · MST người mua ≠ KH vay · ngày HĐ sau ngày giải ngân · dòng OCR chưa tick "đã đối chiếu".
5. Toàn hồ sơ: UNC trùng (cùng STK/tên + tiền + nội dung) · Σ UNC ≠ số tiền giải ngân · dữ liệu thiếu.
6. Kết luận = mức nặng nhất (sev 0 ghi chú · 1 CẦN KIỂM TRA · 2 KHÔNG KHỚP). Dung sai = max(1.000 đ, 0,1%).

Mã cảnh báo & mức: `WARN_META` trong engine (bảng hiển thị ở tab "Quy tắc" của công cụ). Đổi mức qua `thresholds.json → severity`.

## 6. IO
- `io.parseDelimited` (TSV dán Excel / CSV / `;`) → `io.rowsToRecords(rows, 'invoice'|'transfer')`: tự tìm dòng tiêu đề (≤10 dòng đầu), nhận alias tiếng Việt không dấu, bỏ dòng "Tổng cộng"; không có tiêu đề → thứ tự cột mặc định.
- `io.parseInvoiceText` — trích từ text PDF/OCR theo nhãn HĐĐT song ngữ, tách phần người bán/người mua, bỏ nhãn lọt do OCR sai dấu.
- FE: XML TT78 (`NBan/NMua/TTChung/TToan`) + dự phòng tag định dạng cũ; SheetJS / pdf.js / Tesseract.js **tải lười từ jsDelivr khi cần** (file không gửi đi).

## 7. Kiểm thử (`test/engine.test.mjs` — 81 ca)
Golden tên 37 cặp (17 MATCH · 13 REVIEW · 7 NOT_MATCH, **False Match = 0**) · parity Python difflib · 9 kịch bản hồ sơ (decision + bộ mã cảnh báo) · UNC thứ 2 sai pháp nhân · nội dung nhắc HĐ bên khác · MST checksum · số tiền/ngày/serial Excel · dán bảng · trích text PDF · OCR sai dấu.
Fixtures synthetic: `test/fixtures/hddt_synth_tt78.xml`, `hddt_synth.pdf` (+ `.html` nguồn), `test/live/invoice_synth_01.png`.
