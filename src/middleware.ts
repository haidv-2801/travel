import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, COOKIE } from "@/lib/auth-edge";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const { pathname } = req.nextUrl;
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/trips/:path*", "/admin/:path*"] };
