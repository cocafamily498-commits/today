# Chính sách và cách đánh giá độ mạnh mật khẩu

## 1. Mục đích

Tài liệu này mô tả chính sách mật khẩu két và cách Sổ tay Lịch Việt đánh giá **mật khẩu mới**.

Thiết kế ưu tiên **độ dài và khả năng khó đoán**, không bắt buộc người dùng phải chèn số, chữ hoa hoặc ký tự đặc biệt. Thanh đánh giá sử dụng `@zxcvbn-ts/core` cùng dictionary phổ biến tối thiểu để phát hiện mật khẩu thông dụng và các mẫu dễ đoán.

Thanh đánh giá là công cụ hỗ trợ, không phải phép đo tuyệt đối về khả năng chống dò mật khẩu.

## 2. Phạm vi áp dụng

Chính sách mật khẩu mới được áp dụng khi:

- tạo két mới;
- tạo két để mã hóa dữ liệu plaintext của phiên bản cũ;
- chuyển két mã hóa từ thiết bị khác;
- đặt lại mật khẩu bằng 24 từ recovery;
- đổi mật khẩu két trong Cài đặt/Hệ thống.

Thanh độ mạnh nằm ngay dưới ô mật khẩu mới đầu tiên. Ô nhập lại mật khẩu chỉ kiểm tra hai giá trị giống nhau nên không có thanh riêng.

Các ô mật khẩu hiện tại, đăng nhập và xác nhận bật sinh trắc học không bị áp lại chính sách mật khẩu mới. Điều này bảo đảm két cũ vẫn mở được.

## 3. Điều kiện bắt buộc

Mật khẩu mới phải có **ít nhất 8 ký tự**.

Không có yêu cầu bắt buộc về:

- chữ hoa;
- chữ thường;
- chữ số;
- ký tự đặc biệt;
- số lượng từng loại ký tự.

Ví dụ, một cụm từ chỉ gồm chữ thường và khoảng trắng vẫn hợp lệ nếu dài ít nhất 8 ký tự. Tuy nhiên hợp lệ không đồng nghĩa với mạnh: cụm phổ biến hoặc dễ đoán vẫn bị thanh đánh giá xếp mức Yếu.

## 4. Kiểm tra ở hai lớp

### 4.1 Giao diện

Ô mật khẩu mới hiển thị:

> Tối thiểu 8 ký tự. Nên dùng một cụm từ dài, riêng biệt và khó đoán.

Thuộc tính HTML `minlength="8"` kiểm tra độ dài sớm. Thanh trạng thái được cập nhật khi người dùng nhập.

### 4.2 Tầng mã hóa

`assertNewPassword()` trong `scripts/data/zk-crypto.js` kiểm tra lại độ dài tối thiểu trước khi tạo két, recovery, chuyển két hoặc đổi mật khẩu. Tầng mã hóa không kiểm tra chữ hoa, chữ số hay ký tự đặc biệt.

Việc kiểm tra lại bên dưới giao diện ngăn lời gọi nội bộ bỏ qua chính sách tối thiểu của form.

### 4.3 Thứ tự kiểm tra khi đổi mật khẩu

Riêng form đổi mật khẩu, app luôn xác thực **mật khẩu hiện tại trước**. Chỉ sau khi mở được khóa bọc DEK, app mới kiểm tra độ dài mật khẩu mới và hai ô mật khẩu mới có trùng nhau hay không.

Thứ tự lỗi là:

1. mật khẩu hiện tại không đúng;
2. mật khẩu mới ngắn hơn 8 ký tự;
3. hai mật khẩu mới không khớp.

Form đổi mật khẩu dùng `novalidate` có chủ đích để kiểm tra HTML của ô mới không chặn bước xác thực mật khẩu hiện tại. Các điều kiện vẫn được kiểm tra trong tầng mã hóa trước khi ghi metadata mới.

## 5. Thành phần zxcvbn-ts

Dự án sử dụng:

- `@zxcvbn-ts/core`: máy phân tích và ước lượng độ khó đoán;
- `@zxcvbn-ts/language-common`: nguồn dictionary và mẫu bàn phím chung.

