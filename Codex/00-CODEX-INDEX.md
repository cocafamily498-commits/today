# CODEX INDEX - Sổ Tay Lịch Việt

File này là bản đồ đọc nhanh cho Codex. Khi cần sửa một phần, hãy mở đúng file nhỏ bên dưới thay vì đọc toàn bộ ghi chú dài.

## Cách dùng nhanh

- Cần hiểu sản phẩm và kiến trúc hiện tại: mở `01-product-overview-and-architecture.md`.
- Cần sửa thông báo về dữ liệu local, backup UI: mở `02-data-transparency-ui.md`.
- Cần debug card thời tiết, vàng, bạc, ngoại tệ, thị trường, Bitcoin & dầu: mở `03-today-utility-cards-and-local-apis.md`.
- Cần sửa màn hình lịch, lịch tháng, chế độ âm lịch / sự kiện: mở `04-calendar-screen-and-month-views.md`.
- Cần làm nhật ký, ảnh, sự kiện, nhắc lịch: mở `05-journals-events-reminders-behavior.md`.
- Cần sửa IndexedDB, schema, store, index: mở `06-indexeddb-data-model.md`.
- Cần làm xuất / nhập file `.lichviet`: mở `07-lichviet-backup-format.md`.
- Cần thiết kế đồng bộ cloud sau này: mở `08-cloud-roadmap.md`.

## Danh sách file

- `01-product-overview-and-architecture.md` — Tổng quan sản phẩm & cấu trúc kỹ thuật.
- `02-data-transparency-ui.md` — Minh bạch dữ liệu cá nhân trong UI.
- `03-today-utility-cards-and-local-apis.md` — Card tiện ích hôm nay & API local.
- `04-calendar-screen-and-month-views.md` — Màn hình lịch âm dương & lịch tháng.
- `05-journals-events-reminders-behavior.md` — Nhật ký, sự kiện & nhắc lịch.
- `06-indexeddb-data-model.md` — Mô hình dữ liệu IndexedDB local-first.
- `07-lichviet-backup-format.md` — Định dạng sao lưu .lichviet.
- `08-cloud-roadmap.md` — Khả năng nâng cấp lên cloud.

## Quy ước quan trọng giữ nguyên

- Dữ liệu cá nhân phiên bản đầu là local-first, lưu trong trình duyệt/thiết bị hiện tại.
- Không tự động gửi sự kiện, nhật ký hoặc ảnh cá nhân lên cloud.
- IndexedDB là nơi lưu dữ liệu chính; `localStorage` chỉ dùng cho trạng thái UI nhỏ.
- Sự kiện và nhật ký dùng ngày dương `YYYY-MM-DD` làm nguồn sự thật.
- Backup `.lichviet` là file ZIP gồm JSON UTF-8 và ảnh thật.
- Khi test API local, chạy `node server.js` ở `http://localhost:3000`.
