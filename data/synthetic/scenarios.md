# Kịch bản mẫu (synthetic) — BeneMatch engine v3

Nguồn: `scenarios.json` (nạp vào công cụ qua ô "Nạp kịch bản mẫu"; kiểm ở `test/engine.test.mjs`). Toàn bộ tên/MST/STK là **giả lập** (MST đúng checksum). UNC **không có MST** — đúng thực tế.

| # | Kịch bản | Kết luận | Nội dung |
|---|---|---|---|
| 1 | Khớp sạch — 2 hóa đơn, 1 UNC | KHỚP | KH vay thanh toán 2 hóa đơn của cùng nhà cung cấp bằng 1 UNC. Tên UNC viết tắt, không dấu (CTY … VN) nhưng cùng pháp nhân; tổng tiền khớp; nội dung UNC nhắc đúng số hóa đơn. Hệ thống cho qua. |
| 2 | Sai pháp nhân (CP ↔ TNHH) | KHÔNG KHỚP | Hóa đơn do CÔNG TY CỔ PHẦN DELTA MEKONG xuất, nhưng UNC chuyển cho CÔNG TY TNHH DELTA MEKONG — phần tên giống hệt nhưng khác loại hình ⇒ hai pháp nhân khác nhau. Rủi ro nặng nhất: chuyển tiền cho sai thực thể. Hệ thống CHẶN. |
| 3 | Chi cho người không có hóa đơn | KHÔNG KHỚP | Hóa đơn của CÔNG TY TNHH THƯƠNG MẠI HOÀNG GIA nhưng UNC lại chuyển cho CÔNG TY TNHH THƯƠNG MẠI MINH ANH — chỉ trùng từ ngành nghề 'Thương mại', phần tên riêng khác hẳn. Tiền đi tới một bên không có hóa đơn trong hồ sơ. Hệ thống CHẶN. |
| 4 | Thừa chi so với hóa đơn | CẦN KIỂM TRA | Tên khớp nhưng UNC chuyển 90.000.000 đ trong khi hóa đơn chỉ 80.000.000 đ — thừa 10 triệu, vượt dung sai. Hệ thống đưa vào diện kiểm tra. |
| 5 | Tên UNC bị cắt cụt | CẦN KIỂM TRA | Tên bên bán dài; hệ thống chuyển tiền cắt tên người thụ hưởng theo giới hạn ký tự. Phần còn lại khớp, nhưng không kiểm được phần bị cắt ⇒ cần cán bộ đối chiếu STK/tên đăng ký. |
| 6 | Hóa đơn chi nhánh, chuyển công ty mẹ | CẦN KIỂM TRA | Hóa đơn do CHI NHÁNH HÀ NỘI xuất (MST 13 số) nhưng UNC chuyển cho công ty mẹ. Cùng pháp nhân nhưng khác đơn vị nhận tiền ⇒ cần kiểm tra. |
| 7 | Hóa đơn trùng (trả 2 lần) | CẦN KIỂM TRA | Cùng một hóa đơn (cùng MST, ký hiệu, số) được đưa vào hồ sơ 2 lần (1 bản XML, 1 dòng bảng kê), UNC chi cho cả 2 ⇒ nguy cơ trả hai lần. Hệ thống loại bản trùng khỏi tổng được chi ⇒ lộ ra thừa chi 20 triệu. |
| 8 | Hóa đơn xuất cho người mua khác | CẦN KIỂM TRA | Tên người thụ hưởng khớp, tiền khớp — nhưng hóa đơn xuất cho một doanh nghiệp khác (MST người mua ≠ MST khách hàng vay). Hóa đơn không chứng minh được mục đích vốn của KH ⇒ cần kiểm tra. |
| 9 | Hồ sơ tổng hợp — 4 nhà cung cấp | KHÔNG KHỚP | Một khoản giải ngân trả cho 4 nhà cung cấp: 1 khớp sạch (2 đợt UNC), 1 thừa chi, 1 tên tiếng Anh trên UNC, 1 UNC chuyển cho bên không có hóa đơn. Hệ thống tự ghép từng UNC với đúng bên bán theo tên + số hóa đơn trong nội dung, rồi xếp rủi ro cao lên đầu. |
