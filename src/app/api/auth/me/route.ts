import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handler } from "@/lib/http";

export const GET = handler(async () => NextResponse.json({ user: await getCurrentUser() }));
