# Mô hình dữ liệu IndexedDB local-first

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

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
- `other` là sự kiện khác lưỡng tính: người dùng được chọn `calendarLabel = "solar"` hoặc `calendarLabel = "lunar"`. Khi lặp, `repeat.calendar` phải đi theo lịch người dùng chọn để tính lần xuất hiện đúng theo dương lịch hoặc âm lịch.
- Khi tạo `birthday`, ứng dụng tự đặt `repeat.frequency = "yearly"`, `repeat.interval = 1`.
- Khi tạo `deathAnniversary`, ứng dụng tự đặt `repeat.frequency = "yearly"`, `repeat.interval = 1`.
- Với `other`, người dùng nhập tần suất lặp của sự kiện, ví dụ không lặp, hàng ngày, hàng tuần, hàng tháng hoặc hàng năm; nếu chọn âm lịch thì lưu thêm `lunar` snapshot để tính lặp và render lịch tháng.
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
