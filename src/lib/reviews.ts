import { db } from "./db";

/** Recomputes Destination.rating / reviewCount from its reviews. */
export async function refreshRating(destinationId: string) {
  const agg = await db.review.aggregate({ where: { destinationId }, _avg: { rating: true }, _count: true });
  await db.destination.update({
    where: { id: destinationId },
    data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
  });
}
