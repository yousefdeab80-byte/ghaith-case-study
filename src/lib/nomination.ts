/** كشوف الترشيح والإيميل الرسمي للإدارات: دوال صافية بتتستخدم في السيرفر والمتصفح. */

export type EmailTemplate = { subject: string; body: string };

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "ترشيحات قطاع دراسة الحالة – {المشروع} – {الكشف}",
  body: [
    "السادة الزملاء المحترمين،",
    "تحية طيبة وبعد،",
    "",
    "مرفق لحضراتكم كشف ترشيحات مشروع «{المشروع}» ({الكشف}) بعدد {العدد} حالة، وتوزيعها كالتالي:",
    "{التوزيع}",
    "",
    "تاريخ التنفيذ المخطط: {التاريخ}",
    "برجاء موافاتنا بكشف الاستلام الموقّع خلال {مهلة_التسوية} أيام من التنفيذ لإتمام التسوية، مع إبلاغنا بأي حالة لم تستلم أو تم استبدالها وسبب ذلك.",
    "",
    "وتفضلوا بقبول وافر الاحترام،",
    "{المرسل}",
    "قطاع دراسة الحالة – مؤسسة غيث للتنمية المجتمعية",
  ].join("\n"),
};

/** المتغيرات اللي ممكن تتكتب في القالب، عشان نعرضها للمستخدم في الإعدادات. */
export const TEMPLATE_VARS = ["المشروع", "الكشف", "القافلة", "العدد", "التوزيع", "التاريخ", "مهلة_التسوية", "المرسل"] as const;

export function fillTemplate(text: string, vars: Partial<Record<(typeof TEMPLATE_VARS)[number], string | number>>): string {
  return text.replace(/\{([^{}]+)\}/g, (m, k: string) => {
    const v = vars[k.trim() as keyof typeof vars];
    return v === undefined || v === null || v === "" ? "—" : String(v);
  });
}

type GeoRow = { governorate?: string | null; markaz?: string | null; village?: string | null };

/** "الجيزة – أطفيح: 12 حالة" لكل مركز، مترتبة من الأكبر للأصغر. */
export function distributionLines(rows: GeoRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = [r.governorate, r.markaz].filter(Boolean).join(" – ") || "مكان غير مسجل";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `• ${k}: ${n} ${n === 1 ? "حالة" : "حالات"}`);
}

/** يفصل الإيميلات المكتوبة بفاصلة أو سطر جديد أو ; ويرجّع الصحيح والغلط. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;،]+/).map((s) => s.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const e = p.replace(/^<|>$/g, "").toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { if (!valid.includes(e)) valid.push(e); } else invalid.push(p);
  }
  return { valid, invalid };
}

/** رابط mailto (Outlook على الجهاز). الملف المرفق بيتضاف يدوي لأن mailto مبيدعمش مرفقات. */
export function mailtoUrl(to: string[], cc: string[], subject: string, body: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  if (cc.length) q.unshift(`cc=${encodeURIComponent(cc.join(","))}`);
  return `mailto:${to.map(encodeURIComponent).join(",")}?${q.join("&")}`;
}

/** رابط فتح رسالة جديدة في Outlook على الويب (Microsoft 365). */
export function outlookWebUrl(to: string[], cc: string[], subject: string, body: string): string {
  const q = new URLSearchParams({ to: to.join(","), subject, body });
  if (cc.length) q.set("cc", cc.join(","));
  return `https://outlook.office.com/mail/deeplink/compose?${q.toString()}`;
}

export const SHEET_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "badge-study" },
  sent: { label: "اتبعت للإدارات", cls: "badge-eligible" },
  closed: { label: "اتقفل", cls: "badge-served" },
};

export type SheetCase = {
  fileNo: number; headName: string; headNid: string | null; wifeName: string | null; wifeNid: string | null;
  phone: string | null; phone2: string | null; governorate: string | null; markaz: string | null; village: string | null;
  address: string | null; familySize: number | null; maritalStatus: string | null; priorityLevel: string;
};

const PRIORITY = { high: "عالية", mid: "متوسطة", low: "عادية" } as Record<string, string>;

/** صف الكشف زي ما بيطلع في ملف الإكسل المرفق، وبيتحفظ نسخة منه وقت الإرسال. */
export function sheetRow(c: SheetCase, i: number, note?: string | null): Record<string, string | number> {
  return {
    "م": i + 1,
    "رقم الملف": c.fileNo,
    "اسم رب الأسرة": c.headName,
    "الرقم القومي": c.headNid ?? "",
    "اسم الزوجة": c.wifeName ?? "",
    "الرقم القومي للزوجة": c.wifeNid ?? "",
    "التليفون": [c.phone, c.phone2].filter(Boolean).join(" / "),
    "المحافظة": c.governorate ?? "",
    "المركز": c.markaz ?? "",
    "القرية": c.village ?? "",
    "العنوان": c.address ?? "",
    "عدد الأفراد": c.familySize ?? "",
    "الحالة الاجتماعية": c.maritalStatus ?? "",
    "الأولوية": PRIORITY[c.priorityLevel] ?? "",
    "ملاحظات": note ?? "",
    "استلم (نعم/لا)": "",
    "توقيع المستلم": "",
  };
}
