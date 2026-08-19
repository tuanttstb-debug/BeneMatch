# INTEGRATION_MAP — BeneMatch trong luồng tín dụng TPBank

**Mục đích:** phục vụ tuyến demo "bản đồ tích hợp — nhận diện rủi ro sớm khi tích hợp rộng hơn". Tham chiếu hạ tầng: `SYS-TPBANK` (không phải nguyên tắc nghiệp vụ riêng). Nhãn: **[FACT]** tài liệu · **[INFERRED]** suy luận · **[OPEN]** cần xác nhận.

## Vị trí: chốt kiểm trong luồng giải ngân theo hóa đơn (SHTD)
```
[OCR hóa đơn] + [Đề nghị chuyển tiền]        ← upstream (SHTD / eKYC-OCR)
        │  invoice_name / payment_name / account
        ▼
   ┌─────────────────────────────┐
   │  BeneMatch (verify tên BTH)  │  ← điểm chèn: TRƯỚC khi tạo lệnh/hạch toán
   │  MATCH → ALLOW               │
   │  REVIEW → WARN (cán bộ KT)   │
   │  NOT_MATCH → BLOCK           │
   └─────────────────────────────┘
        │  ALLOW
        ▼
[BPM] phê duyệt (nếu WARN) → [ESignHub/HSM] ký → [FCC] giải ngân/hạch toán → [ECM] lưu trữ
```

## Điểm chạm & giao thức (nếu tích hợp thật)
| Hệ thống | Vai trò với BeneMatch | Hướng | Giao thức [INFERRED] | Rủi ro đổi |
|---|---|---|---|---|
| **OCR/eKYC** | Cấp `invoice_name`, `payment_name`, account | upstream → | REST | 🟢 (chất lượng OCR ảnh hưởng đầu vào) |
| **Domain SHTD** | Gọi verify trong luồng giải ngân | ↔ | REST qua **Kong** | 🟡 |
| **BPM** | Nhận REVIEW/WARN → phê duyệt maker/checker (role `QTTD_*` reuse) | → | REST/Event | 🟡 |
| **FCC** | Chỉ giải ngân sau ALLOW (hoặc WARN đã duyệt) | downstream → | REST qua Kong | 🔴 Cao |
| **ESignHub/HSM** | Ký chứng từ sau khi qua verify | downstream → | REST | 🟡 |
| **ECM (CMIS)** | Lưu log verify như bằng chứng kiểm soát | → | CMIS | 🟢 |
| **Kafka** | Nếu verify async (batch/callback) | ↔ | Kafka | 🟡 |
| **AML/Screening** | Bổ trợ (khác mục tiêu: sàng lọc KH, không so tên hóa đơn) | song song | REST | 🟡 |

## Rủi ro tích hợp cần nhận diện sớm (register)
| # | Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| R1 | **BeneMatch là chốt chặn trước FCC** → nếu treo/timeout sẽ **chặn giải ngân** | 🔴 | Timeout ngắn + fallback REVIEW (không auto-BLOCK khi lỗi hệ thống); circuit breaker ở Kong |
| R2 | **Phụ thuộc LLM** cho nhánh REVIEW (as-built gọi LLM cả case đáng lẽ 0 token — TD-BM-01) | 🟡 | Vá Warning Route; LLM chỉ diễn giải, có fallback deterministic; **không** để LLM vào critical path quyết định |
| R3 | **Chất lượng OCR đầu vào** kém → tên rác → REVIEW/NOT_MATCH sai | 🟡 | Đánh dấu `POSSIBLE_OCR_ERROR`; không auto-sửa OCR khi chưa có whitelist |
| R4 | **False Match (ALLOW nhầm)** cho phép giải ngân sai người | 🔴 | Ưu tiên False Match thấp; hard rule pháp nhân; tuning bằng Golden Dataset |
| R5 | **Ranh giới trách nhiệm**: verify **không** xác minh chủ tài khoản/MST | 🟡 | Ghi rõ disclaimer (`difference_metric_note`); account chỉ supporting signal |
| R6 | **Data boundary**: log tên/tài khoản KH | 🟡 | Demo synthetic; bản thật lưu ECM/Sheet nội bộ, không cloud công khai |
| R7 | **Versioning hợp đồng** khi nhiều hệ gọi chung | 🟢 | `workflow_version`/`*_version` trong response; đổi phải bump |

## [OPEN] cần xác nhận khi vào tích hợp thật
- Auth API nội bộ (OAuth2/API key/mTLS) qua Kong.
- Đồng bộ hay async (Kafka) trong luồng SHTD.
- SLA/timeout cho chốt verify trước FCC; hành vi khi verify lỗi (fail-open REVIEW vs fail-closed BLOCK).
- Ai sở hữu ngưỡng threshold (rủi ro/nghiệp vụ) & quy trình đổi.
