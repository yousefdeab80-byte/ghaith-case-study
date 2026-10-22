"use server";

import { eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { normalizeValues, toCaseRow, toValues, type CaseValues } from "@/lib/case-record";
import { mergeMissing, parseDate, resolveProjectName, type RowIssue } from "@/lib/import";
import { DEFAULT_PROJECTS } from "@/lib/constants";
import { normalizeDigits, normalizePhone } from "@/lib/nid";
import { ensureCases, personKey } from "@/lib/server/case-sync";

/** أي أرقام قومية من دول متسجلة بالفعل. */
export async function existingNids(nids: string[]): Promise<string[]> {
  await requireUser("import");
  const clean = [...new Set(nids.map(normalizeDigits).filter((n) => n.length === 14))];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += 5000) {
    const chunk = clean.slice(i, i + 5000);
    const rows = await db.select({ h: schema.cases.headNid, w: schema.cases.wifeNid }).from(schema.cases)
      .where(or(inArray(schema.cases.headNid, chunk), inArray(schema.cases.wifeNid, chunk)));
    for (const r of rows) { if (r.h) out.push(r.h); if (r.w) out.push(r.w); }
  }
  return [...new Set(out)];
}

export async function startBatch(kind: "cases" | "benefits", fileName: string, totalRows: number): Promise<string> {
  const user = await requireUser("import");
  const [b] = await db.insert(schema.importBatches).values({ kind, fileName, totalRows, createdBy: user.id }).returning({ id: schema.importBatches.id });
  return b.id;
}

async function bump(batchId: string, d: { created?: number; merged?: number; skipped?: number; issues?: RowIssue[] }) {
  const [b] = await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId));
  if (!b) return;
  await db.update(schema.importBatches).set({
    created: b.created + (d.created ?? 0), merged: b.merged + (d.merged ?? 0), skipped: b.skipped + (d.skipped ?? 0),
    issues: [...b.issues, ...(d.issues ?? [])].slice(0, 2000),
  }).where(eq(schema.importBatches.id, batchId));
}

/** يسجل دفعة من الحالات: الجديد يتضاف، واللي رقمه القومي موجود تتكمل الحقول الناقصة فيه بس. */
export async function importCasesChunk(batchId: string, formType: string, chunk: { row: number; values: CaseValues }[]) {
  const user = await requireUser("import");
  const nids = chunk.map((c) => String(c.values.headNid ?? "")).filter(Boolean);
  const existing = nids.length
    ? await db.select().from(schema.cases).where(inArray(schema.cases.headNid, nids))
    : [];
  const byNid = new Map(existing.map((c) => [c.headNid!, c]));
  let created = 0, merged = 0;
  await db.transaction(async (tx) => {
    const inserts = [];
    for (const { values } of chunk) {
      const v = normalizeValues(values);
      const hit = v.headNid ? byNid.get(String(v.headNid)) : undefined;
      if (hit) {
        const next = mergeMissing(normalizeValues(toValues(hit)), v);
        await tx.update(schema.cases).set({ ...toCaseRow(next, hit.formType), updatedBy: user.id, updatedAt: new Date() }).where(eq(schema.cases.id, hit.id));
        merged++;
      } else {
        inserts.push({ ...toCaseRow(v, formType), source: "import", importBatchId: batchId, createdBy: user.id, updatedBy: user.id });
      }
    }
    if (inserts.length) await tx.insert(schema.cases).values(inserts).onConflictDoNothing();
    created = inserts.length;
  });
  await bump(batchId, { created, merged });
  return { created, merged };
}

/**
 * يسجل دفعة من سجل المساعدات المنفذة. كل مستفيد لازم يبقى له ملف في سجل الحالات:
 * لو موجود (بالرقم القومي أو الاسم + التليفون) بيتربط بيه، ولو مش موجود بيتفتح له ملف جديد.
 */
export async function importBenefitsChunk(batchId: string, chunk: { row: number; values: Record<string, unknown> }[]) {
  const user = await requireUser("import");
  const projects = await db.select().from(schema.projects);
  const known = projects.map((p) => ({ name: p.name, aliases: DEFAULT_PROJECTS.find((d) => d.name === p.name)?.aliases }));
  const projectId = new Map(projects.map((p) => [p.name, p.id]));

  const issues: RowIssue[] = [];
  const rows = [];
  let skipped = 0;
  for (const { row, values } of chunk) {
    const name = String(values.name ?? "").trim();
    const project = String(values.projectName ?? "").trim();
    if (!name && !values.nid) { skipped++; continue; }
    if (!project) { issues.push({ row, message: "الصف من غير مشروع، اتسجل كـ\"غير محدد\"" }); }
    const resolved = project ? resolveProjectName(project, known) : "غير محدد";
    if (project && !projectId.has(resolved)) issues.push({ row, message: `المشروع "${project}" مش في قائمة المشروعات` });
    const nid = normalizeDigits(values.nid) || null;
    const qty = parseInt(normalizeDigits(values.quantity), 10);
    rows.push({
      name: name || "بدون اسم", nid, phone: normalizePhone(values.phone) || null,
      projectName: resolved, projectId: projectId.get(resolved) ?? null,
      convoy: values.convoy ? String(values.convoy) : null, governorate: values.governorate ? String(values.governorate) : null,
      village: values.village ? String(values.village) : null, benefitDate: parseDate(values.benefitDate) ?? null,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1, caseId: null as string | null,
      source: "import", importBatchId: batchId,
    });
  }
  const caseIds = await ensureCases(rows, { userId: user.id, source: "benefits", importBatchId: batchId });
  for (const r of rows) r.caseId = caseIds.get(personKey(r)) ?? null;
  if (rows.length) await db.insert(schema.benefits).values(rows);
  await bump(batchId, { created: rows.length, skipped, issues });
  return { created: rows.length, linked: rows.filter((r) => r.caseId).length, skipped, issues };
}

export async function finishBatch(batchId: string) {
  const user = await requireUser("import");
  await logAudit(user, "import", batchId, "import");
  revalidatePath("/cases");
  revalidatePath("/benefits");
  const [b] = await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId));
  return b;
}
