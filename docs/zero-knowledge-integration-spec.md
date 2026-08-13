# Đặc tả kỹ thuật nâng cấp Zero Knowledge cho Sổ tay Lịch Việt

> Tài liệu chuyển giao từ prototype `Mahoa`. Dùng tài liệu này làm đầu vào khi mở dự án Sổ tay Lịch Việt. Không sao chép nguyên giao diện hoặc coi mọi chi tiết prototype là production-ready.

## 1. Mục tiêu và phạm vi

Mục tiêu là bảo vệ dữ liệu local và dữ liệu backup/đồng bộ khỏi việc bị đọc ngoài ý muốn. Mật khẩu, recovery phrase, DEK và plaintext chỉ được xử lý trên thiết bị người dùng. Node/backend không được nhận các bí mật này.

Thiết kế cần đáp ứng:

- Mã hóa từng record vừa thêm hoặc thay đổi, không mã hóa lại toàn database.
- Đọc danh sách theo trang; chỉ giải mã nội dung record khi người dùng mở record.
- Backup và đồng bộ chỉ vận chuyển ciphertext.
- Nhiều thiết bị có thể dùng chung dữ liệu thông qua backup chứa `recoveryWrappedDek`.
- Đổi mật khẩu không mã hóa lại dữ liệu và không đổi DEK.
- Có khóa phiên, sinh trắc học tùy chọn và migration an toàn từ plaintext.

“Zero Knowledge” ở đây có nghĩa là dịch vụ lưu trữ/backend không có đủ khóa để đọc nội dung. Nó không bảo vệ được khi thiết bị đã bị chiếm quyền, có XSS chạy trong phiên đang mở khóa, extension độc hại, keylogger, ảnh chụp màn hình hoặc mã nguồn build bị thay thế.

## 2. Nguyên tắc bắt buộc

1. Mật mã chạy ở client. Node chỉ build app, cung cấp API và lưu ciphertext.
2. Không dùng mật khẩu để mã hóa record trực tiếp.
3. Tạo một DEK ngẫu nhiên 256 bit để mã hóa dữ liệu.
4. Mật khẩu chỉ tạo Password KEK để bọc DEK.
5. Recovery phrase chỉ tạo Recovery KEK để bọc cùng DEK cho backup/khôi phục thiết bị mới.
6. Dùng AEAD AES-256-GCM; checksum không thay thế authentication tag.
7. Mỗi lần mã hóa phải dùng IV ngẫu nhiên 96 bit mới. Tuyệt đối không tái sử dụng IV với cùng khóa.
8. AAD phải ràng buộc ciphertext với phiên bản, két, loại dữ liệu, record và revision.
9. Không lưu DEK dạng raw. Trong phiên mở khóa, DEK là `CryptoKey` AES-GCM `extractable: false`.
10. Buffer raw key/plaintext tạm thời phải được xóa tốt nhất có thể bằng `fill(0)` trong `finally`. JavaScript không bảo đảm xóa toàn bộ bản sao do runtime quản lý, nên đây chỉ là defense-in-depth.
11. Mọi schema, thuật toán, KDF và AAD đều phải version hóa.
12. Không xóa plaintext cũ trước khi mã hóa, ghi và kiểm tra thành công toàn bộ migration.

## 3. Mô hình khóa

### 3.1 Data Encryption Key — DEK

- Sinh bằng `crypto.getRandomValues(new Uint8Array(32))`.
- Import bằng Web Crypto thành AES-GCM 256 bit, `extractable: false`, usages `encrypt/decrypt`.
- Một DEK dùng cho một vault trong phiên bản hiện tại.
- DEK raw chỉ tồn tại ngắn khi tạo két, mở wrapper hoặc đổi wrapper; sau đó phải xóa buffer.
- Không lưu DEK raw trong IndexedDB, localStorage, file backup, log, analytics hoặc server.

### 3.2 Password KEK

Thông số prototype hiện tại:

```text
KDF          Argon2id
timeCost     3
memoryKiB    65,536 (64 MiB)
parallelism  1
output       32 byte
salt         16 byte ngẫu nhiên cho mỗi lần tạo/đổi mật khẩu
```

Password KEK là AES-GCM 256 bit non-extractable, dùng để tạo `passwordWrappedDek`.

Yêu cầu tích hợp:

- Lưu toàn bộ tham số KDF cạnh wrapper để mở được dữ liệu cũ.
- Kiểm tra giới hạn trước khi chạy KDF để file độc hại không yêu cầu RAM/thời gian vô hạn.
- Đo hiệu năng trên thiết bị yếu. Mục tiêu thực tế nên khoảng 0,5–2 giây; không hạ thông số âm thầm.
- Có cơ chế nâng cấp KDF khi đăng nhập thành công: mở DEK bằng cấu hình cũ, tạo salt mới, bọc lại bằng cấu hình mới.
- Không dùng cùng salt giữa password KDF, recovery verifier và recovery wrapper.

### 3.3 Recovery KEK

- Recovery phrase: BIP39 tiếng Anh, entropy 256 bit, 24 từ và có checksum BIP39.
- Chuẩn hóa: trim, lowercase, gộp whitespace.
- Chuyển mnemonic về entropy BIP39.
- Dẫn xuất Recovery KEK bằng HKDF-SHA-256:

```text
IKM   = BIP39 entropy
salt  = 16 byte ngẫu nhiên riêng
info  = "sotay:v1:recovery-kek"
key   = AES-GCM 256 bit, non-extractable
```

