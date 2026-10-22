/** ربط أعمدة الإكسل بحقول السستم وتجهيز صفوف الاستيراد. */
import { ALL_FIELDS } from "./forms";
import { normalizeDigits, parseNid } from "./nid";
import { normalizeValues, type CaseValues } from "./case-record";

/** توحيد الكتابة العربية للمقارنة: الهمزات، التاء المربوطة، الياء، التشكيل، المسافات. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export type MappableField = { key: string; label: string; aliases: string[] };

export const CASE_IMPORT_FIELDS: MappableField[] = ALL_FIELDS
  .filter((f) => f.type !== "members")
  .map((f) => ({ key: f.key, label: f.label, aliases: [f.label, ...(f.aliases ?? [])] }));

export const BENEFIT_IMPORT_FIELDS: MappableField[] = [
  { key: "name", label: "الاسم", aliases: ["الاسم", "اسم الحالة", "اسم المستفيد", "اسم رب الاسرة"] },
  { key: "nid", label: "الرقم القومي", aliases: ["الرقم القومي", "رقم قومي", "الرقم القومى", "رقم البطاقة"] },
  { key: "phone", label: "التليفون", aliases: ["التليفون", "رقم التليفون", "الموبايل", "رقم الهاتف"] },
  { key: "projectName", label: "المشروع / المبادرة", aliases: ["المشروع", "المبادرة", "اسم المشروع", "نوع المساعدة"] },
  { key: "convoy", label: "القافلة", aliases: ["القافلة", "رقم القافلة", "القافله"] },
  { key: "benefitDate", label: "تاريخ الاستلام", aliases: ["التاريخ", "تاريخ الاستلام", "تاريخ التنفيذ", "تاريخ التسليم"] },
  { key: "governorate", label: "المحافظة", aliases: ["المحافظة"] },
  { key: "village", label: "القرية", aliases: ["القرية", "القريه"] },
  { key: "quantity", label: "عدد المساعدات", aliases: ["العدد", "عدد المساعدات", "الكمية"] },
];

/** يقترح لكل عمود في الإكسل الحقل المناسب (أو null). */
export function suggestMapping(headers: string[], fields: MappableField[]): Record<string, string | null> {
  const index = new Map<string, string>();
  for (const f of fields) for (const a of f.aliases) if (!index.has(normalizeArabic(a))) index.set(normalizeArabic(a), f.key);
  const used = new Set<string>();
  const out: Record<string, string | null> = {};
  for (const h of headers) {
    const key = index.get(normalizeArabic(h)) ?? null;
    out[h] = key && !used.has(key) ? key : null;
    if (key) used.add(key);
  }
  return out;
}

/** التواريخ في الإكسل ممكن تيجي رقم تسلسلي أو نص بأي شكل. */
export function parseDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim().split(/\s/)[0].replace(/[٠-٩]/g, (d) => normalizeDigits(d));
  const m = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!m) return undefined;
  let [, a, b, c] = m;
  if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  if (c.length === 2) c = `20${c}`;
  return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
}

export type RowIssue = { row: number; message: string };

export type CaseImportPlan = {
  creates: { row: number; values: CaseValues }[];
  merges: { row: number; nid: string; values: CaseValues }[];
  issues: RowIssue[];
  skipped: number;
};

/**
 * يجهز خطة الاستيراد: صفوف جديدة، صفوف بتتدمج في حالات موجودة (بنفس الرقم القومي)،
 * ومشاكل. الصفوف الناقصة بتتسجل عادي.
 */
export function planCaseImport(
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  existingNids: Set<string>,
  /** رقم كل صف في ملف الإكسل الأصلي (للملاحظات) */
  rowNumbers?: number[],
): CaseImportPlan {
  const plan: CaseImportPlan = { creates: [], merges: [], issues: [], skipped: 0 };
  const seen = new Map<string, number>();
  rows.forEach((raw, i) => {
    const rowNo = rowNumbers?.[i] ?? i + 2; // صف العناوين هو 1
    const values: CaseValues = {};
    for (const [header, key] of Object.entries(mapping)) {
      if (!key) continue;
      const v = raw[header];
      if (v === null || v === undefined || String(v).trim() === "") continue;
      values[key] = key === "exploredAt" ? parseDate(v) : v;
    }
    if (Object.keys(values).length === 0) { plan.skipped++; return; }
    const v = normalizeValues(values);
    if (!v.headName) { plan.issues.push({ row: rowNo, message: "الصف من غير اسم، اتسجل باسم مؤقت" }); v.headName = `بدون اسم (صف ${rowNo})`; }
    const nid = v.headNid ? String(v.headNid) : "";
    if (nid) {
      const info = parseNid(nid);
      if (!info.valid) {
        plan.issues.push({ row: rowNo, message: `الرقم القومي ${nid}: ${info.error}` });
      }
      if (seen.has(nid)) {
        plan.issues.push({ row: rowNo, message: `الرقم القومي مكرر في الملف مع الصف ${seen.get(nid)}، اتدمج معاه` });
        const target = plan.creates.find((c) => c.values.headNid === nid) ?? plan.merges.find((m) => m.nid === nid);
        if (target) for (const [k, val] of Object.entries(v)) if (target.values[k] === undefined) target.values[k] = val;
        return;
      }
      seen.set(nid, rowNo);
      if (existingNids.has(nid)) { plan.merges.push({ row: rowNo, nid, values: v }); return; }
    }
    plan.creates.push({ row: rowNo, values: v });
  });
  return plan;
}

/** يملأ الحقول الفاضية بس في الحالة الموجودة (ما بيمسحش بيانات مسجلة). */
export function mergeMissing(existing: CaseValues, incoming: CaseValues): CaseValues {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    const cur = out[k];
    const empty = cur === undefined || cur === null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (empty) out[k] = v;
  }
  return out;
}

export function resolveProjectName(name: string, projects: { name: string; aliases?: string[] }[]): string {
  const n = normalizeArabic(name);
  for (const p of projects) {
    if (normalizeArabic(p.name) === n) return p.name;
    if (p.aliases?.some((a) => normalizeArabic(a) === n)) return p.name;
  }
  return name.trim();
}
