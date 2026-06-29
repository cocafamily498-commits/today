# Ghi chú định hướng sản phẩm Sổ Tay Lịch Việt

Tài liệu này lưu các quyết định đã thống nhất để tiếp tục thiết kế và phát triển ở những phiên làm việc sau.

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
- Sau khi lưu, xóa hoặc hủy, form đóng lại và người dùng quay về lịch tháng.
- Lịch tháng cần cập nhật lại ký hiệu sự kiện sau khi người dùng lưu hoặc xóa.
- Form tạo/sửa sự kiện nằm trong tab Sự kiện. Người dùng có thể tạo mới từ form hoặc bấm vào một ngày trong lịch sự kiện để tạo/sửa/xóa.

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

## Cấu trúc dữ liệu local-first

Phiên bản web/PWA dùng `IndexedDB` làm nơi lưu dữ liệu chính. `localStorage` chỉ dùng cho trạng thái giao diện nhỏ như card đang thu gọn hoặc chế độ xem gần nhất.

Tên database dự kiến: `so-tay-lich-viet`.

Các object store chính:

1. `events`: sự kiện, lịch nhắc và quy tắc lặp.
2. `journals`: ghi chú hoặc nhật ký theo ngày.
3. `images`: ảnh đã thu nhỏ và nén.
4. `settings`: thiết lập giao diện và tuỳ chọn người dùng.
5. `reminderDismissals`: các lần nhắc đã được bỏ qua.
6. `appMeta`: metadata như phiên bản dữ liệu, lần sao lưu gần nhất.

### Nguyên tắc ngày tháng

- Mọi sự kiện và nhật ký đều lưu ngày dương dạng `YYYY-MM-DD` trong trường `date`.
- Trường `date` là nguồn sự thật duy nhất để neo dữ liệu vào lịch.
- Với `birthday` và `deathAnniversary`, ngày/tháng trong `date` là phần quan trọng để lặp hằng năm. Năm trong `date` chỉ là năm gốc tham khảo; người dùng có thể nhập năm thật, năm gần đúng hoặc một năm bất kỳ nếu không nhớ. Sự kiện vẫn tự xuất hiện hằng năm theo quy tắc lặp, không chỉ xảy ra trong năm đó.
- Với `other`, năm trong `date` là năm xảy ra của sự kiện, trừ khi người dùng chọn lặp.
- Ngày dương trong `date` vẫn là mốc chính, nhưng với sự kiện có nhãn âm lịch hoặc lặp theo âm lịch, ứng dụng lưu thêm snapshot âm lịch trong trường `lunar` để render lịch tháng và tính lặp nhanh hơn.
- Không cần lưu `lunar.year` cho mục đích lặp hằng năm; chỉ cần ngày âm, tháng âm và trạng thái tháng nhuận.
- Trường `month` dạng `YYYY-MM` được lưu thêm để truy vấn nhanh dữ liệu của lịch tháng.

### Store `events`

```json
{
  "id": "event-uuid",
  "date": "2026-02-17",
  "month": "2026-02",
  "title": "Mùng 1 Tết",
  "note": "",
  "eventType": "other",
  "calendarLabel": "lunar",
  "lunar": {
    "day": 1,
    "month": 1,
    "leap": false
  },
  "time": null,
  "allDay": true,
  "color": "red",
  "repeat": {
    "frequency": "yearly",
    "calendar": "lunar",
    "interval": 1,
    "until": null
  },
  "reminders": [
    {
      "id": "reminder-uuid",
      "enabled": true,
      "beforeDays": 0,
      "beforeHours": 0,
      "time": "08:00",
      "allowSnooze": true,
      "defaultSnoozeMinutes": 10
    }
  ],
  "createdAt": "2026-06-22T10:30:00+07:00",
  "updatedAt": "2026-06-22T11:00:00+07:00"
}
```

Quy ước:

- `eventType`: loại sự kiện, gồm `birthday`, `deathAnniversary`, `other`.
- `calendarLabel`: nhãn hiển thị, gồm `solar` hoặc `lunar`.
- `lunar`: snapshot âm lịch được lưu khi `calendarLabel = "lunar"` hoặc `repeat.calendar = "lunar"`; gồm `day`, `month`, `leap`.
- `repeat.frequency`: tần suất lặp của sự kiện, gồm `none`, `daily`, `weekly`, `monthly`, `yearly`.
- `repeat.calendar`: `solar` hoặc `lunar`, quyết định cách tính lần lặp.
- Với sự kiện không lặp, dùng `repeat.frequency = "none"`.
- Trên web/PWA, `reminders` chỉ phục vụ nhắc trong app.
- Trên Android/iOS native, `reminders` được dùng để đăng ký local notification native.

Ba loại sự kiện chính:

- `birthday`: sinh nhật.
- `deathAnniversary`: đám giỗ.
- `other`: sự kiện khác.

Ràng buộc theo loại sự kiện:

