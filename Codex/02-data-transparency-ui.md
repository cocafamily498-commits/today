# Minh bạch dữ liệu cá nhân trong UI

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Minh bạch dữ liệu cá nhân

Ứng dụng cần chủ động nói rõ nơi lưu dữ liệu cá nhân để người dùng không hiểu nhầm rằng sự kiện, nhật ký hoặc ảnh đang được lưu trên cloud.

Nguyên tắc truyền đạt:

- Khi người dùng bắt đầu dùng tính năng cá nhân, UI phải nói rõ dữ liệu đang lưu trên trình duyệt/thiết bị hiện tại.
- Không tự động gửi sự kiện, nhật ký hoặc ảnh cá nhân lên cloud trong phiên bản đầu.
- Không hỏi người dùng chọn thư mục lưu database chính trên web, vì web không lưu database chính vào thư mục máy một cách ổn định như app desktop/native.
- Khi xuất backup, người dùng tự chọn nơi cất file `.lichviet`; đây là cách web trao quyền kiểm soát dữ liệu rõ ràng và phù hợp kỹ thuật.
- Cần có khu hoặc card riêng tên `Dữ liệu & sao lưu`.

Nội dung UI khuyến nghị cho khu `Dữ liệu & sao lưu`:

> Dữ liệu cá nhân đang lưu trên trình duyệt này. Ứng dụng không tự động gửi sự kiện, nhật ký hoặc ảnh của bạn lên cloud. Hãy xuất file `.lichviet` định kỳ để tự cất bản sao lưu.

Các nút chính:

- `Xuất dữ liệu`
- `Nhập dữ liệu`

Khi dữ liệu đã có nhật ký và ảnh cá nhân, phần minh bạch này là yếu tố niềm tin quan trọng, không phải chi tiết phụ.

Các hướng mở rộng ưu tiên:

1. Cá nhân hóa giao diện và các card.
2. Sự kiện, lời nhắc lặp lại theo lịch dương hoặc lịch âm.
3. Thông tin chi tiết của ngày đang chọn.
4. PWA, sử dụng ngoại tuyến và thông báo.
5. Chia sẻ, xuất dữ liệu và tích hợp lịch.
