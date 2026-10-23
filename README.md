# TripMate

Web lên kế hoạch du lịch (MVP): điểm đến, lịch trình theo ngày (kéo thả), cộng tác nhóm và chia chi phí. Bản thu gọn cho nhóm bạn bè/gia đình.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · PostgreSQL + Prisma · JWT (cookie httpOnly) · TanStack Query · dnd-kit · Leaflet/OpenStreetMap · Zod.

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
| Auth | Đăng ký/đăng nhập, JWT cookie, middleware + kiểm tra ở API |
| Điểm đến | Tìm kiếm không dấu ("da lat" → Đà Lạt), lọc vùng/danh mục, phân trang, chi tiết + bản đồ |
| Trip planner | Tạo chuyến đi, thêm/xoá địa điểm, kéo thả sắp xếp & chuyển ngày |
| Ngân sách | Dự kiến vs thực tế, theo loại, còn lại/vượt ngân sách |
| Bản đồ | Marker đánh số theo thứ tự trong lịch trình |
| Cộng tác (P3) | Chủ chuyến đi mời bạn bè bằng link `/invite/<token>` với quyền Chỉnh sửa hoặc Chỉ xem; chủ đổi quyền/xoá thành viên, thành viên tự rời; kiểm tra quyền ở mọi API của chuyến đi |
| Chia tiền nhóm (P3) | Mỗi khoản chi chọn người trả và chia đều cho ai (mặc định cả nhóm) hoặc chia không đều theo số tiền từng người (phải cộng đúng bằng số tiền thực tế); tab Ngân sách hiện ai trả ai bao nhiêu để cân bằng (số tiền nguyên, tối thiểu số lần chuyển). Chỉ tính khoản có số tiền thực tế và đã chọn người trả; xoá thành viên thì họ bị gỡ khỏi người trả/chia cho của chuyến đó |
| Bình chọn & bình luận (P3) | Trên từng địa điểm trong lịch trình: 👍 muốn đi / 👎 nên bỏ (mỗi người một phiếu, bấm lại để bỏ phiếu) và thảo luận; thành viên Chỉnh sửa được bình chọn và bình luận, Chỉ xem chỉ đọc; tác giả hoặc chủ xoá được bình luận |
| Nền tảng | Zod validation, rate limit (in-memory), Dockerfile, CI (typecheck/lint/migrate/build) |

## Test

```bash
npm test              # Vitest: unit + API (gọi trực tiếp route handler, Postgres thật, schema "test" riêng – không đụng dữ liệu dev)
npm run build && npm run test:e2e   # Playwright (cần DB đã migrate + seed; PW_CHROMIUM=/đường/dẫn/chromium nếu không dùng `npx playwright install`)
```

Test API tập trung vào phân quyền: truy cập chéo user (IDOR), phân quyền thành viên, rate limit.

## API (rút gọn)

`POST /api/auth/{register,login,logout}` · `GET /api/auth/me` · `GET|POST /api/destinations` · `GET|PATCH|DELETE /api/destinations/:id` · `GET|POST /api/categories` · `GET|POST /api/trips` · `GET|PATCH|DELETE /api/trips/:id` · `POST|PATCH /api/trips/:id/items` · `DELETE /api/trips/:id/items/:itemId` · `PUT /api/trips/:id/items/:itemId/vote` · `GET|POST /api/trips/:id/items/:itemId/comments` · `DELETE /api/trips/:id/comments/:commentId` · `POST /api/trips/:id/expenses` · `PATCH|DELETE /api/trips/:id/expenses/:expenseId` · `POST /api/trips/:id/invite` · `PATCH|DELETE /api/trips/:id/members/:userId` · `GET /api/invites/:token` · `POST /api/invites/:token/join`

> Đã gỡ khỏi bản thu gọn (UI + API, bảng DB vẫn giữ): yêu thích, đánh giá, chia sẻ link công khai/PDF, thông báo và cron nhắc nhở, upload ảnh, trang admin, tuyến đường OSRM, biểu đồ ngân sách. Xem lịch sử git nếu cần khôi phục.
