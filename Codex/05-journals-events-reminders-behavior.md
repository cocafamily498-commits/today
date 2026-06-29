# Nhật ký, sự kiện & nhắc lịch

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Ghi chú và nhật ký theo ngày

Nhật ký là ghi chú gắn với từng ngày, hỗ trợ văn bản và hình ảnh. Đây là chức năng local-first:

- Không yêu cầu tài khoản.
- Không thu thập dữ liệu người dùng.
- Không gửi dữ liệu lên cloud trong phiên bản đầu.
- Văn bản, sự kiện, metadata và ảnh được lưu trong `IndexedDB`.
- Không lưu ảnh trong Web Storage `localStorage` vì giới hạn dung lượng.
- Ảnh nên được thu nhỏ và nén trước khi lưu, ưu tiên WebP hoặc JPEG.
- Lịch tháng đánh dấu những ngày có sự kiện, nhật ký hoặc hình ảnh.
- Nên hiển thị dung lượng đang sử dụng và nhắc người dùng sao lưu định kỳ.

## Nhắc lịch theo nền tảng

Nhắc lịch cần được thiết kế khác nhau giữa phiên bản web/PWA và phiên bản native:

- Trên web/PWA, nhắc lịch chỉ hiển thị trong app khi người dùng đang mở ứng dụng.
- Web/PWA có thể đánh dấu sự kiện hôm nay, sự kiện sắp tới, trạng thái quá hạn và hiển thị banner hoặc danh sách nhắc trong giao diện.
- Khi hiển thị nhắc lịch trong app, có nút `Bỏ qua lần này` để ẩn lần nhắc hiện tại nhưng không tắt `reminders` gốc và không xóa sự kiện khỏi lịch.
- Web/PWA không dùng notification hệ thống làm cơ chế nhắc lịch chính, vì thông báo nền phụ thuộc vào trình duyệt, quyền hệ thống, service worker, push server và trạng thái thiết bị.
- Trên Android và iOS native, nhắc lịch sẽ dùng local notification native.
- Local notification native là nơi hỗ trợ thông báo ngoài app, âm báo, rung, nhắc lại và bỏ qua đáng tin cậy hơn.
- Dữ liệu sự kiện vẫn lưu ngày dương làm nguồn sự thật; nếu sự kiện lặp theo âm lịch, ứng dụng chuyển ngày dương gốc sang âm lịch để tính các lần nhắc tương ứng.
- `other` là sự kiện khác lưỡng tính: có thể chọn dương lịch hoặc âm lịch. Nếu `other` dùng âm lịch, nhắc lịch và lần lặp phải tính theo snapshot âm lịch đã lưu, giống nguyên tắc của các sự kiện lặp âm lịch khác.
