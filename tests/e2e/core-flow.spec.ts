import { expect, test, type Page } from "@playwright/test";

const uniqueEmail = () => `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(page: Page) {
  await page.goto("/register");
  await page.getByRole("textbox").first().fill("E2E User");
  await page.locator("input[type=email]").fill(uniqueEmail());
  await page.locator("input[type=password]").fill("password123");
  await page.getByRole("button", { name: "Đăng ký" }).last().click();
  await page.waitForURL("**/trips");
}

test("anonymous users are redirected from protected pages", async ({ page }) => {
  await page.goto("/trips");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrips/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("regular users cannot open /admin", async ({ page }) => {
  await register(page);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});

test("destinations: accent-insensitive search", async ({ page }) => {
  await page.goto("/destinations?q=da+lat");
  await expect(page.getByRole("heading", { name: "Đà Lạt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vịnh Hạ Long" })).toHaveCount(0);
});

test("plan a trip: add places, drag between days, track budget, share", async ({ page, browser }) => {
  await register(page);

  // create trip
  await page.getByPlaceholder("Đà Nẵng - Hội An 4 ngày").fill("E2E trip");
  const dates = page.locator("input[type=date]");
  await dates.nth(0).fill("2026-12-01");
  await dates.nth(1).fill("2026-12-03");
  await page.getByRole("button", { name: "Tạo chuyến đi" }).click();
  await page.waitForURL(/\/trips\/\w+$/);

  // add two places via search
  for (const q of ["hoi an", "my khe"]) {
    await page.getByPlaceholder("Tìm địa điểm để thêm…").fill(q);
    await page.getByRole("button", { name: "+ Thêm" }).first().click();
  }
  const day1 = page.locator("section", { has: page.getByRole("heading", { name: "Ngày 1" }) });
  const day2 = page.locator("section", { has: page.getByRole("heading", { name: "Ngày 2" }) });
  await expect(day1.locator("li .font-medium")).toHaveText(["Phố cổ Hội An", "Biển Mỹ Khê"]);

  // vote and discuss a place; both persist across reload
  const firstRow = day1.locator("li").first();
  await firstRow.getByRole("button", { name: "Muốn đi" }).click();
  await expect(firstRow.getByRole("button", { name: "Muốn đi" })).toHaveText("👍 1");
  await firstRow.getByRole("button", { name: "Bình luận" }).click();
  await firstRow.getByPlaceholder("Viết bình luận…").fill("Nên đi buổi sáng");
  await firstRow.getByRole("button", { name: "Gửi" }).click();
  await expect(firstRow.getByText("Nên đi buổi sáng")).toBeVisible();
  await page.reload();
  await expect(day1.locator("li").first().getByRole("button", { name: "Muốn đi" })).toHaveText("👍 1");
  await expect(day1.locator("li").first().getByRole("button", { name: "Bình luận" })).toHaveText("💬 1");

  // drag first item into day 2 and verify it persists across reload
  const handle = day1.getByRole("button", { name: "Kéo để sắp xếp" }).first();
  const from = (await handle.boundingBox())!;
  const to = (await day2.getByRole("heading").boundingBox())!;
  await page.mouse.move(from.x + 5, from.y + 5);
  await page.mouse.down();
  await page.mouse.move(from.x + 25, from.y + 25, { steps: 5 });
  await page.mouse.move(to.x + 40, to.y + 30, { steps: 15 });
  await page.mouse.up();
  await expect(day2.locator("li .font-medium")).toHaveText(["Phố cổ Hội An"]);
  await page.reload();
  await expect(day2.locator("li .font-medium")).toHaveText(["Phố cổ Hội An"]);
  await expect(day1.locator("li .font-medium")).toHaveText(["Biển Mỹ Khê"]);

  // budget: set budget and add an expense, remaining updates
  await page.getByRole("button", { name: "Ngân sách", exact: true }).click();
  await page.locator("input[type=number]").first().fill("5000000");
  await page.locator("input[type=number]").first().blur();
  await page.locator("form input:not([type])").first().fill("Vé máy bay");
  await page.locator("form input[type=number]").nth(0).fill("2000000");
  await page.locator("form input[type=number]").nth(1).fill("2200000");
  await page.getByRole("button", { name: "Thêm khoản chi" }).click();
  await expect(page.getByRole("cell", { name: "Vé máy bay" })).toBeVisible();
  await expect(page.getByText("2.800.000₫")).toBeVisible(); // 5,000,000 - max(planned, actual)

  // share link is readable by an anonymous visitor
  await page.getByRole("button", { name: "Lịch trình" }).click();
  await page.getByRole("button", { name: "Tạo link chia sẻ" }).click();
  const url = await page.locator("input[readonly]").inputValue();
  const anon = await browser.newContext();
  const pub = await anon.newPage();
  await pub.goto(url);
  await expect(pub.getByRole("heading", { name: "E2E trip" })).toBeVisible();
  await expect(pub.getByText("Phố cổ Hội An")).toBeVisible();
  await expect(pub.getByText("Vé máy bay")).toHaveCount(0); // expenses never shared
  await anon.close();
});
