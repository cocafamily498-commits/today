# Khả năng nâng cấp lên cloud

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Khả năng nâng cấp lên cloud

`.lichviet` là định dạng sao lưu độc lập với nơi lưu dữ liệu. Sau này, nếu bổ sung cloud:

- Cloud dùng để đồng bộ giữa các thiết bị.
- Ứng dụng vẫn xuất toàn bộ dữ liệu hiện tại thành file `.lichviet` theo phiên bản mới nhất.
- File `.lichviet` cũ được migration khi import.
- Ảnh vẫn được đóng gói trong bản sao lưu.
- Người dùng luôn có thể lấy bản sao đầy đủ và rời cloud bất cứ lúc nào.

Nguyên tắc sản phẩm: cloud phục vụ đồng bộ; `.lichviet` bảo đảm quyền sở hữu và khả năng di chuyển dữ liệu của người dùng.