- Recovery KEK bọc DEK thành `recoveryWrappedDek`.
- Recovery phrase không được lưu. Có thể lưu verifier có salt để xác nhận phrase trong luồng phá hủy local, nhưng verifier là dữ liệu nhạy cảm và phải được threat-model.

### 3.4 Biometric KEK

Prototype dùng WebAuthn platform authenticator và extension PRF:

- `userVerification: required`
- `residentKey: required`
- `authenticatorAttachment: platform`
- PRF output 32 byte được import thành AES-GCM KEK non-extractable.
- KEK này bọc cùng DEK thành `biometric.wrappedDek`.

Sinh trắc học không thay thế mật khẩu/recovery. Nó là wrapper theo thiết bị. Phải có HTTPS/secure context và fallback mật khẩu. Không được giả định mọi Android, WebView, Safari hoặc Windows Hello đều hỗ trợ PRF. Nếu native app, ưu tiên Android Keystore/iOS Keychain với user authentication thay vì ép dùng WebAuthn trong WebView.

## 4. Cấu trúc metadata của vault

Mẫu tương đương prototype:

```ts
type CipherBox = {
  iv: Uint8Array;          // 12 byte
  ciphertext: ArrayBuffer; // gồm ciphertext + GCM authentication tag
};

type VaultMeta = {
  version: 1;
  vaultId: string; // UUID ngẫu nhiên
  passwordKdf: {
    name: "Argon2id";
    timeCost: number;
    memoryKiB: number;
    parallelism: number;
    salt: Uint8Array;
  };
  passwordWrappedDek: CipherBox;
  recoveryVerifier: {
    algorithm: "SHA-256";
    salt: Uint8Array;
    digest: Uint8Array;
    words: 24;
  };
  recoveryKdf?: {
    name: "HKDF-SHA-256";
    salt: Uint8Array;
  };
  recoveryWrappedDek?: CipherBox;
  biometric?: {
    version: 1;
    credentialId: Uint8Array;
    prfSalt: Uint8Array;
    wrappedDek: CipherBox;
  };
};
```

Đề xuất production: thêm `cryptoSuite`, `createdAt`, `updatedAt`, `deviceBindingVersion` và version riêng cho từng wrapper; không suy luận thuật toán chỉ từ version tổng.

## 5. AES-GCM và AAD

AAD của prototype:

```text
Password wrapper: sotay:v1:password-wrapped-dek:{vaultId}
Recovery wrapper: sotay:v1:recovery-wrapped-dek:{vaultId}
Biometric wrapper: sotay:v1:biometric-wrapped-dek:{vaultId}
Backup manifest:  sotay:v1:backup-manifest:{vaultId}
Record summary:   sotay:v1:summary:{vaultId}:{recordId}:{revision}
Record body:      sotay:v1:body:{vaultId}:{recordId}:{revision}
```

AAD không bí mật nhưng được authentication tag bảo vệ. Nó ngăn tráo wrapper giữa két, tráo summary/body, đổi record ID hoặc revision mà không bị phát hiện.

Production nên dùng encoder chuẩn hóa thay vì ghép chuỗi tùy ý, ví dụ canonical JSON hoặc length-prefix binary. ID không được chứa dữ liệu khiến chuỗi AAD nhập nhằng. Mỗi schema mới phải có namespace/version mới.

## 6. Mô hình mã hóa record cho Sổ tay Lịch Việt

### 6.1 Chia dữ liệu thành phần plaintext và ciphertext

Không nên mã hóa mọi trường nếu app cần lịch, sắp xếp và notification hiệu quả. Phân loại đề xuất:

| Nhóm | Ví dụ | Cách lưu |
|---|---|---|
| Định danh/đồng bộ | `id`, `revision`, `deleted`, `updatedAt` | Plaintext tối thiểu, xác thực qua AAD/ciphertext |
| Lập lịch hệ thống | ngày bắt đầu/kết thúc, timezone, recurrence rule, notification timestamp | Plaintext hoặc metadata giảm thiểu nếu cần scheduler |
| Nội dung nhạy cảm | tiêu đề, mô tả, ghi chú, địa điểm chi tiết, người liên quan | Ciphertext |
| Attachment | tên file, MIME, bytes, chú thích | Ciphertext; kích thước có thể bị lộ |
| Tùy chọn thông báo | `showContentInNotification` | Plaintext boolean hoặc authenticated metadata |

Ngày/giờ plaintext làm lộ pattern hoạt động. Đây là đánh đổi chức năng–riêng tư cần ghi rõ trong UI/chính sách. Với sự kiện “quan trọng”, server chỉ nhận nội dung thông báo chung; app local giải mã khi hiển thị nếu nền tảng cho phép. Với tùy chọn **“Hiển thị nội dung sự kiện trong thông báo”**, người dùng chủ động chấp nhận gửi/lưu nội dung cần thiết dưới dạng plaintext cho pipeline notification.

#### Quy tắc bắt buộc đối với metadata lịch và nhắc việc

Đối với Sổ tay Lịch Việt, mặc định **không mã hóa** các trường cần cho database index, bộ máy lặp và scheduler chạy khi vault đang khóa:

- `startAt`, `endAt`;
- `timezone`, `allDay`;
- quy tắc lặp (`recurrenceRule`) và các ngày loại trừ/ngoại lệ cần tính lịch;
- thời điểm nhắc (`reminderAt`) hoặc cấu hình để tính các lần nhắc;
- trạng thái bật/tắt nhắc và trạng thái xử lý notification;
- `id`, `revision`, tombstone và metadata đồng bộ tối thiểu;
- tùy chọn `showContentInNotification`.

