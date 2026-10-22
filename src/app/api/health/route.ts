import postgres from "postgres";

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
  return Response.json(out);
}
