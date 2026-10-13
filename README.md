# TripMate

Web lên kế hoạch du lịch (MVP): điểm đến, lịch trình theo ngày (kéo thả), ngân sách, bản đồ, trang quản trị.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · PostgreSQL + Prisma · JWT (cookie httpOnly) · TanStack Query · dnd-kit · Leaflet/OpenStreetMap · Recharts · Zod.

## Chạy local

```bash
cp .env.example .env            # đặt JWT_SECRET (openssl rand -base64 32); DATABASE_URL và DIRECT_URL đã trỏ vào docker compose
docker compose up -d db         # PostgreSQL 16
npm install
npm run db:deploy               # áp dụng migration
npm run db:seed                 # 16 địa điểm + admin@tripmate.local / admin12345
npm run dev                     # http://localhost:3000
```

> Đổi mật khẩu admin seed trước khi triển khai thật.

## Dùng Supabase (Postgres trên cloud)

App chỉ cần một Postgres; đăng nhập là JWT của app nên không dùng thư viện Supabase. Có hai biến:

| Biến | Dùng cho | Giá trị |
|---|---|---|
| `DATABASE_URL` | Khi app chạy | Chuỗi kết nối trực tiếp (cổng 5432). Host serverless (Vercel...) dùng transaction pooler cổng 6543 kèm `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | `prisma migrate` (`npm run db:deploy`) | Luôn là chuỗi trực tiếp (5432) hoặc session pooler; pooler 6543 không chạy migration được |

1. Supabase Dashboard, nút **Connect**: copy chuỗi `db.<project>.supabase.co:5432`, thay `[YOUR-PASSWORD]` (ký tự đặc biệt phải mã hoá %, ví dụ `@` thành `%40`) và thêm `?sslmode=require`. Mẫu có sẵn, đang comment, trong `.env.example`.
2. Đặt `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` trong `.env` trên máy hoặc trong biến môi trường của nơi deploy. **Không commit mật khẩu thật.** Nếu mạng không có IPv6, dùng chuỗi session pooler (`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<project>`) cho `DIRECT_URL`.
3. `npm run db:deploy` để tạo bảng. `npm run db:seed` chỉ để có dữ liệu mẫu và tài khoản admin mặc định: đổi mật khẩu admin ngay nếu seed lên DB thật.
4. Migration `enable_rls` bật Row Level Security cho mọi bảng (không policy) để khoá `anon`/`authenticated` của Data API; app kết nối bằng quyền chủ bảng nên không bị ảnh hưởng. Bảng mới thêm sau này cần thêm dòng `ENABLE ROW LEVEL SECURITY` trong migration của nó. Có thể tắt luôn Data API ở Settings, API.
5. `npm test` từ chối chạy khi `DATABASE_URL` không phải Postgres cục bộ, vì test xoá dữ liệu trong schema `test`.

## Tính năng MVP

| Module | Nội dung |
|---|---|
| Auth | Đăng ký/đăng nhập, JWT cookie, phân quyền USER/ADMIN (middleware + kiểm tra ở API) |
| Điểm đến | Tìm kiếm không dấu ("da lat" → Đà Lạt), lọc vùng/danh mục, phân trang, chi tiết + bản đồ |
| Trip planner | Tạo chuyến đi, thêm/xoá địa điểm, kéo thả sắp xếp & chuyển ngày |
| Ngân sách | Dự kiến vs thực tế, theo loại, biểu đồ, còn lại/vượt ngân sách |
| Bản đồ | Marker đánh số, đường nối, khoảng cách theo ngày (đường chim bay) |
| Admin | CRUD địa điểm, danh mục, đổi quyền người dùng |
| Yêu thích (P2) | Lưu/bỏ lưu địa điểm, trang `/favorites` |
| Đánh giá (P2) | 1–5 sao + bình luận + ảnh (link https); mỗi user 1 đánh giá/địa điểm; điểm trung bình tự cập nhật |
| Chia sẻ & PDF (P2) | Link công khai chỉ-đọc `/s/<token>` (bật/tắt được, không lộ chi phí), sao chép lịch trình về tài khoản, xuất PDF qua `/trips/:id/print` |
| Thông báo (P2) | Chuông trong app, nhắc chuyến đi sắp khởi hành (≤3 ngày), chống trùng |
| Routing (P2) | Tuyến đường lái xe thật + thời gian theo ngày qua OSRM; tự động fallback đường chim bay |
| Cộng tác (P3) | Chủ chuyến đi mời bạn bè bằng link `/invite/<token>` với quyền Chỉnh sửa hoặc Chỉ xem; chủ đổi quyền/xoá thành viên, thành viên tự rời; kiểm tra quyền ở mọi API của chuyến đi |
| Chia tiền nhóm (P3) | Mỗi khoản chi chọn người trả và chia đều cho ai (mặc định cả nhóm); tab Ngân sách hiện ai trả ai bao nhiêu để cân bằng (số tiền nguyên, tối thiểu số lần chuyển). Chỉ tính khoản có số tiền thực tế và đã chọn người trả; xoá thành viên thì họ bị gỡ khỏi người trả/chia cho của chuyến đó |
| Bình chọn & bình luận (P3) | Trên từng địa điểm trong lịch trình: 👍 muốn đi / 👎 nên bỏ (mỗi người một phiếu, bấm lại để bỏ phiếu) và thảo luận; thành viên Chỉnh sửa được bình chọn và bình luận, Chỉ xem chỉ đọc; tác giả hoặc chủ xoá được bình luận |
| Nền tảng | Zod validation, rate limit (in-memory), Dockerfile, CI (typecheck/lint/migrate/build) |

## Test

```bash
npm test              # Vitest: unit + API (gọi trực tiếp route handler, Postgres thật, schema "test" riêng – không đụng dữ liệu dev)
npm run build && npm run test:e2e   # Playwright (cần DB đã migrate + seed; PW_CHROMIUM=/đường/dẫn/chromium nếu không dùng `npx playwright install`)
```

Test API tập trung vào phân quyền: truy cập chéo user (IDOR), admin-only, link chia sẻ không lộ dữ liệu, rate limit.

## API (rút gọn)

`POST /api/auth/{register,login,logout}` · `GET /api/auth/me` · `GET|POST /api/destinations` · `GET|PATCH|DELETE /api/destinations/:id` · `GET|POST /api/categories` · `GET|POST /api/trips` · `GET|PATCH|DELETE /api/trips/:id` · `POST|PATCH /api/trips/:id/items` · `DELETE /api/trips/:id/items/:itemId` · `POST /api/trips/:id/expenses` · `PATCH|DELETE /api/trips/:id/expenses/:expenseId` · `GET /api/admin/users` · `PATCH /api/admin/users/:id` · `GET|POST /api/favorites` · `DELETE /api/favorites/:destinationId` · `GET|POST /api/destinations/:id/reviews` · `DELETE /api/reviews/:id` · `PUT /api/trips/:id/items/:itemId/vote` · `GET|POST /api/trips/:id/items/:itemId/comments` · `DELETE /api/trips/:id/comments/:commentId` · `POST /api/trips/:id/invite` · `PATCH|DELETE /api/trips/:id/members/:userId` · `GET /api/invites/:token` · `POST /api/invites/:token/join` · `POST /api/trips/:id/share` · `GET /api/shared/:token` · `POST /api/shared/:token/clone` · `GET /api/notifications` · `POST /api/notifications/read` · `GET /api/route?points=lat,lng;lat,lng`

## Hạn chế đã biết / bước tiếp theo

- Rate limit lưu trong bộ nhớ → chuyển Redis khi chạy nhiều instance.
- Routing dùng OSRM demo công cộng (`router.project-osrm.org`, không đảm bảo SLA) – production nên tự host và đặt `OSRM_URL`.
- Ảnh review mới nhận link https; upload file cần object storage (Phase 4).
- Điểm đánh giá seed ban đầu bị thay bằng trung bình thực khi có review đầu tiên.
- Thông báo tạo lười khi người dùng mở app; Phase 4 chuyển sang background job.
- Tiếp theo: AI, Weather…