Các trường này được để plaintext nhằm:

- tạo index B-tree/SQLite/IndexedDB và truy vấn theo khoảng ngày nhanh;
- dựng lịch tháng/tuần mà không giải mã toàn bộ nội dung;
- tính các lần lặp;
- lên lịch notification khi app chưa mở khóa hoặc đang chạy nền;
- đồng bộ và merge metadata lịch hiệu quả.

Không đưa tiêu đề, mô tả, ghi chú, địa điểm chi tiết, người tham gia hoặc nội dung attachment vào phần schedule plaintext.

Schema định hướng:

```ts
type EncryptedCalendarRecord = {
  id: string;
  revision: number;
  deleted: boolean;

  // Plaintext tối thiểu để index và scheduler hoạt động
  schedule: {
    startAt: string;
    endAt: string;
    timezone: string;
    allDay: boolean;
    recurrenceRule?: string;
    recurrenceExceptions?: string[];
    reminderOffsets?: number[];
    nextReminderAt?: string;
    notificationEnabled: boolean;
    showContentInNotification: boolean;
  };

  // Xác thực canonical schedule + id + revision
  scheduleAuth: CipherBox;

  // Tiêu đề và dữ liệu cần cho danh sách
  listCipher: CipherBox;

  // Mô tả, ghi chú, địa điểm, người liên quan...
  detailCipher: CipherBox;
};
```

#### Xác thực metadata plaintext

Plaintext không có nghĩa là được phép sửa mà không bị phát hiện. `schedule` phải được serialize theo canonical format và ràng buộc với `vaultId`, `recordId`, `revision` và crypto schema version.

Với kiến trúc AES-GCM hiện tại, có thể tạo một authentication box bằng cách mã hóa payload canonical nhỏ hoặc mã hóa zero-length plaintext với toàn bộ schedule làm AAD:

```text
AAD = canonicalEncode({
  namespace: "sotay:v1:schedule-auth",
  vaultId,
  recordId,
  revision,
  schedule
})
```

Mỗi lần schedule thay đổi phải tăng revision, tạo IV mới và tạo `scheduleAuth` mới. Khi app có DEK, phải verify `scheduleAuth` trước khi tin hoặc chỉnh sửa metadata lịch.

Không ghép các field bằng dấu phân cách tùy ý. Dùng canonical JSON có key order cố định hoặc binary length-prefix để các implementation tạo đúng cùng một AAD.

#### Giới hạn khi notification chạy trong trạng thái khóa

Nếu vault đang khóa, DEK không có trong memory nên web app không thể xác minh `scheduleAuth` trước khi OS/service worker dùng metadata để kích hoạt notification. Có ba lựa chọn, phải chọn theo nền tảng:

1. **Web/local prototype:** scheduler dùng metadata plaintext khi khóa; app xác minh lại khi người dùng mở vault. Chấp nhận rủi ro kẻ sửa local database có thể làm thông báo sai giờ, nhưng vẫn không đọc được nội dung.
2. **Native app:** dùng một Schedule Authentication Key riêng được bảo vệ bởi Android Keystore/iOS Keychain và cho phép background scheduler xác minh MAC mà không mở Content DEK.
3. **Server notification:** server chỉ dùng schedule plaintext để gửi tín hiệu/thông báo chung. Server không có Content DEK và không được nhận nội dung nhạy cảm.

Không lưu Content DEK ở trạng thái nền chỉ để kiểm tra thời gian nhắc. Điều đó phá vỡ mục tiêu khóa phiên.

#### Index được phép tạo

Có thể tạo index trực tiếp trên:

```text
(startAt)
(endAt)
(nextReminderAt, notificationEnabled)
(timezone)
(deleted, revision)
```

Quy tắc lặp thường không phù hợp index chuỗi trực tiếp; nên lưu thêm `nextOccurrenceAt`/`nextReminderAt` đã tính và cập nhật sau mỗi lần xử lý. Dữ liệu dẫn xuất này cũng phải nằm trong canonical schedule được xác thực.

#### Đánh đổi riêng tư phải công khai

Người lấy được database/backup có thể quan sát thời điểm và tần suất sự kiện, múi giờ, số lần nhắc và pattern hoạt động, nhưng không biết nội dung sự kiện. Nếu có chế độ riêng tư cao, có thể cho phép mã hóa schedule của từng sự kiện, đổi lại sự kiện đó không thể được index/lặp/nhắc khi vault đang khóa hoặc chỉ nhận notification chung theo một cơ chế hạn chế hơn.

### 6.2 Summary và body

Prototype chia record thành hai ciphertext:

```ts
type StoredRecord = {
  id: string;
  revision: number;
  summary: CipherBox; // ngày/tiêu đề/updatedAt trong prototype
  body: CipherBox;    // nội dung + attachments
};
```

Sổ tay Lịch Việt có thể giữ mô hình này nhưng điều chỉnh summary:

- `listCipher`: tiêu đề và dữ liệu cần hiển thị trên danh sách.
- `detailCipher`: mô tả, ghi chú và trường chi tiết.
- `schedule`: ngày giờ/quy tắc lặp/nhắc việc plaintext tối thiểu, có `scheduleAuth` và index riêng.
- Attachment lớn nên là object mã hóa riêng/chunk riêng; không nhét toàn bộ vào một body nếu app có file lớn.
- Mỗi attachment/chunk cần IV riêng và AAD gồm vaultId, recordId, attachmentId, chunkIndex, revision.

