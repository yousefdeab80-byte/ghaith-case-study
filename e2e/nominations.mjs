import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const S = process.argv[2];
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("dialog", (d) => d.accept());
await p.goto(B + "/login");
await p.fill("#username", "admin"); await p.fill("#password", "Ghaith@2026");
await Promise.all([p.waitForURL(B + "/"), p.click("button")]);

// ترشيح حالة من ملفها
await p.goto(B + "/cases?sort=priority", { waitUntil: "networkidle" });
await p.locator("tbody tr a").first().click();
await p.waitForURL(/\/cases\/[0-9a-f-]{36}$/);
const caseUrl = p.url();
await p.locator("button:has-text('ترشيح')").first().click();
await p.waitForSelector("button:has-text('مرشحة ✓')");

// كشف جديد
await p.goto(B + "/nominations?new=1", { waitUntil: "networkidle" });
const projectId = await p.locator("select[name=projectId] option").nth(1).getAttribute("value");
await p.selectOption("select[name=projectId]", projectId);
await p.fill("input[name=title]", "قافلة 1 – تجربة");
await p.fill("input[name=targetCount]", "5");
await p.click("button:has-text('إنشاء الكشف')");
await p.waitForURL(/\/nominations\/[0-9a-f-]{36}$/);
const sheetUrl = p.url();

// إضافة حالات (كل الحالات)
await p.goto(sheetUrl + "?tab=add&show=", { waitUntil: "networkidle" });
await p.screenshot({ path: S + "/shots/sheet_add.png", fullPage: true });
const n = await p.locator("tbody tr input[type=checkbox]").count();
for (let i = 0; i < Math.min(n, 4); i++) await p.locator("tbody tr input[type=checkbox]").nth(i).check();
await p.click("button:has-text('إضافة المحدد')");
await p.waitForSelector("text=اتضاف");
await p.goto(sheetUrl, { waitUntil: "networkidle" });
await p.screenshot({ path: S + "/shots/sheet_cases.png", fullPage: true });
console.log("summary:", (await p.locator(".card").nth(1).innerText()).replace(/\s+/g, " "));

// ملاحظة
await p.locator("tbody input.input").first().fill("بيت آخر الشارع");
await p.locator("tbody input.input").first().blur();
await p.waitForTimeout(800);

// الإيميل
await p.goto(sheetUrl + "?tab=email", { waitUntil: "networkidle" });
await p.locator("textarea").first().fill("relief@ghaithfoundation.org, exec@ghaithfoundation.org");
await p.screenshot({ path: S + "/shots/sheet_email.png", fullPage: true });
const xl = await p.request.get(B + "/api/export/sheet?id=" + sheetUrl.split("/").pop());
console.log("excel:", xl.status(), xl.headers()["content-type"], (await xl.body()).length);
await p.check("text=بأكد إن الإيميل اتبعت");
await p.click("button:has-text('تسجيل الإرسال وقفل الكشف')");
await p.waitForURL(/tab=log/, { timeout: 20000 });
await p.waitForSelector("text=اتبعت من Outlook");
await p.screenshot({ path: S + "/shots/sheet_log.png", fullPage: true });

// الكشف مقفول، والحالة بتظهر إنها في كشف
await p.goto(sheetUrl, { waitUntil: "networkidle" });
console.log("frozen:", await p.locator("button:has-text('حذف الكشف')").count() === 0, await p.locator("text=اتبعت للإدارات").count() > 0);
await p.goto(caseUrl, { waitUntil: "networkidle" });
console.log("case shows sheet:", await p.locator("text=في كشف").count());
await p.goto(B + "/nominations", { waitUntil: "networkidle" });
await p.screenshot({ path: S + "/shots/nominations.png", fullPage: true });
await p.goto(B + "/settings?tab=email", { waitUntil: "networkidle" });
await p.screenshot({ path: S + "/shots/settings_email.png", fullPage: true });
console.log("errors:", errors);
await b.close();
