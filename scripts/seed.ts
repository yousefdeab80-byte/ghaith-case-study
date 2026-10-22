/**
 * تجهيز قاعدة بيانات جديدة: المشروعات الافتراضية، القوائم، وحساب المدير.
 * التشغيل: npm run db:seed            (آمن يتشغل أكتر من مرة)
 *          npm run db:seed -- --demo  (يضيف حالات تجريبية)
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { DEFAULT_LOOKUPS, DEFAULT_PERMISSIONS, DEFAULT_PROJECTS } from "../src/lib/constants";
import { toCaseRow } from "../src/lib/case-record";

async function main() {
  const client = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/ghaith", { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Ghaith@2026";
  await db.insert(schema.users).values({
    username: "admin", name: "مدير قطاع دراسة الحالة", role: "manager",
    passwordHash: await bcrypt.hash(adminPassword, 10), permissions: DEFAULT_PERMISSIONS.manager,
  }).onConflictDoNothing();

  await db.insert(schema.settings).values([
    { key: "lookups", value: Object.fromEntries(Object.entries(DEFAULT_LOOKUPS).map(([k, v]) => [k, v.values])) },
    { key: "nominationEmail", value: "abdallh.mohamed@ghaithfoundation.org" },
    { key: "distributionList", value: [] },
  ]).onConflictDoNothing();

  await db.insert(schema.projects).values(DEFAULT_PROJECTS.map((p, i) => ({
    name: p.name, sector: p.sector, rulesKey: p.rulesKey, minDaysBetweenBenefits: p.minDaysBetweenBenefits ?? null,
    requiredDocs: p.requiredDocs ?? [], feedbackQuestions: p.feedbackQuestions, sampleRatio: p.sampleRatio ?? "0.30",
    impactAfterDays: p.impactAfterDays ?? null, sortOrder: i,
  }))).onConflictDoNothing();

  if (process.argv.includes("--demo")) {
    const demo = [
      { headName: "محمد عبد الرازق سيد", headNid: "28801151203451", wifeName: "فاطمة أحمد علي", phone: "01012345678", maritalStatus: "متزوجة",
        governorate: "الجيزة", markaz: "أطفيح", village: "الصف", familySize: 6, childrenCount: 4, incomeType: "يوميات", totalIncome: 1890,
        totalExpenses: 2200, roofType: "بوص", roofNeed: "نعم تستدعي", healthStatus: "أمراض مزمنة", explorerName: "سارة فتحي", guideName: "حسن السيد",
        guideApproved: "نعم", explorerApproved: "نعم", permanentResidence: "نعم", propertyDispute: "لا", recommendations: ["سقف", "شنط مدرسية"] },
      { headName: "مروة السيد عبد الله", headNid: "29305151203982", phone: "01234567891", maritalStatus: "أرملة", governorate: "الفيوم",
        markaz: "إطسا", village: "قصر الباسل", familySize: 4, incomeType: "لا يوجد", totalIncome: 300, totalExpenses: 1400, roofType: "خشب متهالك",
        healthStatus: "إعاقة", operationType: "عملية مياه بيضاء", explorerName: "سارة فتحي", guideApproved: "نعم", explorerApproved: "نعم" },
      { headName: "سيد عبد الحميد طه", phone: "01555512345", maritalStatus: "متزوجة", governorate: "بني سويف", village: "عرب بني صالح",
        familySize: 3, incomeType: "موظف", totalIncome: 4000, totalExpenses: 2500, roofType: "خرسانة" },
    ];
    for (const d of demo) await db.insert(schema.cases).values({ ...toCaseRow(d, d.operationType ? "shifa" : "general"), source: "demo" }).onConflictDoNothing();
  }

  await client.end();
  console.log(`seed done. admin / ${adminPassword}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
