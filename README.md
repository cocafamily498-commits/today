# Sổ Tay Lịch Việt

Ứng dụng web/PWA hỗ trợ lịch âm dương, quản lý sự kiện, nhật ký/ghi chú và một số tiện ích hằng ngày dành cho người Việt.

## Tính năng chính

- Xem lịch dương, lịch âm và thông tin theo ngày.
- Quản lý sự kiện, nhóm sự kiện và nhắc lịch.
- Tạo nhật ký/ghi chú, đính kèm ảnh và xuất PDF.
- Sao lưu, khôi phục dữ liệu cá nhân.
- Hoạt động theo hướng local-first bằng IndexedDB và hỗ trợ cài đặt PWA.

## Chạy dự án

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm start
```

Mở `http://localhost:3000` trong trình duyệt.

Nếu sử dụng thông báo đẩy hoặc Google OAuth, sao chép `.env.example` thành `.env` và điền các khóa tương ứng.

## Build

```bash
npm run build
```

Phiên bản triển khai được tạo trong thư mục `dist/`.

## Công nghệ

- HTML, CSS và JavaScript thuần
- Node.js
- IndexedDB
- Netlify Functions
- Service Worker/PWA

Dữ liệu sự kiện, nhật ký và ảnh được lưu trong trình duyệt hiện tại. Nên xuất file sao lưu định kỳ để tránh mất dữ liệu.
