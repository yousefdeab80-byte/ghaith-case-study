// Usage: node e2e/smoke.mjs <outDir> [paths...]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const [out, ...paths] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://localhost:3000/login");
await p.fill("#username", "admin"); await p.fill("#password", "Ghaith@2026");
await Promise.all([p.waitForURL("http://localhost:3000/"), p.click("button")]);
for (const path of paths) {
  await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
  const name = path.replace(/[^\w]+/g, "_") || "root";
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(path, "->", p.url(), (await p.title()));
}
console.log("errors:", errors.slice(0, 10));
await b.close();
