import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const client = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/ghaith", { max: 1, prepare: false });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("migrations applied");
}

main().catch((e) => { console.error(e); process.exit(1); });
