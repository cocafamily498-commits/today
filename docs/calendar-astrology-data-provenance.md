# Nguồn gốc dữ liệu và quy tắc lịch – phong tục

## 1. Mục đích và phạm vi

Tài liệu này giải thích cách Sổ tay Lịch Việt tạo ra các nội dung:

- ngày âm lịch và Can Chi;
- 12 Trực, việc hạp và việc kỵ;
- tuổi âm;
- Cung phi, nhóm Đông/Tây tứ mệnh và hướng;
- Mạng (nạp âm), màu hợp và màu xung;
- sao Cửu Diệu và hạn theo năm.

Mục tiêu là giúp người đọc mã nguồn biết phần nào là phép tính thiên văn/lịch pháp, phần nào là bảng tra theo tập quán dân gian, và phần nào vẫn cần kiểm chứng hoặc bổ sung nguồn trước khi coi là dữ liệu chuẩn.

> **Giới hạn sử dụng:** Các nội dung Cung, Mạng, hướng, màu, sao, hạn, 12 Trực và hạp/kỵ thuộc hệ thống tín ngưỡng hoặc kinh nghiệm dân gian. Ứng dụng chỉ cung cấp để tham khảo, không xem đây là kết luận khoa học và không nên dùng làm căn cứ duy nhất cho quyết định sức khỏe, pháp lý, tài chính hoặc an toàn.

## 2. Phân loại mức độ nguồn

Tài liệu dùng ba mức sau:

1. **Nguồn thuật toán:** mã hiện tại có thể đối chiếu trực tiếp với một thuật toán/tài liệu công khai.
2. **Nguồn hệ thống:** tên gọi và nguyên tắc chung có tài liệu tham khảo, nhưng bảng hoặc câu diễn giải trong app là bản biên soạn/hard-code của dự án, không phải bản chép nguyên văn có thể truy nguyên từng dòng.
3. **Chưa xác lập nguồn gốc:** dự án chưa lưu nguồn ban đầu đủ để chứng minh bảng hiện tại được lấy chính xác từ đâu. Khi đó tài liệu chỉ mô tả hành vi của code.

Không được hiểu danh sách “tài liệu đối chiếu” bên dưới là tuyên bố rằng dự án sở hữu bản quyền nội dung của tài liệu, hoặc rằng mọi bảng trong app được sao chép từ tài liệu đó.

## 3. Bảng truy xuất nhanh

| Nội dung | Cách app tạo kết quả | Vị trí code | Mức độ nguồn |
|---|---|---|---|
| Âm/dương lịch | Julian day, thời điểm Sóc, kinh độ Mặt Trời, tháng 11 âm và tháng nhuận; múi giờ mặc định UTC+7 | `scripts/lunar-core.js` | Nguồn thuật toán |
| Can Chi | Công thức modulo 10 Can và modulo 12 Chi từ năm/tháng/Julian day | `scripts/lunar-details.js` | Nguồn thuật toán/hệ thống |
| 12 Trực | Tính Chi ngày và Chi tháng theo kinh độ Mặt Trời, rồi lấy hiệu modulo 12 để tra chuỗi 12 Trực | `scripts/lunar-details.js:getDayOfficer` | Nguồn hệ thống |
| Hạp/kỵ theo Trực | Bảng câu chữ cố định cho từng Trực | `scripts/lunar-details.js:getDayOfficerGuidance` | Chưa xác lập nguồn gốc từng câu |
| Tuổi âm | `năm cần tra - năm sinh âm lịch + 1` | `scripts/astrology-tool.js` | Quy ước tuổi mụ trong app |
| Cung phi | Rút gọn chữ số năm, áp công thức riêng nam/nữ; số 5 đổi thành Khôn đối với nam và Cấn đối với nữ | `scripts/astrology-tool.js:getAstrologyPalace` | Nguồn hệ thống; có sai khác cần lưu ý |
| Hướng hợp/xung | Bảng cố định theo tám cung Khảm, Khôn, Chấn, Tốn, Càn, Đoài, Cấn, Ly | `scripts/astrology-tool.js:ASTROLOGY_PALACES` | Chưa xác lập nguồn gốc từng bảng hướng |
| Mạng/nạp âm | Năm được đặt vào chu kỳ Can Chi 60 năm, cứ hai năm dùng một trong 30 nạp âm | `scripts/astrology-tool.js:getAstrologyNapAm` | Nguồn hệ thống; diễn giải do dự án biên soạn |
| Màu hợp/xung | Tra bảng màu theo hành Kim, Mộc, Thủy, Hỏa hoặc Thổ của nạp âm | `scripts/astrology-tool.js:ASTROLOGY_COLORS` | Chưa xác lập nguồn gốc bảng màu cụ thể |
| Sao Cửu Diệu | Lấy tuổi âm modulo 9 và tra hai bảng riêng cho nam/nữ | `scripts/astrology-tool.js:getAstrologyStar` | Nguồn hệ thống; bảng hiện tại chưa có dẫn nguồn trực tiếp |
| Hạn | Lấy tuổi âm modulo 8 và tra hai bảng riêng cho nam/nữ | `scripts/astrology-tool.js:getAstrologyLimit` | Chưa xác lập nguồn trực tiếp |