Để giữ cấu hình tối thiểu, app chỉ truyền dictionary `passwords-common` vào `ZxcvbnFactory`. Dictionary `diceware-common` và các gói ngôn ngữ đầy đủ như `language-en` không được đưa vào cấu hình đánh giá.

Các mẫu bàn phím chung (`adjacencyGraphs`) vẫn được bật để nhận diện chuỗi kiểu `qwerty`, chuỗi bàn phím số và mẫu tương tự.

Nguồn chính thức:

- [Hướng dẫn ngôn ngữ và dictionary của zxcvbn-ts](https://zxcvbn-ts.github.io/zxcvbn/guide/languages/)
- [Tùy chọn dictionary và keyboard graphs](https://zxcvbn-ts.github.io/zxcvbn/guide/options/)
- [`@zxcvbn-ts/core` trên npm](https://www.npmjs.com/package/@zxcvbn-ts/core)
- [`@zxcvbn-ts/language-common` trên npm](https://www.npmjs.com/package/@zxcvbn-ts/language-common)

Hai package được phát hành theo giấy phép MIT. Phiên bản đang khóa trong `package-lock.json` là nguồn sự thật của bản build cụ thể.

## 6. Cách tính mức hiển thị

### 6.1 Điểm ước lượng

`zxcvbn-ts` trả về điểm từ 0 đến 4 dựa trên khả năng đoán, dictionary phổ biến và các mẫu nhận diện được.

### 6.2 Trần theo độ dài

Để độ dài có vai trò ưu tiên và ngăn mật khẩu ngắn được hiển thị quá mạnh, app đặt trần:

| Độ dài | Điểm tối đa |
|---|---:|
| Dưới 8 ký tự | Không hợp lệ; mức Yếu |
| 8–11 ký tự | 1 |
| 12–15 ký tự | 2 |
| 16–19 ký tự | 3 |
| Từ 20 ký tự | 4 |

Điểm cuối cùng:

```text
điểm cuối = min(điểm zxcvbn-ts, trần theo độ dài)
```

Một mật khẩu dài vẫn có thể bị đánh giá Yếu nếu là cụm phổ biến, lặp lại hoặc dễ đoán. Ngược lại, mật khẩu ngắn không thể đạt mức cao chỉ nhờ trộn nhiều loại ký tự.

## 7. Các mức trên giao diện

| Trạng thái | Điều kiện | Thanh |
|---|---|---|
| Chưa nhập mật khẩu | Giá trị rỗng | Xám, 0% |
| Yếu — cần ít nhất 8 ký tự | Dưới 8 ký tự | Đỏ, 25% |
| Yếu — cụm từ phổ biến hoặc dễ đoán | Điểm cuối 0 hoặc 1 | Đỏ, 25% |
| Trung bình | Điểm cuối 2 | Vàng, 50% |
| Mạnh | Điểm cuối 3 | Xanh lá, 75% |
| Rất mạnh | Điểm cuối 4 | Xanh dương, 100% |

## 8. Ví dụ hành vi

| Loại mật khẩu | Kết quả dự kiến |
|---|---|
| Dưới 8 ký tự | Không hợp lệ, Yếu |
| Từ phổ biến lặp lại nhiều lần | Có thể hợp lệ về độ dài nhưng vẫn Yếu |
| Chuỗi bàn phím dài | Có thể bị hạ điểm do mẫu bàn phím |
| Cụm riêng biệt 12–15 ký tự | Tối đa Trung bình |
| Cụm riêng biệt 16–19 ký tự | Tối đa Mạnh |
| Cụm riêng biệt từ 20 ký tự | Có thể đạt Rất mạnh nếu zxcvbn-ts cho điểm 4 |

Không đưa mật khẩu minh họa cụ thể để tránh người dùng sao chép nguyên một ví dụ công khai.

## 9. Hiện và ẩn mật khẩu

Mọi ô mật khẩu có nút hình con mắt:

- mặc định dùng `type="password"`;
- bấm để chuyển sang `type="text"`;
- bấm lại để che mật khẩu;
- nhãn đọc màn hình đổi giữa “Hiện mật khẩu” và “Ẩn mật khẩu”;
- `aria-pressed` phản ánh trạng thái.

Thao tác này chỉ thay đổi cách hiển thị trong trình duyệt. Người dùng nên che lại mật khẩu khi có người khác nhìn màn hình.

## 10. Quan hệ với mã hóa két

Mật khẩu không trực tiếp mã hóa toàn bộ dữ liệu. App dùng Argon2id để dẫn xuất KEK từ mật khẩu, rồi KEK bọc khóa dữ liệu DEK. Khi đổi mật khẩu, app bọc lại cùng DEK thay vì mã hóa lại toàn bộ bản ghi.

Cấu hình Argon2id hiện tại:

| Tham số | Giá trị |
|---|---:|
| `timeCost` | 3 |
| `memoryKiB` | 65.536 KiB |
| `parallelism` | 1 |
| Salt | 16 byte ngẫu nhiên |

Mỗi lần tạo hoặc đổi mật khẩu sử dụng salt mới.

## 11. Quyền riêng tư và hoạt động offline

Việc đánh giá chạy hoàn toàn trong trình duyệt:

- không gửi mật khẩu tới server;
- không gọi dịch vụ kiểm tra rò rỉ;
- không ghi mật khẩu vào log;
- các package và dictionary được đóng cùng bản build để hoạt động offline sau khi PWA được cache.

## 12. Giới hạn hiện tại

- `passwords-common` không phải dictionary tiếng Việt đầy đủ.
- App chưa đối chiếu tên, ngày sinh, số điện thoại hoặc dữ liệu cá nhân của người dùng.
- App không kiểm tra mật khẩu đã xuất hiện trong rò rỉ công khai.
- Điểm zxcvbn-ts là ước lượng, không bảo đảm thời gian phá mật khẩu thực tế.
- Một cụm rất dài nhưng là câu nổi tiếng vẫn có thể chưa bị nhận diện nếu không nằm trong dictionary tối thiểu.

Không bổ sung dữ liệu cá nhân vào `userInputs` của zxcvbn-ts nếu chưa có thiết kế riêng tư và sự đồng ý phù hợp.

## 13. Khuyến nghị cho người dùng

- Dùng cụm từ riêng biệt dài ít nhất 16 ký tự; từ 20 ký tự giúp có khả năng đạt mức cao nhất.
- Tránh câu nổi tiếng, lời bài hát, tên ứng dụng và chuỗi bàn phím.
- Không dùng tên, ngày sinh, số điện thoại hoặc dữ liệu dễ tìm.
- Không tái sử dụng mật khẩu ở dịch vụ khác.
- Có thể dùng trình quản lý mật khẩu để tạo và lưu mật khẩu dài ngẫu nhiên.
- Lưu riêng 24 từ recovery tại nơi an toàn.

## 14. Vị trí mã nguồn

| Thành phần | File/hàm |
|---|---|
| Điều kiện tối thiểu | `scripts/data/zk-crypto.js:assertNewPassword` |
| Khởi tạo zxcvbn-ts tối thiểu | `scripts/vault-gate.js:getPasswordEstimator` |
| Tạo ô mật khẩu | `scripts/vault-gate.js:passwordInput` |
| Chấm điểm và trần độ dài | `scripts/vault-gate.js:passwordStrength` |
| Nút hiện/ẩn và cập nhật thanh | `scripts/vault-gate.js:setupPasswordControls` |
| Màu thanh | `scripts/styles/part-01.css` |
| Package và phiên bản | `package.json`, `package-lock.json` |
| Đưa package vào bản deploy | `build.js` |
| Cache PWA | `service-worker.js` |
| Kiểm thử chính sách tối thiểu | `tests/zk-crypto.test.js` |

## 15. Quy tắc tương thích

Điều kiện tối thiểu chỉ áp dụng khi đặt **mật khẩu mới**. Không áp điều kiện mới vào thao tác mở khóa bằng mật khẩu hiện có, vì có thể làm người dùng mất khả năng truy cập két được tạo ở phiên bản trước.
