import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { toCaseRow } from "@/lib/case-record";
import { normalizeArabic } from "@/lib/import";
import { normalizeDigits, normalizePhone } from "@/lib/nid";

export type Person = { name: string; nid?: string | null; phone?: string | null; governorate?: string | null; village?: string | null };

/** مفتاح الشخص: الرقم القومي لو صحيح، وإلا الاسم + التليفون أو القرية. */
export function personKey(p: Person): string {
  const nid = normalizeDigits(p.nid);
  if (nid.length === 14) return `nid:${nid}`;
  return `np:${normalizeArabic(p.name)}|${normalizePhone(p.phone) || normalizeArabic(p.village ?? "")}`;
}

/**
 * سجل الحالات هو قاعدة بيانات المؤسسة: أي شخص يتسجل في أي حتة في السستم (مساعدة يدوي أو استيراد)
 * لازم يبقى له ملف. الدالة بتدور عليه بالرقم القومي (رب الأسرة أو الزوجة)، وإلا بالاسم + التليفون،
 * ولو ملقيتهوش بتفتح له ملف جديد حالته "تم التنفيذ". بترجع خريطة personKey → caseId.
 */
export async function ensureCases(people: Person[], opts: { userId?: string; source: string; importBatchId?: string }) {
  const out = new Map<string, string>();
  const unique = new Map<string, Person>();
  for (const p of people) if (p.name?.trim() || normalizeDigits(p.nid).length === 14) unique.set(personKey(p), p);
  if (!unique.size) return out;

  const nids = [...unique.values()].map((p) => normalizeDigits(p.nid)).filter((n) => n.length === 14);
  const phones = [...unique.values()].filter((p) => normalizeDigits(p.nid).length !== 14).map((p) => normalizePhone(p.phone)).filter(Boolean);
  const c = schema.cases;
  const existing = await db.select({ id: c.id, headName: c.headName, headNid: c.headNid, wifeNid: c.wifeNid, phone: c.phone, phone2: c.phone2, village: c.village })
    .from(c).where(or(
      ...(nids.length ? [inArray(c.headNid, nids), inArray(c.wifeNid, nids)] : []),
      ...(phones.length ? [inArray(c.phone, phones), inArray(c.phone2, phones)] : []),
      ...(!nids.length && !phones.length ? [eq(c.id, "00000000-0000-0000-0000-000000000000")] : []),
    ));
  for (const e of existing) {
    if (e.headNid) out.set(`nid:${e.headNid}`, e.id);
    if (e.wifeNid) out.set(`nid:${e.wifeNid}`, e.id);
    for (const ph of [e.phone, e.phone2]) if (ph) out.set(`np:${normalizeArabic(e.headName)}|${ph}`, e.id);
  }

  const toCreate = [...unique.entries()].filter(([k]) => !out.has(k));
  if (toCreate.length) {
    const rows = toCreate.map(([, p]) => {
      const nid = normalizeDigits(p.nid);
      return {
        ...toCaseRow({
          headName: p.name?.trim() || "بدون اسم", headNid: nid.length === 14 ? nid : undefined,
          phone: normalizePhone(p.phone) || undefined, governorate: p.governorate || undefined, village: p.village || undefined,
        }),
        status: "served", source: opts.source, importBatchId: opts.importBatchId ?? null,
        createdBy: opts.userId ?? null, updatedBy: opts.userId ?? null,
      };
    });
    const created = await db.insert(c).values(rows).onConflictDoNothing().returning({ id: c.id, headNid: c.headNid });
    // onConflictDoNothing بيرجّع الصفوف اللي اتضافت بس، فبنربطها بالترتيب عن طريق الرقم القومي أو الترتيب
    let i = 0;
    for (const [k, p] of toCreate) {
      const nid = normalizeDigits(p.nid);
      const hit = nid.length === 14 ? created.find((r) => r.headNid === nid) : created.filter((r) => !r.headNid)[i++];
      if (hit) out.set(k, hit.id);
    }
  }
  return out;
}

/** يربط المساعدات القديمة اللي ملهاش ملف بسجل الحالات (بيفتح ملفات للي مش موجودين). */
export async function linkOrphanBenefits(userId?: string, limit = 2000) {
  const b = schema.benefits;
  const rows = await db.select({ id: b.id, name: b.name, nid: b.nid, phone: b.phone, governorate: b.governorate, village: b.village })
    .from(b).where(isNull(b.caseId)).limit(limit);
  if (!rows.length) return { linked: 0, remaining: 0 };
  const map = await ensureCases(rows, { userId, source: "benefits" });
  let linked = 0;
  const byCase = new Map<string, string[]>();
  for (const r of rows) {
    const id = map.get(personKey(r));
    if (id) { byCase.set(id, [...(byCase.get(id) ?? []), r.id]); linked++; }
  }
  for (const [caseId, ids] of byCase) await db.update(b).set({ caseId }).where(and(inArray(b.id, ids), isNull(b.caseId)));
  return { linked, remaining: await db.$count(b, isNull(b.caseId)) };
}