## 4. Âm lịch, Can Chi và tiết khí

### 4.1 Thuật toán đang dùng

`scripts/lunar-core.js` triển khai nhóm công thức thường gặp trong thuật toán tính âm lịch Việt Nam công khai của Hồ Ngọc Đức:

- đổi ngày Gregory/Julian sang số ngày Julian và ngược lại;
- xấp xỉ thời điểm trăng mới;
- tính kinh độ Mặt Trời;
- xác định tháng 11 âm lịch, tháng nhuận và chuyển đổi hai chiều;
- áp dụng múi giờ Việt Nam `UTC+7`.

`scripts/lunar-details.js` tính Can Chi bằng chỉ số tuần hoàn của 10 Thiên Can và 12 Địa Chi.

### 4.2 Nguồn đối chiếu

- Hồ Ngọc Đức, [Vietnamese lunar calendar / Cách tính âm lịch Việt Nam](https://xemamlich.uhm.vn/vncal.html). Trang này cũng lưu ý rằng lịch lịch sử có thể khác lịch thiên văn hiện đại vì múi giờ và độ chính xác của công thức.
- Bản triển khai tham khảo có liên kết ngược tới thuật toán và `VietCalendar.java`: [nghiaht/AmLichVietNam](https://github.com/nghiaht/AmLichVietNam).
- Tài liệu nền thường được dẫn cùng nhóm thuật toán: Edward M. Reingold và Nachum Dershowitz, *Calendrical Calculations*; Jean Meeus, *Astronomical Algorithms*.

### 4.3 Giới hạn

App hiện mặc định UTC+7 và không phục dựng mọi biến thể lịch pháp lịch sử. Ngày ở các giai đoạn hoặc địa phương từng dùng quy tắc/múi giờ khác có thể không trùng lịch lịch sử chính thức.

## 5. 12 Trực và hạp/kỵ

### 5.1 Công thức trong app

Danh sách tuần hoàn là:

`Kiến → Trừ → Mãn → Bình → Định → Chấp → Phá → Nguy → Thành → Thu → Khai → Bế`.

Code thực hiện:

1. `dayBranch = (jd + 1) mod 12`;
2. tính kinh độ Mặt Trời tại thời điểm địa phương;
3. chia vòng kinh độ thành 12 khoảng, từ đó suy ra `monthBranch`;
4. chọn Trực theo `(dayBranch - monthBranch + 12) mod 12`.

Như vậy, Trực trong app phụ thuộc vào **tháng tiết khí**, không chỉ dựa vào số tháng âm lịch trên giao diện.

### 5.2 Hạp và kỵ

Sau khi có tên Trực, `getDayOfficerGuidance()` tra một bảng câu chữ do dự án lưu trực tiếp. Ví dụ Trực Thành được gợi ý cho khai trương, cưới hỏi, nhập học, cầu tài; Trực Thu gắn với thu hoạch, cất giữ và thu tiền.

Tài liệu đối chiếu về ý nghĩa chung của chuỗi 12 Trực: [“12 Trực – tài liệu tham khảo”](https://dodinhtruat.com/wp-content/uploads/2016/01/12-truc-tinh-goi-hoc-tro-tham-khao.pdf). Tuy nhiên, **chưa có bằng chứng trong lịch sử mã nguồn hiện tại rằng toàn bộ câu hạp/kỵ của app được lấy từ tài liệu này**. Vì vậy nguồn của từng câu vẫn được đánh dấu là chưa xác lập.

Các trường phái và lịch vạn niên có thể đưa ra danh sách nên/không nên khác nhau. App không kết hợp 12 Trực với Nhị thập bát tú, sao cát/hung hoặc tuổi người dùng để đưa ra hạp/kỵ.

## 6. Tuổi âm

App dùng công thức:

```text
tuổi âm = năm cần tra - năm sinh âm lịch + 1
```

Đây là tuổi mụ tính theo năm, không phải tuổi đầy đủ theo ngày sinh. Ngày và tháng sinh chỉ được dùng để chuyển đổi, xác định năm sinh âm lịch và hiển thị; chúng không làm tuổi tăng vào đúng sinh nhật.

## 7. Cung phi và hướng

### 7.1 Công thức hiện tại

App rút gọn tổng chữ số của `year % 100` về một chữ số rồi dùng công thức riêng theo giới tính và hai giai đoạn trước/từ năm 2000. Kết quả 5 được quy đổi:

- nam: cung Khôn (2);
- nữ: cung Cấn (8).

Sau đó app tra bảng tám cung để hiển thị Đông/Tây tứ mệnh cùng bốn hướng hợp và bốn hướng xung.

### 7.2 Nguồn đối chiếu và sai khác cần biết

Phép cộng chữ số, cách chạy Phi cung và quy tắc “Ngũ Trung: nam Khôn, nữ Cấn” có thể đối chiếu trong phần Cung Phi Bát Trạch của tài liệu [*Nghi lễ* – Thích Hoàn Thông, phần Phép tính Cung Phi Bát Trạch](https://www.niemphat.vn/downloads/thuyet-phap/nghi-thuc/nghi-le-thieu-chuong-5-ht-hoan-thong.pdf).

Tuy nhiên tài liệu đối chiếu yêu cầu xét năm theo mốc **Lập Xuân**, còn code hiện tại truyền **năm sinh âm lịch** vào `getAstrologyPalace()`. Hai cách có thể cho kết quả khác đối với người sinh gần đầu năm. Vì vậy không nên mô tả kết quả hiện tại là tuân thủ hoàn toàn phép Bát trạch nói trên cho đến khi dự án chọn rõ quy ước và có bộ kiểm thử năm biên.

Bảng hướng trong `ASTROLOGY_PALACES` chưa có dẫn nguồn từng dòng trong repository.

## 8. Mạng và 30 nạp âm

App lấy năm 1984 (Giáp Tý) làm đầu chu kỳ, chuẩn hóa năm vào khoảng `0..59`, sau đó dùng `floor(index / 2)` để chọn một trong 30 mục nạp âm. Mỗi mục chứa:

- tên nạp âm;
- hành Kim/Mộc/Thủy/Hỏa/Thổ;
- một câu diễn giải ngắn.

Tên 30 nạp âm thuộc hệ Lục thập hoa giáp. Tuy nhiên repository chưa ghi nguồn ban đầu của bảng `ASTROLOGY_NAP_AM`, đặc biệt là các câu “tượng trưng cho…”. Các câu này phải được xem là nội dung biên soạn của dự án, không phải trích dẫn học thuật.

## 9. Màu hợp và màu xung

App không tính màu từ một ontology độc lập. Nó lấy hành của nạp âm rồi tra `ASTROLOGY_COLORS`:

- nhóm màu cùng hành;
- một số màu của hành tương sinh được xếp vào màu hợp;
- màu của hành khắc hoặc bị khắc được xếp vào màu xung.

Danh sách màu và mã màu CSS là lựa chọn sản phẩm được hard-code. Repository chưa có nguồn chứng minh rằng cách gom màu này là tiêu chuẩn thống nhất. Các sắc độ thực tế cũng rộng hơn nhiều so với vài mã màu đại diện trên giao diện.

## 10. Sao Cửu Diệu và hạn

### 10.1 Sao

App tính sao bằng `tuổi âm mod 9`, rồi tra bảng riêng cho nam và nữ gồm chín tên: La Hầu, Thổ Tú, Thủy Diệu, Thái Bạch, Thái Dương, Vân Hớn, Kế Đô, Thái Âm và Mộc Đức.

### 10.2 Hạn

App tính hạn bằng `tuổi âm mod 8`, rồi tra bảng riêng cho nam và nữ gồm: Thiên Tinh, Toán Tận, Thiên La, Địa Võng, Diêm Vương, Huỳnh Tuyền, Tam Kheo và Ngũ Mộ.

Hai bảng trên hiện không kèm trích dẫn trong code hoặc lịch sử tài liệu của dự án. Tài liệu này chỉ ghi nhận chính xác thuật toán đang chạy; chưa xác nhận bảng tương ứng với một ấn bản hoặc trường phái cụ thể.

## 11. Quy tắc đóng góp cho mã nguồn mở

Khi thay đổi một công thức hoặc bảng phong tục, pull request nên có:

1. tên trường phái/quy ước được áp dụng;
2. tài liệu, tác giả, ấn bản/trang hoặc URL ổn định;
3. ghi rõ nội dung là trích dẫn, chuyển thể hay biên soạn mới;
4. tình trạng giấy phép/quyền sử dụng nếu sao chép dữ liệu;
5. test vector gồm đầu vào, kết quả mong đợi và trường hợp biên;
6. mô tả ảnh hưởng tương thích với kết quả ở phiên bản cũ.

Không sao chép nguyên bảng từ một website chỉ vì website đó truy cập công khai. “Công khai trên Internet” không đồng nghĩa với giấy phép mã nguồn mở.

## 12. Việc cần làm để tăng khả năng kiểm chứng

- Chọn và công bố rõ quy ước tính Cung phi: năm âm lịch, năm dương lịch hay mốc Lập Xuân.
- Bổ sung nguồn có quyền sử dụng rõ ràng cho bảng hướng, màu, sao và hạn.
- Đối chiếu từng câu hạp/kỵ của 12 Trực; lưu nguồn ở cấp từng bản ghi thay vì một ghi chú chung.
- Tách bảng dữ liệu khỏi logic tính toán và thêm metadata như `sourceId`, `sourceEdition`, `reviewedAt`.
- Thêm unit test cho mốc tiết khí, giao thừa, tháng nhuận, trước/sau năm 2000 và các chu kỳ 8/9/60 năm.
- Ghi phiên bản quy tắc vào kết quả hoặc dữ liệu cache để thay đổi bảng sau này không âm thầm làm thay đổi kết quả cũ.

## 13. Tóm tắt provenance hiện tại

Phần âm/dương lịch có nguồn thuật toán công khai được dự án ghi nhận là Hồ Ngọc Đức. Các phần phong tục còn lại được triển khai bằng công thức tuần hoàn và bảng hard-code phổ biến trong 12 Trực, Bát trạch, Lục thập hoa giáp, Ngũ hành và Cửu Diệu, nhưng repository trước tài liệu này không lưu đủ nguồn gốc từng bảng. Vì tính minh bạch, dự án phải coi các bảng đó là **dữ liệu nội bộ chưa xác lập provenance đầy đủ**, thay vì gán chắc chắn cho một sách hoặc tác giả.
