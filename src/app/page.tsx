import Link from "next/link";

const features = [
  ["🗺️", "Điểm đến", "Tìm kiếm và lọc hơn chục địa điểm nổi bật khắp Việt Nam."],
  ["📅", "Lịch trình theo ngày", "Kéo thả để sắp xếp địa điểm giữa các ngày."],
  ["💰", "Ngân sách", "Theo dõi chi phí dự kiến và thực tế, xem thống kê."],
  ["📍", "Bản đồ", "Xem toàn bộ lộ trình và khoảng cách trên bản đồ."],
];

export default function Home() {
  return (
    <div className="space-y-10 py-8">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Lên kế hoạch chuyến đi <span className="text-brand-600">dễ dàng</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">Chọn điểm đến, sắp xếp lịch trình theo ngày, kiểm soát ngân sách – tất cả trong một nơi.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/destinations" className="btn">Khám phá điểm đến</Link>
          <Link href="/trips" className="btn-ghost">Chuyến đi của tôi</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([icon, title, text]) => (
          <div key={title} className="card">
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
