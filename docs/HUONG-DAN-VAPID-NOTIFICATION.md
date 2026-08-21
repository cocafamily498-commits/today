# Hướng dẫn cấu hình VAPID và kiểm thử Notification

Tài liệu này hướng dẫn cấu hình Web Push cho **Sổ tay lịch Việt**, đăng ký subscription/reminder và gửi notification test trên production cũng như nhánh preview của Netlify.

## 1. Tạo VAPID key

Chạy lệnh sau một lần trong thư mục dự án:

```powershell
npx web-push generate-vapid-keys --json
```

Kết quả có dạng:

```json
{
  "publicKey": "...",
  "privateKey": "..."
}
```

Chỉ tạo một cặp key và sử dụng ổn định. Không tạo lại key sau mỗi lần deploy vì các subscription đã đăng ký bằng public key cũ sẽ không còn phù hợp.

### Quy tắc bảo mật

- `publicKey` được phép công khai và gửi xuống trình duyệt.
- `privateKey` chỉ được lưu trong biến môi trường của backend.
- Không ghi private key vào Git, `index.html` hoặc JavaScript phía trình duyệt.
- Không gửi private key qua tin nhắn hoặc ảnh chụp màn hình.

Tham khảo: [web-push documentation](https://github.com/web-push-libs/web-push)

## 2. Lưu VAPID key trên Netlify

Mở project production `sotaylichviet` trên Netlify, sau đó vào:

**Project configuration → Environment variables → Add variable**

Thêm ba biến:

```text
VAPID_PUBLIC_KEY=<publicKey vừa tạo>
VAPID_PRIVATE_KEY=<privateKey vừa tạo>
VAPID_SUBJECT=mailto:<email quản trị của bạn>
```

Yêu cầu cấu hình:

- Scope phải bao gồm `Functions`.
- Deploy context tối thiểu phải bao gồm `Production`.
- Sau khi lưu biến, deploy lại production để Netlify Functions nhận cấu hình mới.

Tham khảo: [Netlify environment variables](https://docs.netlify.com/build/environment-variables/get-started/)

### Kiểm tra public key

Mở URL:

```text
https://sotaylichviet.netlify.app/api/push-vapid-public-key
```

Kết quả đúng có dạng:

```json
{
  "publicKey": "...",
  "configured": true
}
```

API chỉ được trả về public key, tuyệt đối không được trả về private key.

## 3. Đăng ký subscription và reminder

Ứng dụng đã có sẵn quy trình đăng ký:

1. Người dùng bật chức năng nhắc hệ thống.
2. Trình duyệt yêu cầu và nhận quyền Notification.
3. Ứng dụng chờ Service Worker sẵn sàng.
4. Ứng dụng lấy VAPID public key từ backend.
5. Ứng dụng gọi `pushManager.subscribe()` trên thiết bị.
6. Ứng dụng gửi subscription và danh sách reminder đến `/api/push-subscription`.

Payload có dạng:

```json
{
  "appId": "https://preview--sotaylichviet.netlify.app",
  "subscription": {
    "endpoint": "...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "reminders": [
    {
      "id": "event-id:reminder-id:2026-08-21",
      "reminderAt": "2026-08-21T09:47:00.000Z",
      "occurrenceAt": "2026-08-21T10:47:00.000Z",
      "title": "Sk test",
      "eventId": "event-id",
      "occurrenceDate": "2026-08-21"
    }
  ]
}
```

Không nên tự nhập payload subscription. Subscription phải được trình duyệt tạo trực tiếp trên đúng thiết bị/PWA vì endpoint và khóa được gắn với thiết bị đó.

### Quy đổi thời gian trong payload

Các trường `reminderAt` và `occurrenceAt` được gửi theo ISO UTC.

Ví dụ tại Việt Nam:

- Sự kiện diễn ra lúc `17:47`.
- Nhắc trước `1 giờ`.
- Thời điểm nhắc tại Việt Nam là `16:47`.
- Giá trị UTC tương ứng là `09:47:00.000Z`.

## 4. Gửi notification test

Ứng dụng đã có hàm:

```javascript
sendEventWebPushTestNotification()
```

Hàm này thực hiện:

1. Kiểm tra hỗ trợ Notification và Web Push.
2. Yêu cầu quyền Notification nếu cần.
3. Chờ Service Worker sẵn sàng.
4. Tạo mới hoặc lấy subscription hiện có.
5. Gọi API `/api/send-test-push`.
6. Netlify Function gửi push ngay lập tức.

Notification test không cần đợi Scheduled Function.

Kết quả thành công dự kiến:

```json
{
  "ok": true,
  "messageId": "test-...",
  "pushServiceStatusCode": 201
}
```

Nếu trả về `404` hoặc `410`, subscription đã hết hạn. Ứng dụng cần hủy subscription cũ và đăng ký lại.

## 5. Cấu hình riêng cho nhánh preview

Netlify Scheduled Functions chỉ tự chạy theo lịch trên production đã publish. Deploy Preview và branch deploy không tự kích hoạt Scheduled Function.

Vì vậy, khi ứng dụng chạy tại:

```text
https://preview--sotaylichviet.netlify.app
```

ba API Web Push sau cần được gọi qua backend production:

```text
https://sotaylichviet.netlify.app/api/push-vapid-public-key
https://sotaylichviet.netlify.app/api/push-subscription
https://sotaylichviet.netlify.app/api/send-test-push
```

Các API thời tiết, thị trường, Google Drive và những chức năng không liên quan đến Web Push không cần chuyển sang production.

Subscription vẫn lưu `appId` của preview và payload notification vẫn có thể mở đúng URL preview khi người dùng chạm vào thông báo.

Nếu không chuyển ba API trên sang production, preview có thể đăng ký reminder thành công vào backend preview nhưng Scheduled Function production sẽ không tìm thấy và gửi reminder đó.

Tham khảo: [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/)

## 6. Kiểm tra end-to-end

Thực hiện lần lượt:

1. Xác nhận `/api/push-vapid-public-key` trả về `configured: true`.
2. Cài ứng dụng vào màn hình chính của thiết bị.
3. Mở ứng dụng từ shortcut/PWA đã cài.
4. Bật nhắc hệ thống và cấp quyền Notification.
5. Gửi notification test và xác nhận thiết bị nhận được ngay.
6. Tạo một sự kiện cách thời điểm hiện tại ít nhất 5–10 phút.
7. Đặt reminder trước sự kiện một khoảng phù hợp để mốc reminder vẫn nằm trong tương lai.
8. Xác nhận API đăng ký subscription trả về `ok: true`.
9. Trên production, kiểm tra function `send-push-reminders` có nhãn `Scheduled` và có lần chạy kế tiếp.
10. Đợi qua mốc reminder và kiểm tra notification trên thiết bị.

Có thể mở trang Functions trên Netlify, chọn `send-push-reminders` và bấm **Run now** để kiểm thử thủ công. Tuy nhiên, việc tự chạy mỗi phút chỉ áp dụng cho production đã publish.

## 7. Các lỗi thường gặp

### `configured: false`

Thiếu `VAPID_PUBLIC_KEY` hoặc `VAPID_PRIVATE_KEY` trong biến môi trường của Netlify Functions, hoặc production chưa được deploy lại sau khi thêm biến.

### Notification test thành công nhưng reminder không chạy

- Đang sử dụng backend của Deploy Preview/branch deploy.
- Scheduled Function production không thấy reminder đã lưu ở context preview.
- Reminder được tạo sau khi mốc nhắc đã trôi qua.
- Function `send-push-reminders` chưa có nhãn `Scheduled` trên production.

### Trình duyệt trả về quyền `denied`

Người dùng phải mở phần cài đặt Notification của trình duyệt hoặc PWA trong hệ điều hành và cho phép lại. JavaScript không thể tự chuyển quyền từ `denied` sang `granted`.

### Push trả về `404` hoặc `410`

Subscription đã hết hạn hoặc bị push service thu hồi. Cần xóa subscription cũ và đăng ký lại bằng VAPID public key hiện tại.

### Đã thay đổi VAPID key

Các subscription được tạo bằng public key cũ phải được đăng ký lại. Vì vậy không nên xoay VAPID key nếu không thật sự cần thiết.
