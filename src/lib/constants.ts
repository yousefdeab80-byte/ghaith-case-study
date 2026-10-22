import type { FeedbackQuestion } from "@/db/schema";

export const GOVERNORATES = [
  "القاهرة", "الجيزة", "القليوبية", "الإسكندرية", "البحيرة", "المنوفية", "الغربية", "كفر الشيخ", "الدقهلية", "دمياط",
  "الشرقية", "الإسماعيلية", "بورسعيد", "السويس", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر",
  "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء", "البحر الأحمر", "الوادي الجديد",
];

/** محافظات الدعم المباشر حسب سياسة النطاق الجغرافي. */
export const DIRECT_SUPPORT_GOVERNORATES = ["الجيزة", "الفيوم", "بني سويف", "الإسماعيلية", "القليوبية", "أسوان", "الشرقية"];

export const DEFAULT_LOOKUPS: Record<string, { label: string; values: string[] }> = {
  governorates: { label: "المحافظات", values: GOVERNORATES },
  marital: { label: "الحالة الاجتماعية", values: ["أرملة", "مطلقة", "متزوجة", "منفصلة", "الزوج مسجون", "أعزب/عزباء"] },
  incomeType: { label: "مصدر الدخل", values: ["لا يوجد", "تكافل وكرامة", "يوميات", "تأمينات ومعاشات", "موظف", "شهري", "مساعدات"] },
  health: { label: "الحالة الصحية", values: ["سليمة", "أمراض مزمنة", "عجز / عملية كبرى", "ضغط / سكر", "إعاقة", "تحتاج متابعة طبية"] },
  education: { label: "مستويات التعليم", values: ["أمي", "يقرأ ويكتب", "ابتدائي", "إعدادي", "ثانوي", "فوق متوسط", "جامعي"] },
  jobType: { label: "نوع الوظيفة", values: ["حكومية", "قطاع خاص", "عمل حر", "بدون عمل"] },
  workSector: { label: "طبيعة العمل", values: ["حكومي", "قطاع خاص", "عمالة غير منتظمة (عامل/صناعي/حرفي)", "صاحب مشروع صغير", "موسمي"] },
  roof: { label: "نوع السقف", values: ["خرسانة", "خشبية", "خشب متهالك", "بوص", "صاج", "بدون"] },
  recommendations: { label: "ترشيح التدخلات", values: ["سقف", "وصلة مياه", "شنط مدرسية", "بطاطين", "علاج – عمليات", "مشروع", "لحوم", "كرتونة رمضان", "وجبات الإفطار", "أضاحي العيد", "كساء"] },
};

export const STATUS_LABELS: Record<string, string> = {
  study: "قيد الدراسة",
  eligible: "مؤهلة للمساعدة",
  served: "تم التنفيذ",
  excluded: "مستبعدة",
};

export const PRIORITY_LABELS: Record<string, string> = { high: "مرتفعة", mid: "متوسطة", low: "منخفضة" };

export const FORM_TYPES = [
  { id: "general", label: "استمارة استكشاف مبادرات", desc: "الاستمارة الشاملة لكل المبادرات (بحث الحالة)" },
  { id: "shifa", label: "استمارة استكشاف مشروع شفاء", desc: "تضيف الجانب الطبي التفصيلي للحالات المرشحة للعلاج والعمليات" },
  { id: "zilal", label: "استمارة استكشاف مشروع ظلال", desc: "تضيف وصف المنزل والمقاسات لحالات الأسقف" },
] as const;
export type FormType = (typeof FORM_TYPES)[number]["id"];

export const ROLE_LABELS: Record<string, string> = {
  manager: "مدير القطاع",
  coordinator: "منسق القطاع",
  explorer: "باحث / مستكشف",
  caller: "مسؤول مكالمات",
  viewer: "مشاهدة فقط",
};