Lợi ích: tải trang danh sách chỉ giải mã `listCipher`; chỉ khi mở sự kiện mới giải mã `detailCipher` và attachment cần xem.

### 6.3 Quy tắc cập nhật

1. Đọc record cần sửa.
2. Xác thực và giải mã duy nhất record đó.
3. Tăng `revision` đơn điệu.
4. Tạo IV mới cho từng ciphertext được ghi.
5. Mã hóa phần thay đổi bằng AAD có revision mới.
6. Ghi transaction nguyên tử.
7. Không ghi plaintext trung gian xuống disk/database.
8. Không mã hóa lại các record khác.

Nếu chỉ body đổi, có thể giữ summary cũ nhưng cần thiết kế revision riêng cho từng phần hoặc mã hóa lại summary với revision record mới. Không được đổi revision bên ngoài AAD rồi giữ ciphertext cũ.

## 7. Trình tự nghiệp vụ chuẩn

### 7.1 Tạo két lần đầu

1. Yêu cầu mật khẩu và xác nhận; policy tối thiểu hiện tại là 8 ký tự.
2. Sinh `vaultId`, DEK 32 byte, các salt độc lập.
3. Sinh recovery phrase BIP39 24 từ.
4. Chạy Argon2id tạo Password KEK.
5. Chạy HKDF tạo Recovery KEK.
6. Bọc DEK bằng hai KEK với IV/AAD riêng.
7. Import DEK phiên thành non-extractable `CryptoKey`.
8. Ghi `VaultMeta`; không ghi phrase hay raw DEK.
9. Hiển thị recovery phrase đúng một lần, yêu cầu người dùng xác nhận đã lưu.
10. Sau đó mới cho vào app.

### 7.2 Đăng nhập bằng mật khẩu

1. Đọc `VaultMeta`.
2. Validate KDF parameters trong giới hạn an toàn.
3. Chạy Argon2id từ mật khẩu.
4. Mở `passwordWrappedDek`; authentication failure nghĩa là sai mật khẩu hoặc metadata bị sửa.
5. Import raw DEK thành `CryptoKey` non-extractable rồi xóa raw buffer.
6. Nếu KDF cũ yếu hơn policy hiện tại, bọc lại DEK bằng salt/cấu hình mới.
7. Chuyển vào app ngay sau khi mở DEK; tải và giải mã danh sách theo trang ở nền.

Không giải mã toàn bộ database lúc khởi động. Prototype tải 30 summary mỗi trang và dùng infinite scroll.

### 7.3 Khóa phiên

- Chỉ giữ DEK trong memory/ref của phiên mở khóa.
- Khi khóa: bỏ reference DEK, xóa state plaintext, attachment object URL và cache đã giải mã.
- Prototype tự khóa sau 5 phút không hoạt động.
- Không tự khóa chỉ vì tab mất focus; hành vi này gây gián đoạn khi chọn file/chuyển app.
- Native app nên khóa khi background quá thời hạn cấu hình, không khóa ngay mọi lần blur.

### 7.4 Đổi mật khẩu

Thứ tự đã chốt:

1. Xác minh mật khẩu hiện tại bằng cách mở `passwordWrappedDek`.
2. Nếu đúng, kiểm tra hai mật khẩu mới khớp.
3. Kiểm tra độ dài/policy mật khẩu mới.
4. Kiểm tra mật khẩu mới khác mật khẩu cũ.
5. Tạo salt Argon2id mới và Password KEK mới.
6. Bọc lại cùng DEK thành `passwordWrappedDek` mới.
7. Ghi metadata nguyên tử.
8. Không mã hóa lại record; không đổi DEK; recovery wrapper không đổi.

### 7.5 Quên mật khẩu trên thiết bị hiện tại

Chính sách sản phẩm đã chốt trong prototype:

- Nhập đúng 24 từ chỉ xác nhận quyền thực hiện reset phá hủy.
- Không dùng recovery wrapper để đọc dữ liệu local cũ trong luồng này.
- Cảnh báo rõ và yêu cầu checkbox xác nhận.
- Xóa journal local, tạo vault/DEK/mật khẩu mới; có thể giữ cùng phrase nhưng đây là vault mới.
- Dữ liệu cũ chỉ phục hồi được từ backup tương thích.

Mục tiêu: người chỉ có recovery phrase và ngồi vào máy người dùng không thể reset mật khẩu để đọc local data cũ. Đây là quyết định sản phẩm có đánh đổi mất dữ liệu và phải được giữ nhất quán.

### 7.6 Thiết bị mới

1. Người dùng chọn backup trước.
2. Parse và kiểm tra chặt schema/size/field limits.
3. Nhập recovery phrase 24 từ và mật khẩu local mới.
4. Dẫn xuất Recovery KEK từ phrase + salt trong backup.
5. Mở `recoveryWrappedDek` của backup.
6. Dùng DEK mở manifest và kiểm tra danh sách `{id, revision}`.
7. Chỉ sau khi tất cả xác thực thành công mới ghi records.
8. Bọc cùng DEK bằng Password KEK của mật khẩu thiết bị mới.
9. Các lần sau chỉ hỏi mật khẩu/sinh trắc học của thiết bị đó.

Nếu chưa có backup, nhập 24 từ một mình không kết nối được với dữ liệu máy cũ. Không tạo một vault mới rồi báo rằng phrase cũ “đã khôi phục thành công”.

