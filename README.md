# TripMate

Web lên kế hoạch du lịch (MVP): điểm đến, lịch trình theo ngày (kéo thả), ngân sách, bản đồ, trang quản trị.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · PostgreSQL + Prisma · JWT (cookie httpOnly) · TanStack Query · dnd-kit · Leaflet/OpenStreetMap · Recharts · Zod.

## Chạy local

```bash
cp .env.example .env            # đặt JWT_SECRET (openssl rand -base64 32)
docker compose up -d db         # PostgreSQL 16
npm install
npm run db:deploy               # áp dụng migration
npm run db:seed                 # 16 địa điểm + admin@tripmate.local / admin12345
npm run dev                     # http://localhost:3000
```

> Đổi mật khẩu admin seed trước khi triển khai thật.

## Tính năng MVP

| Module | Nội dung |
|---|---|
| Auth | Đăng ký/đăng nhập, JWT cookie, phân quyền USER/ADMIN (middleware + kiểm tra ở API) |
| Điểm đến | Tìm kiếm không dấu ("da lat" → Đà Lạt), lọc vùng/danh mục, phân trang, chi tiết + bản đồ |
| Trip planner | Tạo chuyến đi, thêm/xoá địa điểm, kéo thả sắp xếp & chuyển ngày |
| Ngân sách | Dự kiến vs thực tế, theo loại, biểu đồ, còn lại/vượt ngân sách |
| Bản đồ | Marker đánh số, đường nối, khoảng cách theo ngày (đường chim bay) |
| Admin | CRUD địa điểm, danh mục, đổi quyền người dùng |
| Nền tảng | Zod validation, rate limit (in-memory), Dockerfile, CI (typecheck/lint/migrate/build) |

## API (rút gọn)

`POST /api/auth/{register,login,logout}` · `GET /api/auth/me` · `GET|POST /api/destinations` · `GET|PATCH|DELETE /api/destinations/:id` · `GET|POST /api/categories` · `GET|POST /api/trips` · `GET|PATCH|DELETE /api/trips/:id` · `POST|PATCH /api/trips/:id/items` · `DELETE /api/trips/:id/items/:itemId` · `POST /api/trips/:id/expenses` · `PATCH|DELETE /api/trips/:id/expenses/:expenseId` · `GET /api/admin/users` · `PATCH /api/admin/users/:id`

## Hạn chế đã biết / bước tiếp theo

- Rate limit lưu trong bộ nhớ → chuyển Redis khi chạy nhiều instance.
- Khoảng cách là đường chim bay; routing thật dùng OSRM ở Phase 2.
- Chưa có test tự động; nên thêm Vitest (validators/geo) + Playwright (luồng chính).
- Phase 2+: Favorites, Sharing, Reviews, Collaborative trip, Expense splitting, AI…
