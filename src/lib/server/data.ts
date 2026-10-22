import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_LOOKUPS } from "@/lib/constants";

export type Lookups = Record<string, string[]>;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({
    target: schema.settings.key, set: { value, updatedAt: new Date() },
  });
}

export async function getLookups(): Promise<Lookups> {
  const saved = await getSetting<Lookups>("lookups", {});
  return Object.fromEntries(Object.entries(DEFAULT_LOOKUPS).map(([k, v]) => [k, saved[k]?.length ? saved[k] : v.values]));
}

export async function getProjects(activeOnly = false) {
  const rows = await db.select().from(schema.projects).orderBy(asc(schema.projects.sortOrder), asc(schema.projects.name));
  return activeOnly ? rows.filter((p) => p.active) : rows;
}
