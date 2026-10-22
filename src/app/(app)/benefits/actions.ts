"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { normalizeDigits, normalizePhone } from "@/lib/nid";

export async function addBenefit(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser("benefits");
  const name = String(form.get("name") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "");
  if (!name || !projectId) return "الاسم والمشروع مطلوبين";
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!project) return "المشروع غير موجود";
  const nid = normalizeDigits(form.get("nid")) || null;
  const [hit] = nid ? await db.select({ id: schema.cases.id }).from(schema.cases).where(or(eq(schema.cases.headNid, nid), eq(schema.cases.wifeNid, nid))) : [];
  const [row] = await db.insert(schema.benefits).values({
    name, nid, phone: normalizePhone(form.get("phone")) || null, projectId, projectName: project.name,
    convoy: String(form.get("convoy") ?? "") || null, benefitDate: String(form.get("benefitDate") ?? "") || null,
    quantity: Math.max(1, Number(form.get("quantity")) || 1), caseId: hit?.id ?? null, source: "manual",
  }).returning({ id: schema.benefits.id });
  await logAudit(user, "benefit", row.id, "create");
  revalidatePath("/benefits");
  return null;
}

export async function deleteBenefit(id: string) {
  const user = await requireUser("benefits");
  await db.delete(schema.benefits).where(eq(schema.benefits.id, id));
  await logAudit(user, "benefit", id, "delete");
  revalidatePath("/benefits");
}
