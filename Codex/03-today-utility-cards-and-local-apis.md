# Card tiện ích hôm nay & API local

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

## Card tiện ích trên màn hình hôm nay

Các card Thời tiết, Chỉ số thị trường, Vàng, Bạc, Ngoại tệ và Bitcoin & dầu có thể được thu gọn độc lập.

- Khi thu gọn, card chỉ còn nút mở lại.
- Trạng thái của từng card được lưu riêng trong `localStorage`.
- Lựa chọn của người dùng được khôi phục khi tải lại trang.

Chức năng này đã được triển khai trong mã hiện tại.

### Ghi chú chạy local

Các card dữ liệu trên màn hình hôm nay lấy dữ liệu qua các API local như `/api/weather`, `/api/quotes`, `/api/markets` và `/api/assets`.

- Khi test các card thời tiết, vàng, bạc, ngoại tệ, thị trường hoặc Bitcoin & dầu, phải chạy `node server.js` và mở `http://localhost:3000`.
- Không dùng static server hoặc mở trực tiếp `index.html` để test các card dữ liệu này, vì các đường dẫn `/api/...` sẽ không có backend thật và dữ liệu sẽ không hiển thị.
- Nếu toàn bộ card dữ liệu đều không tải, kiểm tra trước tiên xem `server.js` có đang chạy thật ở port `3000` không và `/api/weather` có trả JSON không.
- Static/file mode chỉ phù hợp để test giao diện tĩnh hoặc IndexedDB/form local như sự kiện, không phù hợp để test dữ liệu API.
- Nếu môi trường local chặn HTTPS ra ngoài, các API `/api/weather`, `/api/quotes`, `/api/markets`, `/api/assets` vẫn phải trả `200` với dữ liệu fallback/rỗng để UI hiển thị placeholder thay vì mất trắng.
- Khi chạy local bằng static server khác port, ví dụ `localhost:5500`, frontend phải tự trỏ các API local về `http://localhost:3000` thay vì gọi `/api/...` trên port static.
- Khi test bằng Codex, nếu `localhost:3000` chỉ hiện fallback dù website deploy vẫn có dữ liệu thật, kiểm tra xem server có đang bị giữ bởi runtime nội bộ không. Cách ổn định là thả port `3000` rồi khởi động nền trực tiếp bằng `node server.js`; khi chạy đúng process nền, `/api/weather`, `/api/quotes`, `/api/markets`, `/api/assets` sẽ trả dữ liệu thật nếu nguồn ngoài hoạt động.
- Quy ước làm việc: mỗi khi người dùng nói vừa khởi động VS Code hoặc localhost lại lỗi như thường lệ, việc đầu tiên cần làm là kiểm tra/thả port `3000` nếu cần rồi khởi động nền trực tiếp `node server.js` trong thư mục project.
