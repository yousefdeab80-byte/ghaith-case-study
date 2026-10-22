/** تحليل الرقم القومي المصري (14 رقم): القرن، تاريخ الميلاد، محافظة الميلاد، النوع. */

const GOV_CODES: Record<string, string> = {
  "01": "القاهرة", "02": "الإسكندرية", "03": "بورسعيد", "04": "السويس", "11": "دمياط", "12": "الدقهلية",
  "13": "الشرقية", "14": "القليوبية", "15": "كفر الشيخ", "16": "الغربية", "17": "المنوفية", "18": "البحيرة",
  "19": "الإسماعيلية", "21": "الجيزة", "22": "بني سويف", "23": "الفيوم", "24": "المنيا", "25": "أسيوط",
  "26": "سوهاج", "27": "قنا", "28": "أسوان", "29": "الأقصر", "31": "البحر الأحمر", "32": "الوادي الجديد",
  "33": "مطروح", "34": "شمال سيناء", "35": "جنوب سيناء", "88": "خارج الجمهورية",
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** يحول الأرقام العربية/الفارسية لأرقام إنجليزية ويشيل أي حاجة مش رقم. */
export function normalizeDigits(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v).trim();
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // إكسل أحياناً بيحول الرقم القومي لصيغة علمية أو يضيف .0
  if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, "");
  return s.replace(/\D/g, "");
}

export type NidInfo = {
  valid: boolean;
  error?: string;
  birthDate?: string;
  age?: number;
  governorate?: string;
  gender?: "ذكر" | "أنثى";
};

export function parseNid(raw: unknown, today = new Date()): NidInfo {
  const nid = normalizeDigits(raw);
  if (!nid) return { valid: false, error: "فارغ" };
  if (nid.length !== 14) return { valid: false, error: `الرقم ${nid.length} خانة بدل 14` };
  const century = nid[0] === "2" ? 1900 : nid[0] === "3" ? 2000 : null;
  if (!century) return { valid: false, error: "أول رقم لازم يكون 2 أو 3" };
  const year = century + Number(nid.slice(1, 3));
  const month = Number(nid.slice(3, 5));
  const day = Number(nid.slice(5, 7));
  const d = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || d.getUTCDate() !== day || d > today) return { valid: false, error: "تاريخ الميلاد في الرقم غير صحيح" };
  const govCode = nid.slice(7, 9);
  const governorate = GOV_CODES[govCode];
  if (!governorate) return { valid: false, error: "كود المحافظة في الرقم غير معروف" };
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age--;
  const gender = Number(nid[12]) % 2 === 1 ? "ذكر" : "أنثى";
  return { valid: true, birthDate: d.toISOString().slice(0, 10), age, governorate, gender };
}

/** رقم تليفون مصري: يرجّعه بصيغة 01xxxxxxxxx أو فاضي. */
export function normalizePhone(raw: unknown): string {
  let p = normalizeDigits(raw);
  if (p.startsWith("20") && p.length === 12) p = p.slice(2);
  if (p.length === 10 && p.startsWith("1")) p = "0" + p;
  return p;
}

export function isValidPhone(p: string): boolean {
  return /^01[0125]\d{8}$/.test(p);
}