### 7.7 Bật sinh trắc học

1. Yêu cầu mật khẩu hiện tại trong input `type=password`.
2. Mở password wrapper để xác minh và lấy DEK raw ngắn hạn.
3. Tạo platform credential có user verification và PRF.
4. Dùng PRF output làm Biometric KEK.
5. Bọc DEK; lưu credential ID, PRF salt và wrapper.
6. Xóa raw buffers.
7. Khi mở app, ưu tiên gọi biometric; hủy/thất bại thì hiện form mật khẩu.

Không gọi mọi lỗi WebAuthn là “sai mật khẩu”. Phân biệt mật khẩu sai, người dùng cancel, authenticator lockout, thiếu PRF và lỗi nền tảng.

### 7.8 Giới hạn nhập sai

Prototype có một bộ đếm chung 5 lần cho đăng nhập, bật sinh trắc và đổi mật khẩu, nhưng lưu trong `sessionStorage`. Đây chỉ là UX throttling, dễ vượt qua bằng cách đóng/mở tab hoặc xóa storage; không phải biện pháp chống brute force đáng tin cậy.

Production cần:

- Argon2id là lớp chống brute force offline chính.
- Rate limit local có exponential backoff và thời điểm khóa được lưu bền vững, integrity-protected nếu có thể.
- Không xóa dữ liệu sau nhiều lần sai.
- Native app có thể dùng secure storage/OS keystore.
- Trình duyệt thường không cho trang tự đóng; thay bằng màn hình khóa cứng và nút đóng. Không tuyên bố đây là security boundary.

## 8. Backup, import và đồng bộ

### 8.1 Nội dung backup v1

```json
{
  "format": "so-tay-lich-viet",
  "version": 1,
  "exportedAt": "ISO-8601",
  "vaultId": "UUID",
  "recoveryKdf": { "name": "HKDF-SHA-256", "salt": "base64" },
  "recoveryWrappedDek": { "iv": "base64", "ciphertext": "base64" },
  "manifest": { "iv": "base64", "ciphertext": "base64" },
  "records": []
}
```

Manifest là ciphertext AES-GCM dưới DEK chứa danh sách `{id, revision}`. Record giữ nguyên ciphertext; export không giải mã và không hỏi lại 24 từ nếu recovery wrapper đã có trong metadata.

### 8.2 Import vào vault đang mở

- Không hỏi lại 24 từ.
- Bắt buộc `backup.vaultId === current.vaultId`.
- Dùng DEK phiên mở manifest để xác thực backup.
- Validate mọi box, IV, kích thước, số record, ID và revision trước khi ghi.
- Merge theo revision; cùng revision nhưng ciphertext khác phải coi là conflict/tampering, không tự ghi đè.
- Ghi transaction nguyên tử hoặc staged import.

### 8.3 Đồng bộ nhiều thiết bị

Server lưu ciphertext và metadata đồng bộ tối thiểu. Tất cả thiết bị của cùng vault dùng cùng DEK lấy từ backup/recovery wrapper, nhưng mỗi thiết bị có Password KEK và password wrapper riêng.

Đề xuất conflict model:

- ID ổn định toàn cục.
- Revision đơn điệu không đủ cho cập nhật đồng thời; nên thêm `deviceId`, vector/version stamp hoặc CRDT phù hợp.
- Tombstone xóa phải được authenticated và đồng bộ; không xóa vật lý ngay nếu thiết bị khác chưa nhận.
- Rollback protection cần một authenticated head/checkpoint hoặc append-only log. Chỉ dựa vào revision local không chống được server trả về snapshot cũ toàn bộ.

## 9. Migration từ Sổ tay Lịch Việt plaintext

Migration phải chạy một lần, có thể tiếp tục sau lỗi và không mất dữ liệu:

1. Kiểm kê schema, số record, attachment và dung lượng.
2. Tạo vault metadata ở trạng thái `migrationPending`.
3. Giữ database plaintext cũ chỉ-read.
4. Mã hóa theo batch nhỏ, từng record, có checkpoint.
5. Sau mỗi record: decrypt thử và so sánh canonical plaintext/hash trong memory.
6. Khi tất cả hoàn tất: kiểm tra count, ID, revision, attachment sizes và sample/full verification.
7. Commit cờ `migrationComplete` bằng transaction/atomic marker.
8. Chỉ sau đó mới xóa plaintext cũ.
9. Nếu crash, resume từ checkpoint; không tạo DEK mới ngoài ý muốn.
10. Cho phép export backup mã hóa ngay sau migration.

Không log plaintext hoặc recovery phrase trong telemetry/crash report. Trước migration nên hướng dẫn người dùng tạo backup dữ liệu cũ; việc xóa bản cũ phải có xác nhận và chiến lược rollback có thời hạn.

## 10. Kiến trúc module đề xuất

```text
src/security/
  crypto-suite.ts       AES-GCM, IV, AAD, serialization
  password-kdf.ts       Argon2id + policy/upgrade
  recovery.ts           BIP39, verifier, HKDF wrapper
  biometric.ts          WebAuthn PRF hoặc native keystore adapter
  vault.ts              create/unlock/lock/change password
  record-crypto.ts      list/detail/attachment encryption
  backup-format.ts      canonical parser/serializer/limits
  migration.ts          plaintext -> encrypted records
  secure-session.ts     in-memory DEK lifecycle

src/storage/
  vault-repository.ts
  encrypted-record-repository.ts
  sync-repository.ts
```

