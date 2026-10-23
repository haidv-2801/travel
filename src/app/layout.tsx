import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = { title: "TripMate – Lên kế hoạch du lịch", description: "Lập lịch trình, chia chi phí nhóm và khám phá điểm đến Việt Nam." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="text-lg font-bold text-brand-600">TripMate</Link>
            <Link href="/destinations" className="hover:text-brand-600">Điểm đến</Link>
            {user && <Link href="/trips" className="hover:text-brand-600">Chuyến đi</Link>}
            <span className="ml-auto flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-slate-500">{user.name}</span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-brand-600">Đăng nhập</Link>
                  <Link href="/register" className="btn">Đăng ký</Link>
                </>
              )}
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
