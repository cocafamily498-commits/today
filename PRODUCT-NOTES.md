# Ghi chú định hướng sản phẩm Hôm Nay

Tài liệu này lưu các quyết định đã thống nhất để tiếp tục thiết kế và phát triển ở những phiên làm việc sau.

## Định hướng chung

Hôm Nay nên phát triển thành một trung tâm tiện ích hằng ngày dành cho người Việt, lấy lịch làm chức năng cốt lõi. Thời tiết, giá vàng, giá bạc, ngoại tệ và thị trường là các mô-đun bổ trợ; giao diện cần ưu tiên sự gọn gàng và khả năng cá nhân hóa.

Các hướng mở rộng ưu tiên:

1. Cá nhân hóa giao diện và các card.
2. Sự kiện, lời nhắc lặp lại theo lịch dương hoặc lịch âm.
3. Thông tin chi tiết của ngày đang chọn.
4. PWA, sử dụng ngoại tuyến và thông báo.
5. Chia sẻ, xuất dữ liệu và tích hợp lịch.

## Card tiện ích trên màn hình Hôm nay

Các card Thời tiết, Chỉ số thị trường, Vàng, Bạc, Ngoại tệ và Bitcoin & dầu có thể được thu gọn độc lập.

- Khi thu gọn, card chỉ còn nút mở lại.
- Trạng thái của từng card được lưu riêng trong `localStorage`.
- Lựa chọn của người dùng được khôi phục khi tải lại trang.

Chức năng này đã được triển khai trong mã hiện tại.

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

## Định dạng sao lưu `.homnay`

Dữ liệu được xuất thành một file duy nhất có phần mở rộng `.homnay`. Đây là một gói ZIP chứa JSON UTF-8 và các file ảnh.

Cấu trúc dự kiến:

```text
backup.homnay
├── manifest.json
├── events.json
├── journals.json
└── images/
    ├── img-001.webp
    └── img-002.webp
```

`manifest.json` cần chứa tối thiểu:

```json
{
  "format": "homnay-backup",
  "version": 1,
  "exportedAt": "2026-06-22T11:00:00+07:00"
}
```

Một bản ghi nhật ký có thể có dạng:

```json
{
  "id": "journal-uuid",
  "date": "2026-06-22",
  "text": "Nội dung nhật ký...",
  "images": ["images/img-001.webp"],
  "createdAt": "2026-06-22T10:30:00+07:00",
  "updatedAt": "2026-06-22T11:00:00+07:00"
}
```

Quy tắc import/export:

- Kiểm tra `format` và `version` trước khi import.
- Hỗ trợ migration để nhập được file từ phiên bản cũ.
- Khi dữ liệu trùng, cho phép gộp, thay thế toàn bộ hoặc bỏ qua bản ghi trùng.
- File xuất phải chứa ảnh thật, không chỉ chứa đường dẫn đến ảnh trên thiết bị hoặc cloud.
- Người dùng cần được cảnh báo rằng xóa dữ liệu website hoặc đổi thiết bị có thể làm mất dữ liệu chưa sao lưu.

## Khả năng nâng cấp lên cloud

`.homnay` là định dạng sao lưu độc lập với nơi lưu dữ liệu. Sau này, nếu bổ sung cloud:

- Cloud dùng để đồng bộ giữa các thiết bị.
- Ứng dụng vẫn xuất toàn bộ dữ liệu hiện tại thành file `.homnay` theo phiên bản mới nhất.
- File `.homnay` cũ được migration khi import.
- Ảnh vẫn được đóng gói trong bản sao lưu.
- Người dùng luôn có thể lấy bản sao đầy đủ và rời cloud bất cứ lúc nào.

Nguyên tắc sản phẩm: cloud phục vụ đồng bộ; `.homnay` bảo đảm quyền sở hữu và khả năng di chuyển dữ liệu của người dùng.
