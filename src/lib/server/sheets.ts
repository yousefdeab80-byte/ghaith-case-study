import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Case, Project, Sheet } from "@/db/schema";
import { toValues } from "@/lib/case-record";
import { evaluateEligibility, type Eligibility } from "@/lib/eligibility";
import { normalizeDigits } from "@/lib/nid";
import { getSetting } from "./data";
import { DEFAULT_EMAIL_TEMPLATE, type EmailTemplate } from "@/lib/nomination";

type Verdict = Eligibility["verdict"];

export const getEmailTemplate = () => getSetting<EmailTemplate>("nominationTemplate", DEFAULT_EMAIL_TEMPLATE);

export async function getSheet(id: string) {
  const [row] = await db.select({ sheet: schema.sheets, project: schema.projects })
    .from(schema.sheets).innerJoin(schema.projects, eq(schema.projects.id, schema.sheets.projectId))
    .where(eq(schema.sheets.id, id));
  return row ?? null;
}

/** حالات الكشف بترتيب الإضافة. */
export async function getSheetCases(sheetId: string) {
  return db.select({ nomination: schema.nominations, c: schema.cases })
    .from(schema.nominations).innerJoin(schema.cases, eq(schema.cases.id, schema.nominations.caseId))
    .where(eq(schema.nominations.sheetId, sheetId))
    .orderBy(asc(schema.cases.governorate), asc(schema.cases.markaz), asc(schema.cases.village), asc(schema.nominations.createdAt));
}

/** آخر استفادة من نفس المشروع لكل حالة (بالملف أو بالرقم القومي). */
export async function lastBenefits(cases: Pick<Case, "id" | "headNid" | "wifeNid">[], project: Project): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!cases.length) return out;
  const ids = cases.map((c) => c.id);
  const nids = cases.flatMap((c) => [c.headNid, c.wifeNid]).filter(Boolean) as string[];
  const rows = await db.select({ caseId: schema.benefits.caseId, nid: schema.benefits.nid, date: schema.benefits.benefitDate })
    .from(schema.benefits)
    .where(and(
      or(eq(schema.benefits.projectId, project.id), eq(schema.benefits.projectName, project.name)),
      or(inArray(schema.benefits.caseId, ids), ...(nids.length ? [inArray(schema.benefits.nid, nids)] : [])),
    ));
  for (const c of cases) {
    const mine = rows.filter((r) => r.date && (r.caseId === c.id || (r.nid && (r.nid === c.headNid || r.nid === c.wifeNid))));
    const last = mine.map((r) => r.date!).sort().at(-1);
    if (last) out.set(c.id, last);
  }
  return out;
}

export type Candidate = {
  c: Case;
  verdict: Verdict;
  failed: string[];
  lastBenefit: string | null;
  inPool: boolean;
  /** عنوان كشف تاني مفتوح لنفس المشروع الحالة فيه */
  otherSheet: string | null;
};

export type CandidateSearch = { q?: string; gov?: string; markaz?: string; priority?: string; show?: string };

/**
 * الحالات اللي ممكن تتضاف للكشف: مش مستبعدة، ومش جوه الكشف ده.
 * مرتبة: المرشحة من ملفها الأول، بعدين بالأولوية (المراحل الخمسة).
 */
export async function findCandidates(sheet: Sheet, project: Project, sp: CandidateSearch, limit = 200): Promise<{ list: Candidate[]; total: number }> {
  const c = schema.cases;
  const inThisSheet = db.select({ id: schema.nominations.caseId }).from(schema.nominations).where(eq(schema.nominations.sheetId, sheet.id));
  const where: SQL[] = [ne(c.status, "excluded"), notInArray(c.id, inThisSheet)];
  const q = sp.q?.trim();
  if (q) {
    const digits = normalizeDigits(q);
    const parts = [ilike(c.headName, `%${q}%`), ilike(c.village, `%${q}%`)];
    if (digits) parts.push(ilike(c.headNid, `%${digits}%`), ilike(c.phone, `%${digits}%`));
    if (/^\d+$/.test(digits) && digits.length < 8) parts.push(eq(c.fileNo, Number(digits)));
    where.push(or(...parts)!);
  }
  const gov = sp.gov ?? sheet.governorate ?? "";
  if (gov) where.push(eq(c.governorate, gov));
  if (sp.markaz) where.push(eq(c.markaz, sp.markaz));
  if (sp.priority) where.push(eq(c.priorityLevel, sp.priority));

  const pool = db.select({ id: schema.nominations.caseId }).from(schema.nominations)
    .where(and(eq(schema.nominations.projectId, project.id), isNull(schema.nominations.sheetId)));
  if (sp.show === "pool") where.push(inArray(c.id, pool));

  const rows = await db.select().from(c).where(and(...where)).orderBy(desc(c.priorityScore), asc(c.fileNo)).limit(1500);
  const ids = rows.map((r) => r.id);
  const [poolRows, otherRows, benefits] = await Promise.all([
    ids.length ? db.select({ id: schema.nominations.caseId }).from(schema.nominations)
      .where(and(eq(schema.nominations.projectId, project.id), isNull(schema.nominations.sheetId), inArray(schema.nominations.caseId, ids))) : [],
    ids.length ? db.select({ id: schema.nominations.caseId, title: schema.sheets.title }).from(schema.nominations)
      .innerJoin(schema.sheets, eq(schema.sheets.id, schema.nominations.sheetId))
      .where(and(eq(schema.sheets.projectId, project.id), ne(schema.sheets.id, sheet.id), ne(schema.sheets.status, "closed"), inArray(schema.nominations.caseId, ids))) : [],
    lastBenefits(rows, project),
  ]);
  const poolSet = new Set(poolRows.map((r) => r.id));
  const other = new Map(otherRows.map((r) => [r.id, r.title]));

  const today = sheet.plannedDate ? new Date(sheet.plannedDate) : new Date();
  let list: Candidate[] = rows.map((row) => {
    const lastBenefit = benefits.get(row.id) ?? null;
    const e = evaluateEligibility(project.rulesKey, toValues(row), { lastBenefitDate: lastBenefit, minDaysBetweenBenefits: project.minDaysBetweenBenefits, today });
    return {
      c: row, verdict: e.verdict, failed: e.checks.filter((ch) => ch.status === "fail").map((ch) => ch.label),
      lastBenefit, inPool: poolSet.has(row.id), otherSheet: other.get(row.id) ?? null,
    };
  });
  const show = sp.show ?? "eligible";
  if (show === "eligible") list = list.filter((x) => x.verdict === "eligible" || x.inPool);
  if (show === "incomplete") list = list.filter((x) => x.verdict !== "not_eligible");
  list.sort((a, b) => Number(b.inPool) - Number(a.inPool));
  return { list: list.slice(0, limit), total: list.length };
}
