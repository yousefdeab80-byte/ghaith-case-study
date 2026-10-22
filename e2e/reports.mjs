// Usage: node e2e/reports.mjs <outDir>
// يربط المساعدات القديمة بسجل الحالات، ويصور التقريرين ويتأكد إن ملفات الإكسل بتنزل.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const [out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://localhost:3000/login");
await p.fill("#username", "admin"); await p.fill("#password", "Ghaith@2026");
await Promise.all([p.waitForURL("http://localhost:3000/"), p.click("button")]);

await p.goto("http://localhost:3000/benefits");
const link = p.getByRole("button", { name: "ضيفهم لسجل الحالات" });
if (await link.count()) {
  await link.click();
  await p.getByText(/^تم: اتربط/).waitFor({ timeout: 60000 });
  console.log("link:", await p.getByText(/^تم: اتربط/).textContent());
  console.log("button gone:", (await link.count()) === 0);
}
await p.screenshot({ path: `${out}/benefits.png` });

for (const [path, name] of [["/reports", "report-cases"], ["/reports/achievements", "report-achievements"], ["/reports/achievements?year=2026&project=دفء", "report-achievements-filtered"], ["/", "dashboard"]]) {
  await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(path, "->", await p.locator("h1").first().textContent());
}
await p.emulateMedia({ media: "print" });
await p.goto("http://localhost:3000/reports/achievements", { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/print-achievements.png`, fullPage: true });
await p.emulateMedia({ media: "screen" });

for (const kind of ["report-cases", "report-achievements"]) {
  const res = await p.request.get(`http://localhost:3000/api/export/${kind}`);
  console.log(kind, res.status(), res.headers()["content-type"], (await res.body()).length, "bytes");
}
console.log("errors:", errors.slice(0, 10));
await b.close();
