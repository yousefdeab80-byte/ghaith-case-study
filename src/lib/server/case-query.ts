import "server-only";
import { and, eq, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeDigits } from "@/lib/nid";

export type CaseSearch = { q?: string; status?: string; gov?: string; priority?: string; incomplete?: string; project?: string; sort?: string; page?: string };

export function caseFilters(sp: CaseSearch): SQL | undefined {
  const c = schema.cases;
  const where: SQL[] = [];
  const q = sp.q?.trim();
  if (q) {
    const digits = normalizeDigits(q);
    const parts = [ilike(c.headName, `%${q}%`), ilike(c.wifeName, `%${q}%`), ilike(c.village, `%${q}%`)];
    if (digits) parts.push(ilike(c.headNid, `%${digits}%`), ilike(c.wifeNid, `%${digits}%`), ilike(c.phone, `%${digits}%`));
    if (/^\d+$/.test(digits) && digits.length < 8) parts.push(eq(c.fileNo, Number(digits)));
    where.push(or(...parts)!);
  }
  if (sp.status) where.push(eq(c.status, sp.status));
  if (sp.gov) where.push(eq(c.governorate, sp.gov));
  if (sp.priority) where.push(eq(c.priorityLevel, sp.priority));
  if (sp.incomplete === "1") where.push(lt(c.completeness, 100));
  if (sp.project) {
    where.push(inArray(c.id, db.select({ id: schema.nominations.caseId }).from(schema.nominations).where(eq(schema.nominations.projectId, sp.project))));
  }
  return where.length ? and(...where) : undefined;
}

