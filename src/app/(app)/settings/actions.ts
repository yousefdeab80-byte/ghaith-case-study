"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import type { FeedbackQuestion } from "@/db/schema";
import { requireUser } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { setSetting } from "@/lib/server/data";
import { DEFAULT_PERMISSIONS, PERMISSIONS } from "@/lib/constants";
import { RULE_KEYS } from "@/lib/eligibility";

const done = (_tab: string) => revalidatePath("/settings");

export async function createUser(_: string | null, form: FormData): Promise<string | null> {
  const admin = await requireUser("settings");
  const username = String(form.get("username") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "coordinator");
  if (!username || !name) return "الاسم واسم المستخدم مطلوبين";
  if (password.length < 8) return "كلمة المرور لازم تكون 8 حروف على الأقل";
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username));
  if (exists) return "اسم المستخدم ده موجود";
  const [u] = await db.insert(schema.users).values({
    username, name, role, passwordHash: await bcrypt.hash(password, 10), permissions: DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.viewer,
  }).returning({ id: schema.users.id });
  await logAudit(admin, "user", u.id, "create");
  done("users");
  return null;
}

export async function updateUser(id: string, data: { name: string; role: string; active: boolean; permissions: Record<string, boolean> }) {
  const admin = await requireUser("settings");
  if (id === admin.id && (!data.active || data.role !== "manager")) throw new Error("ماتقدرش تقفل حسابك أو تشيل صلاحية المدير منه");
  const permissions = Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!data.permissions[p.key]]));
  await db.update(schema.users).set({ name: data.name.trim(), role: data.role, active: data.active, permissions }).where(eq(schema.users.id, id));
  await logAudit(admin, "user", id, "update");
  done("users");
}

export async function resetPassword(id: string, password: string) {
  const admin = await requireUser("settings");
  if (password.length < 8) throw new Error("كلمة المرور لازم تكون 8 حروف على الأقل");
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(schema.users.id, id));
  await logAudit(admin, "user", id, "reset_password");
}

export async function changeOwnPassword(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return "كلمة المرور الحالية غلط";
  if (next.length < 8) return "كلمة المرور الجديدة لازم تكون 8 حروف على الأقل";
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(schema.users.id, user.id));
  await logAudit(user, "user", user.id, "change_password");
  return "تم تغيير كلمة المرور";
}

export type ProjectInput = {
  name: string; sector: string; rulesKey: string; active: boolean; minDaysBetweenBenefits: number | null;
  sampleRatio: number; settlementDeadlineDays: number; impactAfterDays: number | null; requiredDocs: string[]; feedbackQuestions: FeedbackQuestion[];
};

export async function saveProject(id: string | null, p: ProjectInput) {
  const admin = await requireUser("settings");
  if (!p.name.trim()) throw new Error("اسم المشروع مطلوب");
  if (!RULE_KEYS.includes(p.rulesKey)) throw new Error("نوع المعايير غير معروف");
  const total = p.feedbackQuestions.reduce((s, q) => s + (Number(q.weight) || 0), 0);
  if (p.feedbackQuestions.length && total !== 100) throw new Error(`مجموع أوزان أسئلة الفيد باك لازم يكون 100 (حالياً ${total})`);
  const values = {
    name: p.name.trim(), sector: p.sector, rulesKey: p.rulesKey, active: p.active,
    minDaysBetweenBenefits: p.minDaysBetweenBenefits || null, sampleRatio: String(Math.min(1, Math.max(0, p.sampleRatio))),
    settlementDeadlineDays: p.settlementDeadlineDays || 4, impactAfterDays: p.impactAfterDays || null,
    requiredDocs: p.requiredDocs.map((d) => d.trim()).filter(Boolean),
    feedbackQuestions: p.feedbackQuestions.filter((q) => q.text.trim()).map((q, i) => ({ ...q, id: `q${i + 1}`, weight: Number(q.weight) || 0 })),
  };
  if (id) await db.update(schema.projects).set(values).where(eq(schema.projects.id, id));
  else await db.insert(schema.projects).values({ ...values, sortOrder: 999 });
  await logAudit(admin, "project", id, id ? "update" : "create");
  done("projects");
}

export async function saveLookup(key: string, text: string) {
  const admin = await requireUser("settings");
  const { getLookups } = await import("@/lib/server/data");
  const all = await getLookups();
  all[key] = [...new Set(text.split("\n").map((s) => s.trim()).filter(Boolean))];
  await setSetting("lookups", all);
  await logAudit(admin, "settings", "lookups", "update");
  done("lookups");
}

export async function saveEmailSettings(nominationEmail: string, list: { name: string; email: string }[]) {
  const admin = await requireUser("settings");
  await setSetting("nominationEmail", nominationEmail.trim());
  await setSetting("distributionList", list.filter((d) => d.email.includes("@")));
  await logAudit(admin, "settings", "email", "update");
  done("email");
}

export async function saveEmailTemplate(subject: string, body: string) {
  const admin = await requireUser("settings");
  if (!subject.trim() || !body.trim()) throw new Error("الموضوع والنص مطلوبين");
  await setSetting("nominationTemplate", { subject: subject.trim(), body });
  await logAudit(admin, "settings", "email_template", "update");
  done("email");
}
