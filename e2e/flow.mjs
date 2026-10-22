import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("dialog", (d) => { errors.push("dialog: " + d.message()); d.accept(); });
await p.goto("http://localhost:3000/login");
await p.fill("#username", "admin"); await p.fill("#password", "Ghaith@2026");
await Promise.all([p.waitForURL("http://localhost:3000/"), p.click("button")]);

// import cases
await p.goto("http://localhost:3000/import", { waitUntil: "networkidle" });
await p.setInputFiles('input[type=file]', S + "/legacy.xlsx");
await p.waitForSelector("text=ربط الأعمدة");
await p.screenshot({ path: S + "/shots/import_map.png", fullPage: true });
await p.click("text=3. مراجعة قبل الاستيراد");
await p.waitForSelector("text=مراجعة قبل الحفظ");
console.log("preview:", (await p.locator(".card").last().innerText()).replace(/\s+/g, " ").slice(0, 400));
await p.click("text=تأكيد الاستيراد");
await p.waitForSelector("text=تم الاستيراد", { timeout: 30000 });
console.log("result:", (await p.locator(".card.border-good").innerText()).replace(/\s+/g, " "));

// import benefits
await p.goto("http://localhost:3000/import", { waitUntil: "networkidle" });
await p.selectOption("select >> nth=0", "benefits");
await p.setInputFiles('input[type=file]', S + "/aids.xlsx");
await p.click("text=3. مراجعة قبل الاستيراد");
await p.click("text=تأكيد الاستيراد");
await p.waitForSelector("text=تم الاستيراد", { timeout: 30000 });
console.log("benefits:", (await p.locator(".card.border-good").innerText()).replace(/\s+/g, " "));

// wizard create
await p.goto("http://localhost:3000/cases/new?form=general", { waitUntil: "networkidle" });
await p.locator("label:has-text('اسم الزوج') + input").first().fill("حالة تجريبية من الويزارد");
await p.locator("label:has-text('الرقم القومي') + input").first().fill("28501012101993");
await p.locator("label:has-text('الرقم القومي') + input").first().blur();
await p.waitForTimeout(800);
await p.screenshot({ path: S + "/shots/wizard.png", fullPage: true });
await p.click("text=حفظ والإكمال لاحقاً");
await p.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 20000 }).catch(async (e) => { console.log("url:", p.url(), await p.locator(".text-danger").allInnerTexts()); throw e; });
console.log("created:", p.url());
await p.screenshot({ path: S + "/shots/created.png", fullPage: true });

for (const path of ["/", "/cases", "/benefits", "/settings?tab=projects", "/settings?tab=users"]) {
  await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
  await p.screenshot({ path: S + "/shots/" + (path.replace(/[^\w]+/g, "_") || "root") + ".png", fullPage: true });
}
console.log("errors:", errors);
await b.close();
