import { db } from "./db";

const DAY = 86_400_000;

/**
 * Lazily creates reminders for upcoming trips. Idempotent via the (userId, dedupeKey) unique index,
 * so it is safe to call on every poll. A background job (Phase 4) can reuse this function.
 */
export async function generateReminders(userId: string) {
  const now = new Date();
  const trips = await db.trip.findMany({
    where: { userId, startDate: { gt: new Date(now.getTime() - DAY), lte: new Date(now.getTime() + 3 * DAY) } },
    include: { _count: { select: { items: true } } },
  });
  for (const t of trips) {
    const days = Math.ceil((t.startDate.getTime() - now.getTime()) / DAY);
    const when = days <= 0 ? "hôm nay" : days === 1 ? "ngày mai" : `${days} ngày nữa`;
    const empty = t._count.items === 0;
    await db.notification.createMany({
      data: [{
        userId,
        dedupeKey: `start:${t.id}:${days <= 0 ? 0 : days === 1 ? 1 : 3}`,
        title: `Chuyến đi "${t.title}" khởi hành ${when}`,
        body: empty ? "Lịch trình còn trống – hãy thêm địa điểm trước khi đi." : `${t._count.items} địa điểm đã lên kế hoạch. Kiểm tra lại lịch trình và ngân sách nhé.`,
        href: `/trips/${t.id}`,
      }],
      skipDuplicates: true,
    });
  }
}
