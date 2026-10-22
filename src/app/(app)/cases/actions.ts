"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { diffValues, normalizeValues, toCaseRow, toValues, type CaseValues } from "@/lib/case-record";
import { normalizeDigits } from "@/lib/nid";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** لو الرقم القومي متسجل قبل كده (كرب أسرة أو زوجة) يرجّع الحالة. */
export async function findByNid(nid: string, excludeId?: string) {
  const n = normalizeDigits(nid);
  if (n.length !== 14) return null;
  const where = or(eq(schema.cases.headNid, n), eq(schema.cases.wifeNid, n));
  const [row] = await db.select({ id: schema.cases.id, fileNo: schema.cases.fileNo, headName: schema.cases.headName })
    .from(schema.cases).where(excludeId ? and(where, ne(schema.cases.id, excludeId)) : where).limit(1);
  return row ?? null;
}

export async function createCase(formType: string, values: CaseValues): Promise<SaveResult> {
  const user = await requireUser("cases.edit");
  const v = normalizeValues(values);
  if (!v.headName) return { ok: false, error: "اسم الحالة مطلوب" };
  if (v.headNid) {
    const dup = await findByNid(String(v.headNid));
    if (dup) return { ok: false, error: `الرقم القومي متسجل قبل كده في ملف رقم ${dup.fileNo} (${dup.headName})` };
  }
  const [row] = await db.insert(schema.cases).values({ ...toCaseRow(v, formType), source: "form", createdBy: user.id, updatedBy: user.id })
    .returning({ id: schema.cases.id });
  await logAudit(user, "case", row.id, "create");
  revalidatePath("/cases");
  return { ok: true, id: row.id };
}

export async function updateCase(id: string, values: CaseValues): Promise<SaveResult> {
  const user = await requireUser("cases.edit");
  const [existing] = await db.select().from(schema.cases).where(eq(schema.cases.id, id));
  if (!existing) return { ok: false, error: "الحالة غير موجودة" };
  const v = normalizeValues(values);
  if (!v.headName) return { ok: false, error: "اسم الحالة مطلوب" };
  if (v.headNid) {
    const dup = await findByNid(String(v.headNid), id);
    if (dup) return { ok: false, error: `الرقم القومي متسجل في ملف رقم ${dup.fileNo} (${dup.headName})` };
  }
  const changes = diffValues(normalizeValues(toValues(existing)), v);
  await db.update(schema.cases).set({ ...toCaseRow(v, existing.formType), updatedBy: user.id, updatedAt: new Date() })
    .where(eq(schema.cases.id, id));
  if (Object.keys(changes).length) await logAudit(user, "case", id, "update", changes);
  revalidatePath(`/cases/${id}`);
  revalidatePath("/cases");
  return { ok: true, id };
}

export async function setCaseStatus(id: string, status: string, reason?: string) {
  const user = await requireUser("cases.status");
  if (status === "excluded" && !reason?.trim()) throw new Error("لازم تكتب سبب الاستبعاد");
  const [before] = await db.select({ status: schema.cases.status }).from(schema.cases).where(eq(schema.cases.id, id));
  await db.update(schema.cases).set({
    status, exclusionReason: status === "excluded" ? reason!.trim() : null, updatedBy: user.id, updatedAt: new Date(),
  }).where(eq(schema.cases.id, id));
  await logAudit(user, "case", id, "status", { status: { from: before?.status, to: status }, ...(reason ? { exclusionReason: { from: null, to: reason } } : {}) });
  revalidatePath(`/cases/${id}`);
}

export async function deleteCase(id: string) {
  const user = await requireUser("cases.delete");
  await db.delete(schema.cases).where(eq(schema.cases.id, id));
  await logAudit(user, "case", id, "delete");
  revalidatePath("/cases");
}

export async function toggleNomination(caseId: string, projectId: string, on: boolean) {
  const user = await requireUser("nominate");
  if (on) {
    await db.insert(schema.nominations).values({ caseId, projectId, createdBy: user.id }).onConflictDoNothing();
  } else {
    await db.delete(schema.nominations).where(and(eq(schema.nominations.caseId, caseId), eq(schema.nominations.projectId, projectId)));
  }
  await logAudit(user, "case", caseId, on ? "nominate" : "unnominate", { projectId: { from: null, to: projectId } });
  revalidatePath(`/cases/${caseId}`);
}