UI không được tự thao tác raw key. Tất cả crypto API nên nhận/return typed objects, không nhận chuỗi JSON không kiểm tra. Domain layer chỉ nhận plaintext trong thời gian cần thiết rồi giải phóng state khi khóa.

## 11. XSS, chuỗi cung ứng và triển khai

Zero Knowledge thất bại nếu JavaScript độc hại chạy khi vault mở. Yêu cầu tối thiểu:

- CSP nghiêm, không `unsafe-inline`/`unsafe-eval`; nonce/hash khi cần.
- Không render HTML người dùng bằng `dangerouslySetInnerHTML`.
- Sanitize nội dung rich text theo allowlist nếu có.
- Không tải script analytics/ads/tag manager vào origin xử lý vault nếu không thực sự cần.
- Pin dependency/lockfile, review update, audit SBOM và CI.
- Build reproducible, ký release/native package; kiểm soát quyền publish.
- Không đưa secret vào source map/log.
- Trusted Types nếu nền tảng hỗ trợ.
- Tách origin/vùng xử lý dữ liệu nhạy cảm khỏi nội dung bên thứ ba.

Prototype hiện chưa phải bằng chứng rằng các lớp XSS/supply-chain này đã hoàn thiện.

## 12. Chống rollback

Prototype có revision trong AAD nhưng chưa cung cấp chống rollback toàn vault hoàn chỉnh. Kẻ kiểm soát storage vẫn có thể trả lại cả ciphertext và revision cũ hợp lệ.

Production cần chọn một mô hình:

- Native/local: monotonic counter/checkpoint trong secure hardware storage nếu có.
- Đồng bộ: authenticated Merkle root/log head, ký/MAC bằng khóa dẫn xuất từ DEK, lưu nhiều checkpoint và phát hiện head lùi.
- Append-only transparency log/server receipts nếu threat model yêu cầu.

Phải phân biệt:

- **Tampering:** GCM tag/AAD phát hiện ciphertext bị sửa/tráo.
- **Rollback:** ciphertext cũ nguyên vẹn vẫn có tag hợp lệ; cần state/checkpoint bên ngoài snapshot bị rollback.

## 13. Hiệu năng và trải nghiệm

- Không giải mã toàn bộ dữ liệu khi đăng nhập.
- Vào app ngay sau khi DEK mở thành công; tải trang đầu ở nền.
- Phân trang/infinite scroll, ví dụ 30 list ciphertext/lần.
- Chỉ giải mã detail khi click record.
- Cache plaintext giới hạn trong memory; xóa khi khóa.
- Mã hóa/giải mã attachment lớn theo stream/chunk hoặc worker để không khóa UI.
- Argon2id nên chạy trong Web Worker nếu thư viện/nền tảng hỗ trợ; hiện prototype chạy async nhưng vẫn cần đo jank thực tế.
- Không hạ KDF chỉ để che vấn đề tải danh sách.

### 13.1 Tìm kiếm khi tiêu đề và nội dung đều được mã hóa

Không thể tìm kiếm trực tiếp trong AES-GCM ciphertext. Nếu không giải mã toàn bộ tiêu đề/nội dung, app phải tạo **chỉ mục tìm kiếm mã hóa** ngay lúc tạo hoặc cập nhật từng record.

Giải pháp khuyến nghị cho Sổ tay Lịch Việt:

1. Khi người dùng lưu một record, chuẩn hóa tiêu đề và nội dung trong memory.
2. Tách thành token tìm kiếm.
3. Cập nhật chỉ mục của đúng record đó trong cùng transaction với ciphertext.
4. Khi tìm kiếm, mở một phần nhỏ của chỉ mục để lấy danh sách record ứng viên.
5. Chỉ giải mã các record ứng viên rồi so khớp lại với câu truy vấn để loại false positive.

Không giải mã toàn database và không lưu từ khóa plaintext xuống IndexedDB/server.

#### Khóa riêng cho tìm kiếm

Không dùng trực tiếp DEK cho HMAC. Tạo một Search Index Key ngẫu nhiên 256 bit (`SIK`) hoặc dùng master-key hierarchy để dẫn xuất khóa tách biệt:

```text
DEK/CEK  -> chỉ mã hóa nội dung
SIK-MAC  -> tạo token tag bằng HMAC-SHA-256
SIK-ENC  -> mã hóa posting list/chỉ mục
```

Với kiến trúc prototype hiện tại, DEK đã là non-extractable AES key nên không thể dùng HKDF trực tiếp từ nó. Có hai cách production-safe:

- Tạo master secret raw khi khởi tạo vault, dẫn xuất DEK/SIK rồi chỉ lưu các key đã bọc; hoặc
- Tạo SIK ngẫu nhiên độc lập, bọc SIK bằng DEK với AAD riêng `sotay:v1:wrapped-search-key:{vaultId}`. Khi mở vault, mở SIK, import thành HMAC/AES `CryptoKey` non-extractable rồi xóa raw buffer.

Không tái sử dụng cùng key material cho AES-GCM và HMAC.

#### Chuẩn hóa tiếng Việt

Quy tắc phải cố định và version hóa, ví dụ `searchNormalizerVersion: 1`:

- Unicode normalize (`NFC` hoặc `NFKC`, chọn một và giữ cố định).
- Chuyển chữ thường theo locale tiếng Việt.
- Chuẩn hóa whitespace và dấu câu.
- Tách từ bằng `Intl.Segmenter("vi", { granularity: "word" })` khi hỗ trợ; có fallback đã kiểm thử.
- Có thể lập thêm token bỏ dấu để người dùng gõ `lich hop` vẫn tìm được `lịch họp`. Token có dấu và không dấu phải dùng namespace khác để tránh nhập nhằng.
- Không index stop-word quá phổ biến nếu muốn giảm kích thước và frequency leakage.

