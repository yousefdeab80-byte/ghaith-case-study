import { execSync } from "node:child_process";

// نسخ الـ Preview بتشاور على نفس قاعدة البيانات، فالـ migrate والـ seed بيشتغلوا مع نشر الـ Production بس
// عشان نشرين في نفس الوقت ميشتغلوش على القاعدة مع بعض.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`skipping migrate/seed on ${process.env.VERCEL_ENV} deploy`);
} else {
  execSync("npm run db:migrate && npm run db:seed", { stdio: "inherit" });
}
