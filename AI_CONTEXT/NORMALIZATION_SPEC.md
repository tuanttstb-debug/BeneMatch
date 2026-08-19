# NORMALIZATION_SPEC — BeneMatch

Chuẩn hóa & feature extraction cho matching. 3 node: **Normalize Names**, **Extract Legal Type**, **Calculate Similarity**. Nguyên tắc: xử lý tối đa "khác cách viết" nhưng **không** làm mất tính phân biệt pháp nhân (không xóa từ ngành nghề/địa danh).

## 1) Normalize Names (`1786418729517`)
Trình tự trong `normalize_name()`:
1. `upper().strip()` → bỏ dấu tiếng Việt (`NFD` + loại `Mn`; xử lý riêng `Đ/đ → D/d`).
2. Thay punctuation `,;:/\-_()[]{}"'`` `→ khoảng trắng (**giữ dấu chấm** để xử lý viết tắt trước).
3. Áp bảng **REPLACEMENTS** (viết tắt pháp lý & ký hiệu):
   - `C.T.C.P / CTCP / CÔNG TY CP / JSC / JOINT STOCK CO(MPANY)` → `CONG TY CO PHAN`
   - `C.TY / CTY` → `CONG TY`
   - `CONG TY TRACH NHIEM HUU HAN (MOT THANH VIEN)` / `T.N.H.H` → `CONG TY TNHH (MOT THANH VIEN)` / `TNHH`
   - `TNHH MTV / TNHH 1 TV` → `TNHH MOT THANH VIEN`
   - `COMPANY LIMITED / LIMITED LIABILITY COMPANY / CO LTD / LTD` → `CONG TY TNHH`
   - `DNTN` → `DOANH NGHIEP TU NHAN`; `HTX` → `HOP TAC XA`; `&` → ` VA `
4. Xóa dấu chấm còn lại → gom khoảng trắng.

**core name** = `extract_core_name()`: chỉ **loại tiền tố pháp lý ở đầu** (LEGAL_PREFIXES: CONG TY TNHH MOT THANH VIEN → CONG TY CO PHAN → CONG TY TNHH → DOANH NGHIEP TU NHAN → HOP TAC XA → CONG TY). **Không** xóa từ ngành nghề.

**Outputs:** `invoice/payment_normalized` (String), `..._core_name` (String), `..._core_tokens` (Array[String]), `..._name_token_count` (Number).

## 2) Extract Legal Type (`1786420138295`)
`LEGAL_PATTERNS` (thứ tự): `TNHH_MOT_THANH_VIEN`→family `TNHH`; `CO_PHAN`→`CO_PHAN`; `TNHH`→`TNHH`; `DOANH_NGHIEP_TU_NHAN`; `HOP_TAC_XA`. Không khớp → `UNKNOWN`.
- `legal_type_match` = cả hai known & cùng **family**.
- `legal_type_conflict` = cả hai known & khác **family** → **hard rule NOT_MATCH** (luật 2).
- Lưu ý: `TNHH MTV` và `TNHH` cùng **family `TNHH`** ⇒ không coi là conflict (khác `legal_type` nhưng cùng họ).

**Outputs:** `..._legal_type`, `..._legal_family` (String); `legal_type_match`, `legal_type_conflict` (**Boolean**).

## 3) Calculate Similarity (`1786420298962`)
Tính trên cả **full normalized** và **core**:
- `sequence_score` = `difflib.SequenceMatcher.ratio()`.
- `jaccard_score` = |∩| / |∪| (token set).
- `containment_score` = |∩| / min(|A|,|B|).
- **weighted `name_similarity`** = full_seq·0.15 + full_token·0.15 + core_seq·0.25 + core_token·0.30 + core_containment·0.15.

**Flags:** `full_name_exact_match`, `core_name_exact_match`, `same_core_token_set` (khác thứ tự), `core_word_order_only`, `short_name_detected` (min token ≤1 **hoặc** min core length ≤4).

**Outputs (Number):** `sequence_similarity, token_similarity, core_sequence_similarity, core_token_similarity, core_containment_score, name_similarity`. **(Boolean):** các flag trên.

## Cấm (giai đoạn này)
- Sửa OCR (V1ET→VIET, N4M→NAM, 0→O, 1→I) khi chưa có whitelist ngữ cảnh + dữ liệu thật.
- Xóa hàng loạt từ ngành nghề/địa danh (mất tính phân biệt pháp nhân → tăng False Match).