#### Cấu trúc chỉ mục đề xuất

Mỗi token chuẩn hóa tạo tag giả ngẫu nhiên:

```text
tokenTag = HMAC-SHA-256(SIK-MAC, searchVersion || field || normalizedToken)
```

Không lưu token thật. Dùng `tokenTag` để xác định bucket. Posting list trong bucket chứa `{recordId, revision, field}` và được mã hóa AES-GCM bằng `SIK-ENC`, IV mới, AAD gồm `vaultId`, `searchVersion`, `bucketId`, `indexRevision`.

```ts
type EncryptedSearchBucket = {
  bucketId: string;       // lấy từ một phần tokenTag
  indexRevision: number;
  box: CipherBox;         // posting list đã mã hóa
};

type EncryptedRecordSearchMeta = {
  recordId: string;
  recordRevision: number;
  box: CipherBox;         // danh sách tokenTag của record để cập nhật/xóa
};
```

`EncryptedRecordSearchMeta` cho phép khi sửa/xóa record, app biết token cũ cần gỡ khỏi posting lists mà không phải giải mã các record khác.

#### Luồng lưu/cập nhật record

1. Giải mã record hiện hành nếu đang sửa.
2. Chuẩn hóa và token hóa title/content mới.
3. Mở search metadata cũ của riêng record để lấy token tags cũ.
4. Tính tập token thêm/xóa.
5. Mở và cập nhật chỉ các bucket bị ảnh hưởng.
6. Mã hóa record, record search metadata và các bucket với IV mới.
7. Ghi tất cả trong một transaction nguyên tử.

Nếu transaction bị lỗi, cả ciphertext và index phải quay về trạng thái cũ. Không được để kết quả tìm kiếm trỏ tới revision không tồn tại.

#### Luồng tìm kiếm

1. Chuẩn hóa câu truy vấn bằng đúng version của index.
2. Tạo HMAC token tags trong memory.
3. Xác định và giải mã chỉ các bucket tương ứng.
4. Giao/hoặc của posting lists tùy kiểu truy vấn.
5. Lấy các record ứng viên theo trang.
6. Giải mã title/content của ứng viên và kiểm tra lại chuỗi thật.
7. Chỉ render kết quả đã xác minh.

Với truy vấn nhiều từ, ưu tiên bắt đầu từ token có posting list nhỏ nhất để giảm số record phải giải mã.

#### Exact, prefix, substring và fuzzy search

- **Từ chính xác:** index theo word token; nhỏ và ít rò rỉ nhất trong các lựa chọn thực tế.
- **Prefix:** tạo token prefix có giới hạn, ví dụ từ 2–12 ký tự; index lớn hơn và lộ pattern nhiều hơn.
- **Substring:** dùng n-gram (thường 3 ký tự); có thể làm index phình rất lớn và tăng frequency leakage.
- **Fuzzy/không dấu:** tạo token bổ sung có namespace riêng; phải giới hạn để tránh bùng nổ index.

Khuyến nghị phiên bản đầu chỉ hỗ trợ: từ chính xác, nhiều từ, không phân biệt hoa thường và tùy chọn không dấu. Sau đó mới cân nhắc prefix. Không nên triển khai substring/fuzzy toàn văn ngay nếu chưa đo kích thước và threat model.

#### Hai chế độ triển khai

**Local-first, ưu tiên riêng tư:** lưu index dưới dạng các bucket AES-GCM; sau khi mở vault chỉ giải mã bucket cần tìm. Server/ổ đĩa không thấy từ khóa thật.

**Tìm kiếm từ server trên ciphertext:** gửi token tags cho server để server trả record IDs. Cách này làm server quan sát được token equality, tần suất và search pattern dù không biết plaintext. Chỉ dùng nếu chấp nhận leakage này và ghi rõ trong threat model. Với mục tiêu hiện tại, nên tìm kiếm hoàn toàn trên thiết bị.

#### Giới hạn và xử lý index hỏng

- Search index là dữ liệu dẫn xuất, không phải nguồn dữ liệu chính.
- Nếu authentication tag/index revision sai, không tin kết quả; đánh dấu index hỏng.
- Cho phép rebuild index trong nền bằng cách giải mã từng record theo batch sau khi vault đã mở. Việc rebuild này hiếm khi xảy ra, có progress và không chặn UI.
- Backup nên chứa encrypted search index hoặc cho phép thiết bị mới rebuild. Nếu chứa index, manifest phải xác thực cả index version/head.
- Mọi kết quả đều phải giải mã record và xác minh lại; không coi token tag là bằng chứng nội dung.

## 14. Kiểm thử bắt buộc

### 14.1 Unit/known-answer tests

