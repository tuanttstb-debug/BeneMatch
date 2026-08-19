# GOLDEN_DATASET — BeneMatch (regression & chất lượng nhận diện)

**Mục đích:** phục vụ tuyến demo "chất lượng nhận diện" + tuning threshold. **Chỉ dữ liệu synthetic.** Metric ưu tiên: **False Match thấp** (ALLOW nhầm là nghiêm trọng nhất).

## 7 case regression bắt buộc (từ handover)
| # | Case | Invoice / Payment (ví dụ synthetic) | Kỳ vọng |
|---|---|---|---|
| 1 | Không dấu | `CÔNG TY CỔ PHẦN ASIA GREEN` / `CONG TY CO PHAN ASIA GREEN` | MATCH · `NORMALIZED_NAME_EXACT_MATCH` · 0 token |
| 2 | Viết tắt | `CÔNG TY TNHH ABC VIỆT NAM` / `CTY TNHH ABC VIET NAM` | MATCH · exact normalized · 0 token |
| 3 | Đảo thứ tự | `CÔNG TY TNHH THƯƠNG MẠI MINH LONG` / `CTY TNHH MINH LONG THUONG MAI` | MATCH · `..._CORE_TOKEN_SET_MATCH` · 0 token |
| 4 | Khác legal type | `CÔNG TY TNHH MINH LONG` / `CÔNG TY CỔ PHẦN MINH LONG` | NOT_MATCH · `LEGAL_ENTITY_TYPE_CONFLICT` (hard rule) · 0 token |
| 5 | Tên ngắn | `CÔNG TY TNHH ABC VIỆT NAM` / `ABC` | REVIEW · deterministic warning · 0 token |
| 6 | Mơ hồ | `CÔNG TY TNHH MINH LONG VIỆT NAM` / `CTY TNHH MINH LONG TECHNOLOGY` | REVIEW · `NAME_SIMILAR_BUT_NOT_CONCLUSIVE` · **ai_eligible=true** (LLM) |
| 7 | Thiếu tên | tên invoice có / payment rỗng | REVIEW · `INSUFFICIENT_DATA` · 0 token |

## Case mở rộng nên thêm (phủ luật & biên)
- `&` → VA: `CÔNG TY TNHH AN & BÌNH` / `CONG TY TNHH AN VA BINH` → MATCH.
- TNHH MTV vs TNHH (cùng family, không conflict): `CÔNG TY TNHH MTV X` / `CÔNG TY TNHH MỘT THÀNH VIÊN X` → MATCH.
- English form: `ABC VIETNAM JOINT STOCK COMPANY` / `CÔNG TY CỔ PHẦN ABC VIỆT NAM` → MATCH (JSC→CO PHAN).
- Khác hẳn: `CÔNG TY TNHH ABC` / `CÔNG TY TNHH XYZ` → NOT_MATCH · `LOW_NAME_SIMILARITY`.
- Same account nhưng tên khác pháp nhân → vẫn NOT_MATCH (account **không** cứu).
- Biên threshold luật 9: cặp có `core_token` quanh 0.75 để soi ranh REVIEW/NOT_MATCH.

## Cấu trúc dataset (đề xuất) — `dataset/golden.jsonl`
```jsonc
{ "id": "BM-001", "group": "khong-dau",
  "input": { "request_id":"BM-001", "invoice_beneficiary_name":"…", "payment_beneficiary_name":"…",
             "invoice_account_number":"", "payment_account_number":"" },
  "expected": { "decision":"MATCH", "reason_code":"NORMALIZED_NAME_EXACT_MATCH", "ai_eligible":false } }
```

## Metric đo (harness)
- **Confusion theo decision** (MATCH/REVIEW/NOT_MATCH) vs expected.
- **False Match rate** = (ALLOW nhầm khi thực khác pháp nhân) / tổng — **mục tiêu ≈ 0**.
- **LLM invocation rate** = tỉ lệ case gọi LLM — kỳ vọng **chỉ** case ai_eligible=true (soi TD-BM-01: hiện sẽ cao bất thường vì mọi REVIEW gọi LLM).
- **0-token coverage** = tỉ lệ case ra kết quả không cần LLM.

## Harness (đề xuất)
- Chạy offline từng `input` qua bản Python trích từ workflow (mỗi node là 1 hàm `main()`), hoặc gọi Dify API batch. In bảng pass/fail + metric. Không cần dữ liệu thật.

## [CHỜ NỘI DUNG]
- Bộ synthetic đầy đủ (đề xuất ≥ 30 case phủ toàn bộ 10 luật) — sẽ dựng ở TODO Cao #2.
- Threshold cuối sau tuning (hiện 0.96/0.90/0.82 là prototype).
