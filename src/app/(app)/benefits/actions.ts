"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { normalizeDigits, normalizePhone } from "@/lib/nid";
import { ensureCases, linkOrphanBenefits, personKey } from "@/lib/server/case-sync";

export async function addBenefit(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser("benefits");
  const name = String(form.get("name") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "");
  if (!name || !projectId) return "الاسم والمشروع مطلوبين";
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!project) return "المشروع غير موجود";
  const nid = normalizeDigits(form.get("nid")) || null;
  const phone = normalizePhone(form.get("phone")) || null;
  // أي مستفيد بيتسجل لازم يبقى له ملف في سجل الحالات
  const person = { name, nid, phone };
  const caseId = (await ensureCases([person], { userId: user.id, source: "benefits" })).get(personKey(person)) ?? null;
  const [row] = await db.insert(schema.benefits).values({
    name, nid, phone, projectId, projectName: project.name,
    convoy: String(form.get("convoy") ?? "") || null, benefitDate: String(form.get("benefitDate") ?? "") || null,
    quantity: Math.max(1, Number(form.get("quantity")) || 1), caseId, source: "manual",
  }).returning({ id: schema.benefits.id });
  await logAudit(user, "benefit", row.id, "create");
  revalidatePath("/benefits");
  revalidatePath("/cases");
  return null;
}

/** يربط المساعدات القديمة اللي ملهاش ملف بسجل الحالات، على دفعات. */
export async function linkOldBenefits(): Promise<{ linked: number; remaining: number }> {
  const user = await requireUser("import");
  const res = await linkOrphanBenefits(user.id);
  if (res.linked) await logAudit(user, "benefit", null, "link_cases", { count: { from: null, to: res.linked } });
  revalidatePath("/benefits");
  revalidatePath("/cases");
  return res;
}

export async function deleteBenefit(id: string) {
  const user = await requireUser("benefits");
  await db.delete(schema.benefits).where(eq(schema.benefits.id, id));
  await logAudit(user, "benefit", id, "delete");
  revalidatePath("/benefits");
}