- Password đúng/sai; KDF parameter validation và upgrade.
- Recovery phrase checksum, normalization, đúng/sai.
- AES-GCM round trip cho wrapper, list, detail, attachment.
- Thay `vaultId`, `recordId`, `revision`, part hoặc IV phải thất bại.
- Sửa bất kỳ field nào trong schedule plaintext mà không tạo `scheduleAuth` mới phải bị phát hiện khi vault mở.
- Canonical schedule phải cho kết quả xác thực giống nhau trên mọi runtime được hỗ trợ.
- Index ngày giờ và `nextReminderAt` trả đúng kết quả mà không cần giải mã list/detail ciphertext.
- Đổi mật khẩu giữ nguyên DEK và đọc được record cũ.
- Raw DEK import thành non-extractable key.
- Serialization attachment: truncated/oversized/trailing bytes phải bị từ chối.
- Search normalization tiếng Việt, có dấu/không dấu và nhiều từ cho kết quả ổn định.
- Sửa/xóa một record chỉ cập nhật các search bucket liên quan.
- Search index revision/tag sai phải bị phát hiện; rebuild index không làm thay đổi record ciphertext.

### 14.2 Backup/import tests

- Backup đúng phrase khôi phục được trên thiết bị mới.
- Sai phrase, sai vaultId, manifest/tag hỏng đều không ghi dữ liệu.
- Import cùng vault không hỏi phrase.
- Conflict cùng revision khác ciphertext không bị ghi đè im lặng.
- Parser có giới hạn kích thước và chống malformed/base64 bombs.

### 14.3 Migration tests

- Crash ở mọi batch và resume.
- Không xóa plaintext trước commit hoàn tất.
- Count/ID/attachment parity.
- Dataset lớn và thiết bị ít RAM.

### 14.4 Security tests

- XSS sinks, CSP, dependency audit.
- Khóa phiên xóa UI/cache/object URL.
- Không có password/phrase/DEK/plaintext trong IndexedDB, localStorage, logs, network và crash reports.
- WebAuthn cancel/lockout/unsupported PRF có fallback đúng.
- Rollback test theo cơ chế production được chọn.

## 15. Trình tự triển khai vào dự án thật

1. Đọc kiến trúc và threat model của Sổ tay Lịch Việt.
2. Lập bảng phân loại từng field: plaintext, ciphertext list, ciphertext detail, attachment, notification.
3. Viết crypto/storage modules độc lập và test trước UI.
4. Thêm vault lifecycle và secure session.
5. Thêm encrypted repositories theo từng record.
6. Thêm migration có checkpoint.
7. Chuyển màn hình danh sách/detail sang lazy decrypt.
8. Thêm backup/restore/import và multi-device validation.
9. Thêm đổi mật khẩu, recovery destructive reset, biometric adapter.
10. Thêm sync conflict/tombstone/rollback design.
11. Hardening XSS, CSP, dependency/release pipeline.
12. Chạy security/performance/migration tests rồi mới bật mặc định.

Nên triển khai sau feature flag và trên nhánh riêng. Không thay toàn bộ storage trong một commit lớn.

## 16. Những gì được phép tái sử dụng từ `Mahoa`

Có thể tham khảo trực tiếp:

- `app/journal-crypto.ts`: cấu trúc DEK/KEK, Argon2id, AES-GCM, AAD, BIP39/HKDF, WebAuthn PRF, record serialization.
- `app/journal-db.ts`: kiểu `VaultMeta`, `CipherBox`, IndexedDB encrypted stores và paging.
- `app/journal-backup.ts`: backup JSON, recovery wrapper và encrypted manifest.
- `app/page.tsx`: trình tự UI, lazy loading, lock session, recovery, import/export.

Không sao chép nguyên mà chưa sửa:

- Bộ đếm 5 lần bằng `sessionStorage`.
- Cơ chế “đóng app” bằng `window.close()`.
- Chống rollback chưa hoàn chỉnh.
- Parser backup chưa có đầy đủ quota/size/depth limits.
- Đồng bộ conflict hiện chỉ dựa vào revision.
- Search hiện chỉ trên summaries đã giải mã/tải.
- Attachment đang nằm chung body, không phù hợp file lớn.
- Các tuyên bố “mạnh nhất/hoàn toàn an toàn”; không có hệ thống nào bảo đảm tuyệt đối.

## 17. Tiêu chí hoàn thành

Chỉ coi nâng cấp đạt yêu cầu khi:

- Database/backup/network không chứa plaintext thuộc nhóm nhạy cảm.
- Chỉ metadata lịch tối thiểu đã được phê duyệt mới ở plaintext; metadata đó có authentication và index được kiểm thử.
- Server không có password, recovery phrase, raw DEK hoặc khả năng giải mã.
- Record update chỉ mã hóa record/phần hiện hành.
- Đăng nhập không giải mã toàn bộ database.
- Đổi mật khẩu không mã hóa lại records.
- Thiết bị mới chỉ khôi phục khi backup + phrase + GCM tags/manifest cùng hợp lệ.
- Quên mật khẩu local tuân thủ chính sách xóa local đã chốt.
- Migration có thể resume và không làm mất plaintext trước khi xác minh.
- Có test tampering, rollback, backup, migration, XSS và thiết bị yếu.
- Tài liệu schema/version/AAD đủ để một implementation độc lập đọc được backup hợp lệ.

## 18. Yêu cầu khởi đầu khi mở dự án Sổ tay Lịch Việt

Sau khi copy tài liệu này vào dự án đích, dùng yêu cầu sau:

> Đọc tài liệu `zero-knowledge-integration-spec.md` và toàn bộ code liên quan đến database local, sự kiện, nhật ký, attachment, notification, backup/import/export và đồng bộ. Trước tiên lập bảng ánh xạ field plaintext/ciphertext và chỉ ra xung đột giữa kiến trúc hiện tại với đặc tả. Sau đó xây kế hoạch migration theo giai đoạn; chưa sửa dữ liệu thật cho đến khi đã có test và cơ chế rollback an toàn.
