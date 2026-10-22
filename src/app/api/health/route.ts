import postgres from "postgres";
import { count, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);

/** فحص الاتصال بقاعدة البيانات خطوة بخطوة. مبيرجعش أي بيانات سرية. */
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  const out: Record<string, unknown> = { region: process.env.VERCEL_REGION ?? null, hasDbUrl: !!raw, hasSecret: !!process.env.SESSION_SECRET };
  try {
    const u = new URL(raw);
    out.db = { host: u.hostname, port: u.port, user: u.username, database: u.pathname };
  } catch (e) {
    out.urlError = (e as Error).message;
  }
  const sql = postgres(raw, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 5 });
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try { out[name] = { ok: true, ms: Date.now() - t, value: await withTimeout(fn(), 10000) }; (out[name] as { ms: number }).ms = Date.now() - t; }
    catch (e) { out[name] = { ok: false, ms: Date.now() - t, error: (e as Error).message }; }
  };
  await step("select1", () => sql`select 1 as one`.then((r) => r[0].one));
  await step("timeouts", () => sql`select current_setting('statement_timeout') as st, current_setting('lock_timeout') as lt`.then((r) => r[0]));
  await step("users", () => sql`select count(*)::int as n from users`.then((r) => r[0].n));
  await step("userById", () => sql`select id from users where id = ${"00000000-0000-0000-0000-000000000000"}`.then((r) => r.length));
  await sql.end({ timeout: 2 }).catch(() => {});
  // نفس الاستعلامات مع بعض على كلاينت جديد من غير pipelining، عشان نفرّق بين مشكلة الاتصال ومشكلة الكلاينت
  const par = postgres(raw, { prepare: false, max: 3, connect_timeout: 10, idle_timeout: 5, ...({ max_pipeline: 1 } as object) });
  await step("rawParallel", () => Promise.all([1, 2, 3, 4, 5, 6].map((i) => par`select ${i}::int as i, count(*)::int as n from users`)).then((r) => r.length));
  await par.end({ timeout: 2 }).catch(() => {});
  // نفس الكلاينت ونفس الاستعلامات اللي السستم بيستخدمها
  await step("appUsers", () => db.select({ id: schema.users.id }).from(schema.users).limit(1).then((r) => r.length));
  // كل استعلام لوحده بالترتيب، عشان لو واحد بس اللي بيعلّق نعرفه
  for (const [name, q] of [
    ["cases", () => db.select({ n: count() }).from(schema.cases)],
    ["benefits", () => db.select({ n: count() }).from(schema.benefits)],
    ["auditLog", () => db.select({ n: count() }).from(schema.auditLog)],
  ] as const) await step(`app_${name}`, () => q().then((r) => r[0]?.n));
  await step("appParallel", () => Promise.all([
    db.select({ n: count() }).from(schema.cases),
    db.select({ n: count() }).from(schema.benefits),
    db.select({ n: count() }).from(schema.projects),
    db.select({ n: count() }).from(schema.settings),
    db.select({ n: count() }).from(schema.nominations),
    db.select({ n: count() }).from(schema.sheets),
    db.select({ k: dsql<string>`extract(year from ${schema.benefits.benefitDate})::text` }).from(schema.benefits).groupBy(dsql`1`),
    db.select({ n: count() }).from(schema.auditLog),
  ]).then((r) => r.map((x) => x.length)));
  return Response.json(out);
}
