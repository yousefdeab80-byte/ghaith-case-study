"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { can, requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { getSetting } from "@/lib/server/data";
import { getSheet, getSheetCases } from "@/lib/server/sheets";
import { sendMail, smtpConfigured } from "@/lib/server/mail";
import { buildXlsx, safeFileName } from "@/lib/server/xlsx";
import { parseEmails, sheetRow } from "@/lib/nomination";

const NOT_DRAFT = "الكشف اتبعت واتقفل. افتحه تاني الأول لو محتاج تعدل فيه.";

async function draftSheet(id: string) {
  const found = await getSheet(id);
  if (!found) throw new Error("الكشف مش موجود");
  if (found.sheet.status !== "draft") throw new Error(NOT_DRAFT);
  return found;
}
const refresh = (id?: string) => { revalidatePath("/nominations"); if (id) revalidatePath(`/nominations/${id}`); };

export async function createSheet(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser("nominate");
  const projectId = String(form.get("projectId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!projectId) return "اختار المشروع";
  if (!title) return "اكتب اسم الكشف (مثلاً: قافلة 3 – أطفيح)";
  const target = Number(form.get("targetCount"));
  const [row] = await db.insert(schema.sheets).values({
    projectId, title, createdBy: user.id,
    convoy: String(form.get("convoy") ?? "").trim() || null,
    governorate: String(form.get("governorate") ?? "") || null,
    plannedDate: String(form.get("plannedDate") ?? "") || null,
    targetCount: Number.isFinite(target) && target > 0 ? target : null,
  }).returning({ id: schema.sheets.id });
  await logAudit(user, "sheet", row.id, "create", { title: { from: null, to: title } });
  redirect(`/nominations/${row.id}`);
}

export async function updateSheet(id: string, data: { title: string; convoy: string; governorate: string; plannedDate: string; targetCount: string; notes: string }) {
  const user = await requireUser("nominate");
  await draftSheet(id);
  if (!data.title.trim()) throw new Error("اسم الكشف مطلوب");
  const target = Number(data.targetCount);
  await db.update(schema.sheets).set({
    title: data.title.trim(), convoy: data.convoy.trim() || null, governorate: data.governorate || null,
    plannedDate: data.plannedDate || null, targetCount: Number.isFinite(target) && target > 0 ? target : null,
    notes: data.notes.trim() || null, updatedAt: new Date(),
  }).where(eq(schema.sheets.id, id));
  await logAudit(user, "sheet", id, "update");
  refresh(id);
}

export async function deleteSheet(id: string) {
  const user = await requireUser("nominate");
  const { sheet } = await draftSheet(id);
  const [sent] = await db.select({ id: schema.sheetEmails.id }).from(schema.sheetEmails).where(eq(schema.sheetEmails.sheetId, id)).limit(1);
  if (sent) throw new Error("الكشف ده اتبعت قبل كده ومينفعش يتحذف، ممكن تقفله بدل كده.");
  // الحالات اللي كانت مرشحة من ملفها ترجع لقائمة الانتظار بدل ما تضيع
  const rows = await db.select({ caseId: schema.nominations.caseId }).from(schema.nominations).where(eq(schema.nominations.sheetId, id));
  await db.delete(schema.sheets).where(eq(schema.sheets.id, id));
  if (rows.length) {
    await db.insert(schema.nominations).values(rows.map((r) => ({ caseId: r.caseId, projectId: sheet.projectId, createdBy: user.id }))).onConflictDoNothing();
  }
  await logAudit(user, "sheet", id, "delete", { title: { from: sheet.title, to: null } });
  refresh();
  redirect("/nominations");
}

export async function addToSheet(sheetId: string, caseIds: string[]) {
  const user = await requireUser("nominate");
  const { sheet } = await draftSheet(sheetId);
  if (!caseIds.length) return 0;
  const excluded = await db.select({ id: schema.cases.id }).from(schema.cases)
    .where(and(inArray(schema.cases.id, caseIds), eq(schema.cases.status, "excluded")));
  const ids = caseIds.filter((id) => !excluded.some((e) => e.id === id));
  if (!ids.length) return 0;
  const added = await db.insert(schema.nominations)
    .values(ids.map((caseId) => ({ caseId, projectId: sheet.projectId, sheetId, createdBy: user.id })))
    .onConflictDoNothing().returning({ id: schema.nominations.id });
  // اتنقلت من قائمة الانتظار للكشف
  await db.delete(schema.nominations).where(and(
    eq(schema.nominations.projectId, sheet.projectId), isNull(schema.nominations.sheetId), inArray(schema.nominations.caseId, ids),
  ));
  await db.update(schema.sheets).set({ updatedAt: new Date() }).where(eq(schema.sheets.id, sheetId));
  await logAudit(user, "sheet", sheetId, "add_cases", { count: { from: null, to: added.length } });
  refresh(sheetId);
  return added.length;
}

export async function removeFromSheet(sheetId: string, nominationIds: string[], backToPool: boolean) {
  const user = await requireUser("nominate");
  const { sheet } = await draftSheet(sheetId);
  if (!nominationIds.length) return;
  const removed = await db.delete(schema.nominations)
    .where(and(eq(schema.nominations.sheetId, sheetId), inArray(schema.nominations.id, nominationIds)))
    .returning({ caseId: schema.nominations.caseId });
  if (backToPool && removed.length) {
    await db.insert(schema.nominations).values(removed.map((r) => ({ caseId: r.caseId, projectId: sheet.projectId, createdBy: user.id }))).onConflictDoNothing();
  }
  await logAudit(user, "sheet", sheetId, "remove_cases", { count: { from: null, to: removed.length } });
  refresh(sheetId);
}

export async function setNominationNote(sheetId: string, nominationId: string, note: string) {
  await requireUser("nominate");
  await draftSheet(sheetId);
  await db.update(schema.nominations).set({ note: note.trim() || null })
    .where(and(eq(schema.nominations.id, nominationId), eq(schema.nominations.sheetId, sheetId)));
  refresh(sheetId);
}

export type SendInput = { to: string; cc: string; subject: string; body: string; method: "smtp" | "manual" };
export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * بيبعت الكشف (أو بيسجل إنه اتبعت من Outlook) وبيقفله:
 * الكشف يبقى "اتبعت"، والترشيحات "اتبعتت"، ونسخة ثابتة من الصفوف بتتحفظ في سجل الإيميلات.
 */
export async function sendSheet(sheetId: string, input: SendInput): Promise<SendResult> {
  const user = await requireUser("nominate");
  const found = await getSheet(sheetId);
  if (!found) return { ok: false, error: "الكشف مش موجود" };
  if (found.sheet.status !== "draft") return { ok: false, error: NOT_DRAFT };
  const to = parseEmails(input.to), cc = parseEmails(input.cc);
  if (to.invalid.length || cc.invalid.length) return { ok: false, error: `إيميلات مش مظبوطة: ${[...to.invalid, ...cc.invalid].join("، ")}` };
  if (!to.valid.length) return { ok: false, error: "لازم إيميل واحد على الأقل في \"إلى\"" };
  if (!input.subject.trim()) return { ok: false, error: "الموضوع فاضي" };

  const rows = await getSheetCases(sheetId);
  if (!rows.length) return { ok: false, error: "الكشف فاضي" };
  const snapshot = rows.map((r, i) => sheetRow(r.c, i, r.nomination.note));
  const from = await getSetting("nominationEmail", "abdallh.mohamed@ghaithfoundation.org");

  if (input.method === "smtp") {
    if (!smtpConfigured()) return { ok: false, error: "الإرسال من السستم مش متظبط. ابعت من Outlook وأكد الإرسال." };
    try {
      await sendMail({
        from, to: to.valid, cc: cc.valid, subject: input.subject.trim(), text: input.body,
        attachments: [{ filename: `${safeFileName(`${found.project.name} - ${found.sheet.title}`)}.xlsx`, content: buildXlsx(snapshot, "كشف الترشيح") }],
      });
    } catch (e) {
      return { ok: false, error: `الإيميل متبعتش: ${(e as Error).message}` };
    }
  }

  const now = new Date();
  await db.insert(schema.sheetEmails).values({
    sheetId, fromEmail: from, to: to.valid, cc: cc.valid, subject: input.subject.trim(), body: input.body,
    method: input.method, rowCount: rows.length, snapshot, sentBy: user.id, sentByName: user.name, sentAt: now,
  });
  await db.update(schema.sheets).set({ status: "sent", sentAt: now, sentBy: user.id, updatedAt: now }).where(eq(schema.sheets.id, sheetId));
  await db.update(schema.nominations).set({ status: "sent" }).where(eq(schema.nominations.sheetId, sheetId));
  await logAudit(user, "sheet", sheetId, input.method === "smtp" ? "send_email" : "confirm_sent", { rows: { from: null, to: rows.length } });
  refresh(sheetId);
  return { ok: true };
}

/** فتح كشف اتبعت عشان يتعدل (مدير أو صلاحية الإعدادات). الإيميل القديم ونسخته بيفضلوا في السجل. */
export async function reopenSheet(sheetId: string, reason: string) {
  const user = await requireUser("nominate");
  if (!can(user, "settings")) throw new Error("فتح كشف اتبعت محتاج صلاحية المدير");
  if (!reason.trim()) throw new Error("اكتب سبب الفتح");
  await db.update(schema.sheets).set({ status: "draft", updatedAt: new Date() }).where(eq(schema.sheets.id, sheetId));
  await db.update(schema.nominations).set({ status: "nominated" }).where(eq(schema.nominations.sheetId, sheetId));
  await logAudit(user, "sheet", sheetId, "reopen", { reason: { from: null, to: reason.trim() } });
  refresh(sheetId);
}

export async function closeSheet(sheetId: string) {
  const user = await requireUser("nominate");
  const found = await getSheet(sheetId);
  if (found?.sheet.status !== "sent") throw new Error("الكشف لازم يكون اتبعت الأول");
  await db.update(schema.sheets).set({ status: "closed", updatedAt: new Date() }).where(eq(schema.sheets.id, sheetId));
  await logAudit(user, "sheet", sheetId, "close");
  refresh(sheetId);
}
