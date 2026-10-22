import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/ghaith";

/**
 * كلاينت واحد بس لكل نسخة شغالة من السيرفر، حتى لو الكود اتجمّع في أكتر من chunk.
 * بنستخدم الـ transaction pooler بتاع Supabase (بورت 6543)، وده ليه شرطين:
 * - prepare: false لأنه مبيدعمش prepared statements.
 * - max_pipeline: 1 لأن الاستعلامات المتبعتة ورا بعض على نفس الاتصال (pipelining)
 *   بتعلّق عليه، فكل اتصال بيبعت استعلام واحد ويستنى نتيجته.
 */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = (globalForDb.pg ??= postgres(url, {
  prepare: false,
  // موجودة في postgres.js بس مش في الـ types بتاعته
  ...({ max_pipeline: 1 } as object),
  max: 3,
  idle_timeout: 10,
  max_lifetime: 60 * 5,
  connect_timeout: 15,
}));

export const db = drizzle(client, { schema });
export { schema };
