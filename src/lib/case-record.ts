/** تحويل قيم الاستمارة (مسطحة) لصف في جدول الحالات والعكس. */
import type { Case, FamilyMember, NewCase } from "@/db/schema";
import { ALL_FIELDS, completeness } from "./forms";
import { computePriority } from "./eligibility";
import { normalizeDigits, normalizePhone, parseNid } from "./nid";

const INT_COLUMNS = new Set(["familySize", "childrenCount"]);
const NUMERIC_COLUMNS = new Set(["totalIncome", "totalExpenses"]);
const BOOL_COLUMNS = new Set(["guideApproved", "explorerApproved"]);
const COLUMN_KEYS = new Set(ALL_FIELDS.filter((f) => f.column).map((f) => f.key));

const clean = (v: unknown): unknown => {
  if (typeof v === "string") { const t = v.trim(); return t === "" ? undefined : t; }
  return v;
};

export type CaseValues = Record<string, unknown>;

/** يجهز القيم: يوحد الأرقام القومية والتليفونات ويحسب السن من الرقم القومي لو ناقص. */
export function normalizeValues(input: CaseValues): CaseValues {
  const v: CaseValues = {};
  for (const [k, raw] of Object.entries(input)) {
    const val = clean(raw);
    if (val !== undefined) v[k] = val;
  }
  for (const k of ["headNid", "wifeNid"]) if (v[k] !== undefined) v[k] = normalizeDigits(v[k]) || undefined;
  for (const k of ["phone", "phone2"]) if (v[k] !== undefined) v[k] = normalizePhone(v[k]) || undefined;
  if (!v.headAge && v.headNid) { const info = parseNid(v.headNid); if (info.valid) v.headAge = info.age; }
  if (!v.wifeAge && v.wifeNid) { const info = parseNid(v.wifeNid); if (info.valid) v.wifeAge = info.age; }
  if (v.members && !Array.isArray(v.members)) delete v.members;
  if (Array.isArray(v.members)) {
    v.members = (v.members as FamilyMember[]).filter((m) => m && Object.values(m).some((x) => String(x ?? "").trim()));
  }
  if (v.recommendations && !Array.isArray(v.recommendations)) {
    v.recommendations = String(v.recommendations).split(/[،,\-+/]/).map((s) => s.trim()).filter(Boolean);
  }
  if (!v.childrenCount && Array.isArray(v.members)) {
    const kids = (v.members as FamilyMember[]).filter((m) => /ابن|ابنة|بنت/.test(m.relation ?? "")).length;
    if (kids) v.childrenCount = kids;
  }
  return v;
}

const toInt = (v: unknown) => { const n = parseInt(normalizeDigits(v), 10); return Number.isFinite(n) ? n : null; };
const toNumeric = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? String(n) : null;
};
const toBool = (v: unknown) => v === true || v === "نعم" || v === "true";

/** القيم → أعمدة + details + الحقول المحسوبة (الاكتمال والأولوية). */
export function toCaseRow(input: CaseValues, formType = "general"): Omit<NewCase, "id" | "fileNo"> {
  const v = normalizeValues(input);
  const details: Record<string, unknown> = {};
  const row: Record<string, unknown> = { formType };
  for (const [k, val] of Object.entries(v)) {
    if (k === "members") continue;
    if (!COLUMN_KEYS.has(k)) { details[k] = val; continue; }
    if (INT_COLUMNS.has(k)) row[k] = toInt(val);
    else if (NUMERIC_COLUMNS.has(k)) row[k] = toNumeric(val);
    else if (BOOL_COLUMNS.has(k)) row[k] = toBool(val);
    else row[k] = val;
  }
  const c = completeness(v);
  const p = computePriority(v);
  return {
    ...(row as Partial<NewCase>),
    headName: String(v.headName ?? "بدون اسم"),
    members: (v.members as FamilyMember[]) ?? [],
    recommendations: (v.recommendations as string[]) ?? [],
    details,
    completeness: c.percent,
    priorityScore: p.score,
    priorityLevel: p.level,
  };
}

/** صف الحالة → قيم مسطحة للاستمارة. */
export function toValues(c: Case): CaseValues {
  const v: CaseValues = { ...(c.details ?? {}) };
  for (const key of COLUMN_KEYS) {
    const val = (c as unknown as Record<string, unknown>)[key];
    if (val === null || val === undefined) continue;
    v[key] = BOOL_COLUMNS.has(key) ? (val ? "نعم" : "لا") : val;
  }
  v.members = c.members ?? [];
  v.recommendations = c.recommendations ?? [];
  return v;
}

/** الفرق بين قيمتين لسجل التعديلات. */
export function diffValues(before: CaseValues, after: CaseValues): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = JSON.stringify(before[k] ?? null), b = JSON.stringify(after[k] ?? null);
    if (a !== b) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}
