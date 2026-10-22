import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/ghaith";

/**
 * كلاينت واحد بس لكل نسخة شغالة من السيرفر، حتى لو الكود اتجمّع في أكتر من chunk.
 * عدد الاتصالات قليل وبتتقفل بسرعة لو فاضية، لأن Supabase المجاني حده 15 اتصال في session mode.
 * prepare: false عشان الـ transaction pooler مبيدعمش prepared statements.
 */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = (globalForDb.pg ??= postgres(url, {
  prepare: false,
  max: 3,
  idle_timeout: 10,
  max_lifetime: 60 * 5,
  connect_timeout: 15,
}));

export const db = drizzle(client, { schema });
export { schema };
