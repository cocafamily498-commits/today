# Màn hình lịch âm dương & lịch tháng

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Màn hình Xem lịch âm dương

Màn hình gồm ba card theo đúng thứ tự:

1. Bộ công cụ chuyển đổi lịch âm/dương.
2. Thông tin Dương lịch / Âm lịch của ngày đang chọn.
3. Lịch tháng.

Quy tắc hiển thị:

- Card 1, Bộ công cụ chuyển đổi, có thể thu gọn.
- Card 2, thông tin Dương lịch / Âm lịch của ngày đang chọn, có thể thu gọn.
- Card 3, Lịch tháng, luôn hiển thị và không có tùy chọn thu gọn.
- Trạng thái của card 1 và card 2 được lưu độc lập trong `localStorage`.
- Lịch tháng cần sử dụng toàn bộ chiều ngang trên máy tính để dành không gian cho sự kiện và nhật ký trong từng ô ngày; không bố trí lịch tháng và card lịch âm thành hai cột cố định.
- Về sau, card 2 là vùng nội dung thay đổi theo chế độ: hiển thị Dương lịch / Âm lịch hoặc hiển thị Sự kiện & nhật ký của ngày đang chọn.

Ba card và chức năng thu gọn độc lập của card 1, card 2 đã được triển khai. Chế độ Sự kiện & nhật ký trong các mục tiếp theo vẫn là định hướng chưa triển khai.

## Hai chế độ xem của lịch tháng

Lịch tháng dùng chung một ngày đang chọn (`selectedDate`) và có hai chế độ chi tiết (`activeView`). Nội dung tương ứng được hiển thị trong card 2:

Các lịch tháng trong ứng dụng cần dùng chung một renderer grid. Tab Lịch âm/dương, tab Sự kiện và lịch Nhật ký sau này chỉ truyền tham số khác nhau cho cùng một hàm render, ví dụ có hiển thị ký hiệu sự kiện hay không, có hiển thị ký hiệu nhật ký hay không, và hành động khi bấm vào một ngày. Không duy trì nhiều hàm render lịch tháng song song vì dễ lặp code, phình file và gây lỗi lệch giao diện.

### Chế độ Âm lịch

- Bấm vào một ô ngày để xem thông tin lịch âm của ngày đó.
- Card chi tiết hiển thị nội dung âm lịch như can chi, tiết khí, giờ hoàng đạo và các thông tin liên quan.

### Chế độ Sự kiện & nhật ký

- Bấm vào một ô ngày để xem sự kiện và nhật ký của ngày đó.
- Ngày chưa có dữ liệu hiển thị hành động `Thêm sự kiện` và `Viết nhật ký`.
- Ngày đã có dữ liệu hiển thị danh sách sự kiện và nội dung nhật ký đầy đủ trong card chi tiết.
- Chế độ xem gần nhất có thể được ghi nhớ bằng `localStorage`.
- Khi đổi chế độ, ngày đang chọn không thay đổi; chỉ nội dung card chi tiết thay đổi.

### Nội dung trong ô lịch

Ở chế độ Sự kiện & nhật ký:

- Trên máy tính, mỗi ô ngày có thể hiển thị tiêu đề sự kiện và một đoạn nhật ký ngắn.
- Nội dung được giới hạn khoảng 2–3 dòng và cắt bằng CSS `line-clamp` với dấu `…`; không sửa nội dung gốc để thêm dấu ba chấm.
- Nếu có nhiều nội dung, có thể hiển thị dạng `+2 nội dung`.
- Nếu có ảnh, hiển thị ký hiệu hoặc ảnh thu nhỏ phù hợp, không đưa ảnh lớn vào ô lịch.
- Trên điện thoại, không hiển thị đoạn văn; chỉ dùng ký hiệu để nhận biết ngày có sự kiện, nhật ký hoặc hình ảnh.
- Cần có chú giải ngắn cho các ký hiệu.

Ký hiệu sự kiện trên lịch tháng:

- `☀`: sinh nhật.
- `☾`: đám giỗ.
- `★`: sự kiện khác.

Ba ký hiệu này tạo thành hệ trời - trăng - sao, phù hợp với ngữ cảnh lịch:

- Mặt trời biểu thị sinh nhật, dương lịch và ngày sinh.
- Mặt trăng biểu thị đám giỗ, âm lịch và sự tưởng nhớ.
- Ngôi sao biểu thị sự kiện khác, một điểm đáng chú ý trong ngày.

Nếu một ngày có nhiều sự kiện cùng loại, ô lịch chỉ cần hiển thị một ký hiệu cho loại đó. Cần có chú giải ngắn dưới lịch: `☀ Sinh nhật · ☾ Đám giỗ · ★ Sự kiện khác`.

### Thao tác với sự kiện từ lịch tháng

- Tab Sự kiện có một lịch tháng riêng để hiển thị ngày dương, ngày âm và ký hiệu sự kiện. Tab Lịch âm/dương giữ vai trò tra cứu âm/dương và không hiển thị ký hiệu sự kiện.
- Khi bấm vào ô lịch có một sự kiện, ứng dụng mở form sự kiện ở chế độ sửa và điền sẵn dữ liệu của sự kiện đó.
- Khi bấm vào ô lịch có nhiều sự kiện, ứng dụng hiển thị danh sách sự kiện trong ngày trước; người dùng chọn một sự kiện để mở form sửa.
- Form sửa có các hành động `Lưu thay đổi`, `Xóa sự kiện` và `Hủy`.
- Trong form sự kiện, `Sự kiện khác` phải cho người dùng chọn dương lịch hoặc âm lịch. Không khóa `Sự kiện khác` về dương lịch; chỉ `Sinh nhật` cố định dương lịch và `Đám giỗ` cố định âm lịch.
- Sau khi lưu, xóa hoặc hủy, form đóng lại và người dùng quay về lịch tháng.
- Lịch tháng cần cập nhật lại ký hiệu sự kiện sau khi người dùng lưu hoặc xóa.
- Form tạo/sửa sự kiện nằm trong tab Sự kiện. Người dùng có thể tạo mới từ form hoặc bấm vào một ngày trong lịch sự kiện để tạo/sửa/xóa.
