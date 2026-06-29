# Tổng quan sản phẩm & cấu trúc kỹ thuật

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Định hướng chung

Sổ Tay Lịch Việt nên phát triển thành một sổ tay tiện ích hằng ngày dành cho người Việt, lấy lịch âm dương và thông tin theo ngày làm chức năng cốt lõi. Thời tiết, giá vàng, giá bạc, ngoại tệ và thị trường là các mô-đun bổ trợ; giao diện cần ưu tiên sự gọn gàng và khả năng cá nhân hóa.

Tên sản phẩm đã chốt: **Sổ Tay Lịch Việt**.

Định vị ngắn gọn: lịch âm dương, ghi chú và tiện ích mỗi ngày cho người Việt.

## Cấu trúc kỹ thuật hiện tại

- Frontend dùng HTML/CSS/JavaScript thuần.
- `index.html` giữ cấu trúc giao diện và JavaScript khởi động chính.
- `styles.css` giữ toàn bộ CSS giao diện, không nhúng CSS dài trực tiếp trong `index.html`.
- `app-data.js` giữ lớp dữ liệu local-first bằng IndexedDB.
- `server.js` chạy backend local bằng Node.js tại `http://localhost:3000`.
- UI phải nói rõ với người dùng rằng dữ liệu cá nhân được lưu local trong trình duyệt/thiết bị hiện tại, không tự động gửi lên cloud. Người dùng cần xuất file `.lichviet` để sao lưu và tự chọn nơi cất bản sao lưu.
