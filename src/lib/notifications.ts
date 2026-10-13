import { db } from "./db";
import { accessibleTrips } from "./trips";

const DAY = 86_400_000;

/**
 * Creates "trip starts soon" reminders for everyone on a trip (owner and members) for trips starting within 3 days.
 * Idempotent via the (userId, dedupeKey) unique index, so it is safe to call from a poll and from the background job.
 * With `userId` it only covers that user's trips (lazy path when they open the app); without it, every user (cron path).
 * Returns how many notifications were actually created.
 */
export async function generateReminders(userId?: string) {
  const now = new Date();
  const trips = await db.trip.findMany({
    where: { startDate: { gt: new Date(now.getTime() - DAY), lte: new Date(now.getTime() + 3 * DAY) }, ...(userId ? accessibleTrips(userId) : {}) },
    include: { _count: { select: { items: true } }, members: { select: { userId: true } } },
  });
  let created = 0;
  for (const t of trips) {
    const days = Math.ceil((t.startDate.getTime() - now.getTime()) / DAY);
    const when = days <= 0 ? "hôm nay" : days === 1 ? "ngày mai" : `${days} ngày nữa`;
    const empty = t._count.items === 0;
    const recipients = userId ? [userId] : [t.userId, ...t.members.map((m) => m.userId)];
    const r = await db.notification.createMany({
      data: recipients.map((to) => ({
        userId: to,
        dedupeKey: `start:${t.id}:${days <= 0 ? 0 : days === 1 ? 1 : 3}`,
        title: `Chuyến đi "${t.title}" khởi hành ${when}`,
        body: empty ? "Lịch trình còn trống – hãy thêm địa điểm trước khi đi." : `${t._count.items} địa điểm đã lên kế hoạch. Kiểm tra lại lịch trình và ngân sách nhé.`,
        href: `/trips/${t.id}`,
      })),
      skipDuplicates: true,
    });
    created += r.count;
  }
  return { trips: trips.length, created };
}
