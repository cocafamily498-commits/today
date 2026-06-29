# Định dạng sao lưu .lichviet

> Tách từ `PRODUCT-NOTES(1).md` để Codex đọc theo từng ngữ cảnh nhỏ.

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