export const PERMISSIONS = [
  { key: "dashboard", label: "عرض لوحة التحكم" },
  { key: "cases.view", label: "عرض سجل الحالات" },
  { key: "cases.edit", label: "تسجيل وتعديل الحالات" },
  { key: "cases.status", label: "تغيير حالة الملف واستبعاد الحالات" },
  { key: "cases.delete", label: "حذف الحالات" },
  { key: "nominate", label: "ترشيح الحالات للمشروعات" },
  { key: "benefits", label: "سجل المساعدات المنفذة" },
  { key: "import", label: "استيراد وتصدير البيانات" },
  { key: "settings", label: "الإعدادات (مستخدمون، مشروعات، قوائم)" },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const all = (v: boolean) => Object.fromEntries(PERMISSIONS.map((p) => [p.key, v])) as Record<PermissionKey, boolean>;
export const DEFAULT_PERMISSIONS: Record<string, Record<PermissionKey, boolean>> = {
  manager: all(true),
  coordinator: { ...all(true), "cases.delete": false, settings: false },
  explorer: { ...all(false), dashboard: true, "cases.view": true, "cases.edit": true },
  caller: { ...all(false), dashboard: true, "cases.view": true },
  viewer: { ...all(false), dashboard: true, "cases.view": true },
};

const yes = (text: string, weight = 20): FeedbackQuestion => ({ id: "", text, type: "yesno_pos", weight });
const no = (text: string, weight = 20): FeedbackQuestion => ({ id: "", text, type: "yesno_neg", weight });
const scale = (text: string, weight = 20): FeedbackQuestion => ({ id: "", text, type: "scale", weight });
const q = (...items: FeedbackQuestion[]) => items.map((it, i) => ({ ...it, id: `q${i + 1}` }));
const MONEY = "فريق العمل طلب منك فلوس";

const GENERIC_QUESTIONS = q(
  yes("استلمت المساعدة"), scale("مدى تلبية المساعدة لاحتياج الأسرة"), scale("جودة المساعدة المقدمة"),
  scale("موعد استلام المساعدة"), no(MONEY),
);
const BOX_QUESTIONS = q(yes("استلمت الكرتونة"), scale("موعد وصول الكرتونة"), scale("محتويات الكرتونة"), scale("جودة تغليف الكرتونة"), no(MONEY));
const MEAL_QUESTIONS = q(yes("استلمت الوجبات"), scale("موعد وصول الوجبات"), scale("جودة الأكل"), scale("جودة التغليف"), no(MONEY));

export type ProjectSeed = {
  name: string; sector: string; rulesKey: string; minDaysBetweenBenefits?: number; requiredDocs?: string[];
  feedbackQuestions: FeedbackQuestion[]; sampleRatio?: string; impactAfterDays?: number; aliases?: string[];
};

const DOCS_HOUSING = [
  "صور بطاقة الزوج والزوجة", "البرنت التأميني للزوج والزوجة", "إيصالات المرافق", "عقد المنزل",
  "الحيازة الزراعية للزوج والزوجة", "البحث الاجتماعي", "صور شهادات ميلاد الأبناء",
];
const DOCS_SHIFA = [
  "صورة بطاقة الرقم القومي للزوج والزوجة", "برنت تأميني للزوج والزوجة", "حيازة زراعية للزوج والزوجة",
  "بحث اجتماعي للأسرة", "شهادات ميلاد الأبناء",
];

/** المشروعات والمبادرات الافتراضية. الأسئلة والأوزان من ملف "داش بورد استطلاع الرأي 2026". */
export const DEFAULT_PROJECTS: ProjectSeed[] = [
  { name: "ظلال", sector: "تكافل", rulesKey: "zilal", minDaysBetweenBenefits: 730, requiredDocs: DOCS_HOUSING, impactAfterDays: 90,
    feedbackQuestions: q(yes("تم تركيب السقف"), no("هل يوجد مشكلة بالسقف"), scale("هل يوجد تحسن بعد تركيب السقف"), no("هل حدثت مشكلة من فريق العمل"), no(MONEY)) },
  { name: "ارتواء", sector: "تكافل", rulesKey: "irtiwa", minDaysBetweenBenefits: 730, requiredDocs: DOCS_HOUSING, feedbackQuestions: GENERIC_QUESTIONS },
  { name: "سند", sector: "تكافل", rulesKey: "seasonal", feedbackQuestions: GENERIC_QUESTIONS },
  { name: "ارتقاء", sector: "تمكين", rulesKey: "irtiqa", requiredDocs: ["كارت الخدمات", "بطاقة الرقم القومي", "السيرة الذاتية"],
    feedbackQuestions: q(yes("حضرت منحة ارتقاء"), scale("قدر الاستفادة من المنحة"), scale("هل وجدت اختلاف في مجالك الوظيفي بعد المنحة"), no("هل كان يوجد صعوبة في طريقة استقبال محتوى المنحة"), no(MONEY)) },
  { name: "شفاء", sector: "تمكين", rulesKey: "shifa", requiredDocs: DOCS_SHIFA, feedbackQuestions: GENERIC_QUESTIONS },
  { name: "عمليات شفاء", sector: "تمكين", rulesKey: "shifa", requiredDocs: [...DOCS_SHIFA, "تقرير طبي معتمد"],
    feedbackQuestions: q(yes("العملية تمت"), yes("بتاخد الأدوية بانتظام"), no("يوجد ملاحظات بعد العملية"), no("يوجد أي مشكلة في العين"), no(MONEY)) },
  { name: "أدوية شفاء", sector: "تمكين", rulesKey: "shifa", requiredDocs: DOCS_SHIFA,
    feedbackQuestions: q(yes("استلمت الأدوية"), scale("هل الأدوية ساعدتك أو حسيت بتحسن"), yes("هل تم شرح طريقة استخدام الدواء", 10), yes("هل استلمت الأدوية كاملة", 10), scale("هل استفدت من الكشف"), no(MONEY)) },
  { name: "نظارات شفاء", sector: "تمكين", rulesKey: "shifa", requiredDocs: DOCS_SHIFA,
    feedbackQuestions: q(yes("استلمت النظارة"), no("هل يوجد مشكلة بالنظارة"), scale("هل يوجد تحسن بعد استخدام النظارة"), yes("الوقت كان مناسب بين الكشف واستلام النظارة", 10), yes("الفريق اللي سلمك النظارة كان تعاملهم كويس", 10), no(MONEY)) },
  { name: "كن لهم عوناً", sector: "مبادرة موسمية", rulesKey: "seasonal", minDaysBetweenBenefits: 180, feedbackQuestions: BOX_QUESTIONS, aliases: ["كن لهم عونناً", "كن لهم عونا"] },
  { name: "هنكمل فطارهم", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: q(yes("استلام الوجبة"), scale("موعد وصول الوجبات"), scale("جودة الأكل"), scale("جودة التغليف"), no(MONEY)) },
  { name: "زكاة الفطر", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: BOX_QUESTIONS, aliases: ["ذكاة الفطر", "ذكاه الفطر"] },
  { name: "فرحة بشنطة", sector: "مبادرة موسمية", rulesKey: "schoolbag", minDaysBetweenBenefits: 300, feedbackQuestions: GENERIC_QUESTIONS },
  { name: "دفء", sector: "مبادرة موسمية", rulesKey: "dafa", minDaysBetweenBenefits: 300, feedbackQuestions: GENERIC_QUESTIONS },
  { name: "أضاحي العيد", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: GENERIC_QUESTIONS, aliases: ["أضاحي", "اضاحي"] },
  { name: "إطعام عرفة", sector: "مبادرة موسمية", rulesKey: "seasonal",
    feedbackQuestions: q(yes("استلمت الوجبات"), scale("موعد وصول الوجبات"), scale("جودة الأكل"), scale("تغليف الأكل"), no(MONEY, 10), no("هل حدثت أي مشكلة أثناء تسليم الوجبات", 10)), aliases: ["اطعام عرفة"] },
  { name: "مطبخ غيث", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: MEAL_QUESTIONS },
  { name: "معرض كساء", sector: "مبادرة موسمية", rulesKey: "seasonal",
    feedbackQuestions: q(yes("استلمت الملابس"), scale("موعد المعرض"), scale("جودة الملابس"), no("هل كان يوجد صعوبة في الدخول والخروج"), no(MONEY)), aliases: ["معرض الكساء"] },
  { name: "كساء عيد الأضحى", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: GENERIC_QUESTIONS, aliases: ["كساء عيد الاضحى", "كساء عيد الاضحي"] },
  { name: "فليتنافس المتنافسون", sector: "مبادرة موسمية", rulesKey: "seasonal", feedbackQuestions: GENERIC_QUESTIONS },
];

/** أرقام تاريخية 2023–2026 من سجلات المؤسسة (منقولة من السستم المرجعي). */
export const HISTORICAL_STATS = {
  totalAid: 54123,
  totalBeneficiaries: 102739,
  byYearAid: { "2023": 8780, "2024": 8185, "2025": 18005, "2026": 19153 } as Record<string, number>,
  byYearBeneficiaries: { "2023": 26238, "2024": 26839, "2025": 26449, "2026": 23213 } as Record<string, number>,
  byGovernorateAid: { "الجيزة": 25858, "الفيوم": 6376, "القاهرة": 5204, "الإسماعيلية": 4270, "القليوبية": 3932, "أسوان": 3002, "المنوفية": 1752, "بني سويف": 1534, "الشرقية": 924, "أسيوط": 864 } as Record<string, number>,
  byProjectAid: { "هنكمل فطارهم": 28644, "كن لهم عوناً": 10832, "فرحة بشنطة": 2700, "مطبخ غيث": 2429, "إطعام عرفة": 1919, "شفاء": 1733, "دفء": 1556, "أضاحي العيد": 1072, "أدوية شفاء": 1009, "كساء عيد الأضحى": 742, "نظارات شفاء": 720, "ظلال": 323, "فليتنافس المتنافسون": 273, "ارتقاء": 59, "زكاة الفطر": 59, "عمليات شفاء": 53 } as Record<string, number>,
};

/** مصدر تسجيل الملف في سجل الحالات. */
export const SOURCE_LABELS: Record<string, string> = {
  manual: "تسجيل يدوي (استمارة)",
  import: "استيراد ملف حالات",
  benefits: "من سجل المساعدات المنفذة",
};