- `birthday` luôn dùng dương lịch: `calendarLabel = "solar"` và `repeat.calendar = "solar"`.
- `deathAnniversary` luôn dùng âm lịch: `calendarLabel = "lunar"` và `repeat.calendar = "lunar"`.
- `other` luôn dùng dương lịch: `calendarLabel = "solar"` và `repeat.calendar = "solar"`.
- Khi tạo `birthday`, ứng dụng tự đặt `repeat.frequency = "yearly"`, `repeat.interval = 1`.
- Khi tạo `deathAnniversary`, ứng dụng tự đặt `repeat.frequency = "yearly"`, `repeat.interval = 1`.
- Với `other`, người dùng nhập tần suất lặp của sự kiện, ví dụ không lặp, hàng ngày, hàng tuần, hàng tháng hoặc hàng năm.
- Phiên bản đầu không hỗ trợ lặp hàng giờ vì không phải trọng tâm của sổ tay lịch.
- Với `birthday` và `deathAnniversary`, giờ nhắc mặc định là `08:00`.
- Thời điểm nhắc trước bao nhiêu ngày và bao nhiêu giờ do người dùng nhập trong `reminders.beforeDays` và `reminders.beforeHours`.

### Store `journals`

```json
{
  "id": "journal-uuid",
  "date": "2026-06-22",
  "month": "2026-06",
  "text": "Nội dung nhật ký...",
  "imageIds": ["image-uuid-1"],
  "createdAt": "2026-06-22T10:30:00+07:00",
  "updatedAt": "2026-06-22T11:00:00+07:00"
}
```

Nhật ký là dữ liệu riêng, không phải một loại sự kiện trong `events`. Nhật ký không có `eventType`, không có `repeat` và không liên quan đến `reminders`.

Mỗi ngày chỉ có một bản ghi nhật ký. Trường `date` của `journals` cần là duy nhất; khi người dùng sửa nhật ký trong ngày đó, ứng dụng cập nhật bản ghi hiện có thay vì tạo bản ghi mới. Khi hiển thị trên lịch tháng, ứng dụng chỉ lấy tóm tắt ngắn của nhật ký theo ngày.

### Store `reminderDismissals`

```json
{
  "id": "dismissal-uuid",
  "eventId": "event-uuid",
  "reminderId": "reminder-uuid",
  "occurrenceDate": "2026-06-22",
  "dismissedAt": "2026-06-22T08:05:00+07:00"
}
```

Store này chỉ lưu trạng thái bỏ qua của từng lần xuất hiện. Ví dụ sinh nhật năm 2026 bị `Bỏ qua lần này` thì sinh nhật năm 2027 vẫn nhắc lại theo `reminders` gốc.

### Store `images`

```json
{
  "id": "image-uuid-1",
  "blob": "Blob",
  "mimeType": "image/webp",
  "width": 1280,
  "height": 720,
  "size": 184320,
  "createdAt": "2026-06-22T10:30:00+07:00"
}
```

Ảnh chỉ gắn với nhật ký qua `journals.imageIds`. Sự kiện trong `events` hoàn toàn không có ảnh và không có trường `imageIds`.

Ảnh phải được thu nhỏ và nén trước khi lưu, ưu tiên WebP hoặc JPEG. File export `.lichviet` phải đóng gói ảnh thật trong thư mục `images/`.

### Store `settings`

```json
{
  "key": "ui",
  "value": {
    "activeView": "lunar",
    "collapsedCards": {
      "weather": false,
      "markets": false,
      "gold": false,
      "silver": false,
      "currency": false,
      "bitcoinOil": false,
      "converter": false,
      "dayDetail": false
    }
  },
  "updatedAt": "2026-06-22T11:00:00+07:00"
}
```

### Store `appMeta`

```json
{
  "key": "backup",
  "value": {
    "lastExportedAt": null,
    "lastImportedAt": null
  },
  "updatedAt": "2026-06-22T11:00:00+07:00"
}
```

### Index cần có

- `events.byDate` theo `date`.
- `events.byMonth` theo `month`.
- `journals.byDate` theo `date`, là unique index.
- `journals.byMonth` theo `month`.
- `reminderDismissals.byEventOccurrence` theo `[eventId, occurrenceDate]`.
- `images.byCreatedAt` theo `createdAt`.

## Định dạng sao lưu `.lichviet`

Dữ liệu được xuất thành một file duy nhất có phần mở rộng `.lichviet`. Đây là một gói ZIP chứa JSON UTF-8 và các file ảnh.

Cấu trúc dự kiến:

```text
backup.lichviet
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
  "format": "lichviet-backup",
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
- File export phải bao gồm đầy đủ sự kiện, nhật ký, metadata và ảnh liên quan.
- Nhật ký được đóng gói trong `journals.json`.
- Hỗ trợ migration để nhập được file từ phiên bản cũ.
- Khi dữ liệu trùng, cho phép gộp, thay thế toàn bộ hoặc bỏ qua bản ghi trùng.
- File xuất phải chứa ảnh thật, không chỉ chứa đường dẫn đến ảnh trên thiết bị hoặc cloud.
- Người dùng cần được cảnh báo rằng xóa dữ liệu website hoặc đổi thiết bị có thể làm mất dữ liệu chưa sao lưu.

## Khả năng nâng cấp lên cloud

`.lichviet` là định dạng sao lưu độc lập với nơi lưu dữ liệu. Sau này, nếu bổ sung cloud:

- Cloud dùng để đồng bộ giữa các thiết bị.
- Ứng dụng vẫn xuất toàn bộ dữ liệu hiện tại thành file `.lichviet` theo phiên bản mới nhất.
- File `.lichviet` cũ được migration khi import.
- Ảnh vẫn được đóng gói trong bản sao lưu.
- Người dùng luôn có thể lấy bản sao đầy đủ và rời cloud bất cứ lúc nào.

Nguyên tắc sản phẩm: cloud phục vụ đồng bộ; `.lichviet` bảo đảm quyền sở hữu và khả năng di chuyển dữ liệu của người dùng.
