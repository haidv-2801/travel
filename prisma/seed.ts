import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalize } from "../src/lib/text";

const prisma = new PrismaClient();

const categories = [
  { name: "Biển", slug: "bien" },
  { name: "Núi & Thiên nhiên", slug: "nui-thien-nhien" },
  { name: "Văn hoá & Lịch sử", slug: "van-hoa" },
  { name: "Ẩm thực", slug: "am-thuc" },
  { name: "Thành phố", slug: "thanh-pho" },
];

const places = [
  ["Vịnh Hạ Long", "ha-long", "Quảng Ninh", "Miền Bắc", 20.9101, 107.1839, "bien", 600000, 4.8, "Di sản thiên nhiên thế giới với hàng nghìn đảo đá vôi."],
  ["Phố cổ Hà Nội", "pho-co-ha-noi", "Hà Nội", "Miền Bắc", 21.0341, 105.8513, "van-hoa", 200000, 4.6, "36 phố phường, ẩm thực đường phố và nhịp sống truyền thống."],
  ["Sa Pa", "sa-pa", "Lào Cai", "Miền Bắc", 22.3364, 103.8438, "nui-thien-nhien", 450000, 4.7, "Ruộng bậc thang, bản làng và đỉnh Fansipan."],
  ["Ninh Bình - Tràng An", "trang-an", "Ninh Bình", "Miền Bắc", 20.2506, 105.9745, "nui-thien-nhien", 300000, 4.7, "Non nước hữu tình, đi thuyền qua các hang động."],
  ["Phong Nha - Kẻ Bàng", "phong-nha", "Quảng Bình", "Miền Trung", 17.5937, 106.2834, "nui-thien-nhien", 500000, 4.8, "Hệ thống hang động lớn nhất thế giới."],
  ["Cố đô Huế", "co-do-hue", "Huế", "Miền Trung", 16.4637, 107.5909, "van-hoa", 250000, 4.6, "Đại Nội, lăng tẩm và ẩm thực cung đình."],
  ["Phố cổ Hội An", "hoi-an", "Quảng Nam", "Miền Trung", 15.8801, 108.338, "van-hoa", 400000, 4.9, "Đèn lồng, nhà cổ và ẩm thực nổi tiếng."],
  ["Bà Nà Hills", "ba-na-hills", "Đà Nẵng", "Miền Trung", 15.9977, 107.9882, "nui-thien-nhien", 900000, 4.5, "Cầu Vàng và khu vui chơi trên núi."],
  ["Biển Mỹ Khê", "my-khe", "Đà Nẵng", "Miền Trung", 16.0544, 108.2472, "bien", 300000, 4.6, "Bãi biển đẹp bậc nhất Đà Nẵng."],
  ["Nha Trang", "nha-trang", "Khánh Hoà", "Miền Trung", 12.2388, 109.1967, "bien", 500000, 4.5, "Biển xanh, lặn ngắm san hô, đảo Hòn Mun."],
  ["Đà Lạt", "da-lat", "Lâm Đồng", "Tây Nguyên", 11.9404, 108.4583, "nui-thien-nhien", 450000, 4.7, "Thành phố ngàn hoa khí hậu mát mẻ quanh năm."],
  ["Buôn Ma Thuột", "buon-ma-thuot", "Đắk Lắk", "Tây Nguyên", 12.6667, 108.0383, "am-thuc", 300000, 4.3, "Thủ phủ cà phê Việt Nam."],
  ["TP. Hồ Chí Minh", "tp-hcm", "TP. Hồ Chí Minh", "Miền Nam", 10.7769, 106.7009, "thanh-pho", 500000, 4.5, "Đô thị sôi động, ẩm thực và đời sống về đêm."],
  ["Đảo Phú Quốc", "phu-quoc", "Kiên Giang", "Miền Nam", 10.2899, 103.984, "bien", 800000, 4.7, "Đảo ngọc với bãi Sao, Vinpearl và chợ đêm."],
  ["Cần Thơ - Chợ nổi Cái Răng", "can-tho", "Cần Thơ", "Miền Nam", 10.0452, 105.7469, "am-thuc", 250000, 4.4, "Miệt vườn và chợ nổi sông nước miền Tây."],
  ["Côn Đảo", "con-dao", "Bà Rịa - Vũng Tàu", "Miền Nam", 8.6934, 106.6092, "bien", 700000, 4.6, "Đảo yên bình với di tích lịch sử và biển hoang sơ."],
] as const;

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  for (const [name, slug, city, region, lat, lng, cat, avgCost, rating, description] of places) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: cat } });
    await prisma.destination.upsert({
      where: { slug },
      update: { searchText: normalize(`${name} ${city}`) },
      create: { searchText: normalize(`${name} ${city}`), name, slug, city, region, lat, lng, avgCost, rating, description, categoryId: category.id },
    });
  }
  await prisma.user.upsert({
    where: { email: "admin@tripmate.local" },
    update: {},
    create: { email: "admin@tripmate.local", name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash("admin12345", 10) },
  });
  console.log("Seeded.");
}

main().finally(() => prisma.$disconnect());
