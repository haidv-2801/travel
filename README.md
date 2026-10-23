# TripMate

Web lên kế hoạch du lịch (MVP): điểm đến, lịch trình theo ngày (kéo thả), cộng tác nhóm và chia chi phí. Bản thu gọn cho nhóm bạn bè/gia đình.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + Row Level Security, `@supabase/ssr`) · TanStack Query · dnd-kit · Leaflet/OpenStreetMap · Zod.

## Chạy local

Cần Docker và Supabase CLI (`npx supabase`).

```bash
npm install
npx supabase start              # Postgres + Auth cục bộ, tự áp dụng supabase/migrations/*.sql
cp .env.example .env            # điền URL, anon key, service role key lấy từ `npx supabase status`
npm run db:seed                 # 5 danh mục + 16 địa điểm
npm run dev                     # http://localhost:3000
```

## Dùng Supabase trên cloud

1. Tạo project ở supabase.com. Vào **Project Settings, API** lấy `Project URL`, `anon` key và `service_role` key.
2. Áp dụng schema: `npx supabase link --project-ref <ref>` rồi `npx supabase db push` (hoặc dán lần lượt các file trong `supabase/migrations/` vào SQL editor).
3. **Authentication, Providers, Email**: bật/tắt "Confirm email" tuỳ ý. Nếu bật, người dùng mới phải bấm link trong email trước khi đăng nhập (app hiện thông báo). Đặt **Site URL** và Redirect URLs về domain deploy.
4. Đặt biến môi trường (máy hoặc Vercel). **Không commit key thật.**

| Biến | Dùng cho |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App (trình duyệt + server). Quyền truy cập do RLS quyết định |
| `SUPABASE_SERVICE_ROLE_KEY` | Chỉ `npm run db:seed`. Không đặt trên Vercel nếu không cần |

5. `npm run db:seed` nạp danh mục và địa điểm (cần service role key). Người dùng tự đăng ký qua app; không còn tài khoản admin, danh mục/địa điểm chỉnh qua seed hoặc Supabase Studio.

### Phân quyền (RLS)

Mọi quyền truy cập nằm trong policy ở `supabase/migrations`: chủ chuyến đi (owner), thành viên Chỉnh sửa (EDITOR) và Chỉ xem (VIEWER). Route API vẫn kiểm tra vai trò để trả 403/404 rõ ràng, nhưng RLS là lớp chặn cuối cùng. Link mời đi qua hai hàm `preview_invite` và `join_trip` nên không cần service role. Bảng mới phải bật `enable row level security` và có policy.

## Tính năng MVP

| Module | Nội dung |
|---|---|
| Auth | Supabase Auth (email + mật khẩu), cookie phiên qua `@supabase/ssr`, middleware refresh phiên, RLS ở DB |
| Điểm đến | Tìm kiếm không dấu ("da lat" → Đà Lạt), lọc vùng/danh mục, phân trang, chi tiết + bản đồ |
| Trip planner | Tạo chuyến đi, thêm/xoá địa điểm, kéo thả sắp xếp & chuyển ngày |
| Ngân sách | Dự kiến vs thực tế, theo loại, còn lại/vượt ngân sách |
| Bản đồ | Marker đánh số theo thứ tự trong lịch trình |
| Cộng tác (P3) | Chủ chuyến đi mời bạn bè bằng link `/invite/<token>` với quyền Chỉnh sửa hoặc Chỉ xem; chủ đổi quyền/xoá thành viên, thành viên tự rời; kiểm tra quyền ở mọi API của chuyến đi |
| Chia tiền nhóm (P3) | Mỗi khoản chi chọn người trả và chia đều cho ai (mặc định cả nhóm) hoặc chia không đều theo số tiền từng người (phải cộng đúng bằng số tiền thực tế); tab Ngân sách hiện ai trả ai bao nhiêu để cân bằng (số tiền nguyên, tối thiểu số lần chuyển). Chỉ tính khoản có số tiền thực tế và đã chọn người trả; xoá thành viên thì họ bị gỡ khỏi người trả/chia cho của chuyến đó |
| Bình chọn & bình luận (P3) | Trên từng địa điểm trong lịch trình: 👍 muốn đi / 👎 nên bỏ (mỗi người một phiếu, bấm lại để bỏ phiếu) và thảo luận; thành viên Chỉnh sửa được bình chọn và bình luận, Chỉ xem chỉ đọc; tác giả hoặc chủ xoá được bình luận |
| Nền tảng | Zod validation, rate limit (in-memory), Dockerfile, CI (typecheck/lint/unit/build + test RLS) |

## Test

```bash
npm test                        # Vitest: unit (split, text, geo, validators, rate-limit)
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:test   # ma trận phân quyền RLS trên DB local (rollback sau khi chạy)
npm run build && npm run test:e2e   # Playwright; cần `supabase start` + seed + .env (PW_CHROMIUM=/đường/dẫn/chromium nếu không dùng `npx playwright install`)
```

CI chạy typecheck, lint, unit, build và `supabase/tests/rls.sql` trên Postgres thường (có `stub-auth.sql` giả lập schema `auth`). Test API cũ (gọi route handler với Prisma) đã bỏ; phân quyền giờ được kiểm ở tầng DB. E2E chưa chạy trong CI vì cần cả stack Supabase.

## API (rút gọn)

`POST /api/auth/{register,login,logout}` · `GET /api/auth/me` · `GET /api/destinations` · `GET /api/destinations/:id` · `GET /api/categories` · `GET|POST /api/trips` · `GET|PATCH|DELETE /api/trips/:id` · `POST|PATCH /api/trips/:id/items` · `DELETE /api/trips/:id/items/:itemId` · `PUT /api/trips/:id/items/:itemId/vote` · `GET|POST /api/trips/:id/items/:itemId/comments` · `DELETE /api/trips/:id/comments/:commentId` · `POST /api/trips/:id/expenses` · `PATCH|DELETE /api/trips/:id/expenses/:expenseId` · `POST /api/trips/:id/invite` · `PATCH|DELETE /api/trips/:id/members/:userId` · `GET /api/invites/:token` · `POST /api/invites/:token/join`

> Đã gỡ khỏi bản thu gọn (UI + API, bảng DB vẫn giữ): yêu thích, đánh giá, chia sẻ link công khai/PDF, thông báo và cron nhắc nhở, upload ảnh, trang admin, tuyến đường OSRM, biểu đồ ngân sách. Xem lịch sử git nếu cần khôi phục.
