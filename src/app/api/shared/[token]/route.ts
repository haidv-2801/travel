import { NextResponse } from "next/server";
import { loadSharedTrip } from "@/lib/shared";
import { handler, HttpError } from "@/lib/http";

export const GET = handler<{ token: string }>(async (_req, { params }) => {
  const trip = await loadSharedTrip((await params).token);
  if (!trip) throw new HttpError(404, "Not found");
  return NextResponse.json(trip);
});
