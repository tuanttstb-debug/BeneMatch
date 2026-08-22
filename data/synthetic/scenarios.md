# Synthetic scenarios — Batch Reconciliation

Dataset **synthetic** (publish-safe, không dữ liệu KH thật). Mỗi nhóm minh họa 1 tín hiệu.

| Nhóm (MST) | Người thụ hưởng | Σ HĐ | Σ CT | Tín hiệu minh họa | decision kỳ vọng |
|---|---|---:|---:|---|---|
| 0101234567 | ABC Việt Nam | 150.000.000 | 150.000.000 | Khớp hoàn hảo (tên biến thể CTY/VIET) | **MATCH** |
| 0102000002 | Bình Minh (CP) | 80.000.000 | 90.000.000 | **Thừa chi** +10tr > dung sai | **REVIEW** (HIGH) |
| 0103000003 | Hoàng Gia | 40.000.000 | 35.000.000 | **Thiếu chi** −5tr | **REVIEW** (MEDIUM) |
| 0104000004 | Thành Đạt (DNTN) | 60.000.000 | 0 | **Thiếu lệnh CT** cho nhóm có HĐ | **REVIEW** |
| 0105000005 | Phú Thịnh | 0 | 25.000.000 | **Thiếu HĐ** cho lệnh CT | **REVIEW** |
| 0106000006 | Tiến Phát | 40.000.000 | 40.000.000 | **Hóa đơn trùng** (INV-0007 ×2); tổng vẫn khớp | **REVIEW** (HIGH) |
| 0107000007 | Delta Mekong | 45.000.000 | 45.000.000 | **Khác pháp nhân**: HĐ *TNHH* vs CT *CỔ PHẦN* (tiền khớp) | **NOT_MATCH** (BLOCK) |
| 0108000008 | Sao Việt (CP) | 33.333.333 | 33.333.000 | Lệch 333đ **trong dung sai** (làm tròn) | **MATCH** |
| 0109000009 | Minh Anh | 12.000.000 | 12.000.000 | **Nghi lỗi OCR** (confidence 0.60); tiền+tên khớp | **REVIEW** (MEDIUM) |

**Grand total:** Σ HĐ = 460.333.333 · Σ CT = 430.333.000 · **grand_diff = −30.000.333** (net thiếu chi, chủ yếu do nhóm Thành Đạt thiếu lệnh CT).

**Batch decision kỳ vọng = NOT_MATCH** (bị kéo bởi nhóm Delta Mekong khác pháp nhân).

> Điểm "kể" cho stakeholder: nhóm **Delta Mekong** và **Tiến Phát** cho thấy *tiền khớp nhưng vẫn rủi ro* (sai pháp nhân / hóa đơn trùng) — giá trị của đối chiếu đa chiều thay vì chỉ so tổng tiền.
