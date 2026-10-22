/**
 * كتالوج حقول استمارات الاستكشاف. نفس التعريف بيستخدم في: الإدخال بالأسئلة، تعديل الحالة،
 * حساب اكتمال البيانات، وربط أعمدة الإكسل وقت الاستيراد.
 */
import type { FormType } from "./constants";

export type FieldType = "text" | "number" | "date" | "select" | "multi" | "yesno" | "textarea" | "nid" | "phone" | "members";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  /** قائمة ثابتة أو مفتاح قائمة من الإعدادات (lookup:xxx) */
  options?: string[] | `lookup:${string}`;
  /** الحقل عمود في جدول الحالات؛ غير كده بيتخزن في details */
  column?: boolean;
  forms?: FormType[];
  /** يظهر بس لما حقل تاني قيمته كذا */
  showIf?: { key: string; equals: string | string[] };
  /** داخل في حساب اكتمال البيانات */
  core?: boolean;
  required?: boolean;
  hint?: string;
  /** أسماء أعمدة بديلة في ملفات الإكسل القديمة */
  aliases?: string[];
};

export type Section = { id: string; title: string; forms?: FormType[]; fields: Field[] };

const YN = ["نعم", "لا"];
const NEED = ["نعم تستدعي", "لا تستدعي"];
const COND = ["لا يوجد", "جيدة", "قديمة", "معطلة"];

export const SECTIONS: Section[] = [
  {
    id: "exploration", title: "بيانات الاستكشاف",
    fields: [
      { key: "explorerName", label: "اسم المستكشف", type: "text", column: true, core: true, aliases: ["المستكشف", "اسم الباحث"] },
      { key: "guideName", label: "اسم الدليل المرافق", type: "text", column: true, core: true, aliases: ["الدليل", "اسم الدليل"] },
      { key: "exploredAt", label: "تاريخ الاستكشاف", type: "date", column: true, aliases: ["التاريخ", "تاريخ البحث"] },
      { key: "sheetSerial", label: "رقم المسلسل بالكشف", type: "text", aliases: ["م", "مسلسل", "رقم المسلسل"] },
    ],
  },
  {
    id: "head", title: "بيانات رب الأسرة والزوجة",
    fields: [
      { key: "headName", label: "اسم الحالة (رب الأسرة)", type: "text", column: true, required: true, core: true, aliases: ["الاسم", "اسم الحالة", "اسم الزوج", "اسم رب الأسرة", "اسم المستفيد"] },
      { key: "headNid", label: "الرقم القومي", type: "nid", column: true, core: true, aliases: ["الرقم القومي", "رقم قومي", "الرقم القومى", "رقم البطاقة", "الرقم القومي للزوج"] },
      { key: "phone", label: "رقم التليفون", type: "phone", column: true, core: true, aliases: ["التليفون", "رقم التليفون", "الموبايل", "رقم الهاتف", "تليفون"] },
      { key: "phone2", label: "رقم تليفون آخر", type: "phone", column: true, aliases: ["تليفون آخر", "رقم آخر"] },
      { key: "maritalStatus", label: "الحالة الاجتماعية", type: "select", options: "lookup:marital", column: true, core: true, aliases: ["الحالة الاجتماعية", "الحالة الزوجية", "الحالة الاجتماعيه"] },
      { key: "headAge", label: "سن رب الأسرة", type: "number", aliases: ["السن"] },
      { key: "headEducation", label: "المؤهل", type: "select", options: "lookup:education", aliases: ["المؤهل", "التعليم"] },
      { key: "headJobType", label: "نوع وظيفة الأب", type: "select", options: "lookup:jobType", aliases: ["الوظيفة", "المهنة"] },
      { key: "headIncome", label: "دخل الأب الشهري", type: "number" },
      { key: "wifeName", label: "اسم الزوجة", type: "text", column: true, aliases: ["اسم الزوجة", "الزوجة"] },
      { key: "wifeNid", label: "الرقم القومي للزوجة", type: "nid", column: true, aliases: ["الرقم القومي للزوجة", "رقم قومي الزوجة"] },
      { key: "wifeAge", label: "سن الزوجة", type: "number" },
      { key: "wifeJobType", label: "نوع وظيفة الأم", type: "select", options: "lookup:jobType" },
      { key: "wifeIncome", label: "دخل الأم الشهري", type: "number" },
    ],
  },
  {
    id: "address", title: "العنوان",
    fields: [
      { key: "governorate", label: "المحافظة", type: "select", options: "lookup:governorates", column: true, core: true, aliases: ["المحافظة", "المحافظه"] },
      { key: "markaz", label: "المركز", type: "text", column: true, core: true, aliases: ["المركز", "مركز"] },
      { key: "village", label: "القرية", type: "text", column: true, core: true, aliases: ["القرية", "القريه", "العزبة"] },
      { key: "address", label: "العنوان بالتفصيل", type: "text", column: true, aliases: ["العنوان", "العنوان بالتفصيل"] },
    ],
  },
  {
    id: "family", title: "الأسرة",
    fields: [
      { key: "familySize", label: "عدد أفراد الأسرة", type: "number", column: true, core: true, aliases: ["عدد الأفراد", "عدد افراد الاسرة", "عدد أفراد الأسرة", "عدد الافراد"] },
      { key: "childrenCount", label: "عدد الأبناء", type: "number", column: true, core: true, aliases: ["عدد الأبناء", "عدد الابناء", "الأبناء"] },
      { key: "members", label: "أفراد الأسرة", type: "members", hint: "الاسم، صلة القرابة، السن، الحالة التعليمية أو الوظيفة" },
    ],
  },
  {
    id: "income", title: "الدخل والمصروفات",
    fields: [
      { key: "incomeType", label: "مصدر الدخل الأساسي", type: "select", options: "lookup:incomeType", column: true, core: true, aliases: ["الدخل", "مصدر الدخل", "نوع الدخل"] },
      { key: "workSector", label: "طبيعة العمل", type: "select", options: "lookup:workSector" },
      { key: "workDays", label: "أيام العمل في الأسبوع", type: "number", showIf: { key: "incomeType", equals: "يوميات" } },
      { key: "dailyWage", label: "اليومية (جنيه)", type: "number", showIf: { key: "incomeType", equals: "يوميات" } },
      { key: "otherSources", label: "مصادر دخل أخرى", type: "multi", options: ["معاش تأميني", "تكافل وكرامة", "مساعدات جمعيات", "مساعدات أقارب"] },
      { key: "otherSourcesAmount", label: "قيمة مصادر الدخل الأخرى", type: "number" },
      { key: "totalIncome", label: "إجمالي الدخل الشهري", type: "number", column: true, core: true, aliases: ["إجمالي الدخل", "اجمالي الدخل", "الدخل الشهري"] },
      { key: "rent", label: "الإيجار", type: "number" },
      { key: "utilities", label: "المرافق (كهرباء/مياه/غاز)", type: "number" },
      { key: "treatment", label: "العلاج", type: "number" },
      { key: "lessons", label: "الدروس والتعليم", type: "number" },
      { key: "monthlyFoodCost", label: "الأكل الشهري", type: "number" },
      { key: "debt", label: "ديون / أقساط / جمعيات", type: "number" },
      { key: "totalExpenses", label: "إجمالي المصروفات الشهرية", type: "number", column: true, core: true, aliases: ["إجمالي المصروفات", "اجمالي المصروفات", "المصروفات"] },
      { key: "govFood", label: "بيصرف تموين؟", type: "yesno", options: YN },
      { key: "smoker", label: "حد في الأسرة بيدخن؟", type: "yesno", options: YN },
    ],
  },
  {
    id: "housing", title: "السكن",
    fields: [
      { key: "homeOwnership", label: "ملكية المنزل", type: "select", options: ["ملك", "إيجار", "مشاركة مع الأهل"] },
      { key: "roofType", label: "الأسقف", type: "select", options: "lookup:roof", column: true, core: true, aliases: ["السقف", "الأسقف", "نوع السقف"] },
      { key: "roofNeed", label: "الأسقف تستدعي تدخل؟", type: "yesno", options: NEED },
      { key: "roofsCount", label: "عدد الأسقف المطلوبة", type: "number", showIf: { key: "roofNeed", equals: "نعم تستدعي" } },
      { key: "waterConnection", label: "وصلة المياه", type: "select", options: ["رسمية", "أهالي", "بدون"] },
      { key: "waterNeed", label: "وصلة المياه تستدعي تدخل؟", type: "yesno", options: NEED },
      { key: "electricity", label: "الكهرباء", type: "select", options: ["عداد", "ممارسة", "بدون"] },
      { key: "electricityNeed", label: "الكهرباء تستدعي تدخل؟", type: "yesno", options: NEED },
      { key: "propertyDispute", label: "في نزاع على ملكية العقار؟", type: "yesno", options: YN },
      { key: "permanentResidence", label: "الأسرة مقيمة في المنزل إقامة دائمة؟", type: "yesno", options: YN },
      { key: "walls", label: "الحوائط", type: "multi", options: ["طوب", "محارة"] },
      { key: "possessions", label: "الممتلكات", type: "multi", options: ["مواشي", "محل / كشك", "موتوسيكل", "عربية كارو", "تروسيكل", "عقار", "أرض زراعية", "أملاك متوارثة"] },
      { key: "hasTouchPhones", label: "في تليفونات ذكية في الأسرة؟", type: "yesno", options: YN },
      { key: "hasRouter", label: "في راوتر إنترنت في البيت؟", type: "yesno", options: YN },
      { key: "fridgeCondition", label: "الثلاجة", type: "select", options: COND },
      { key: "washerCondition", label: "الغسالة", type: "select", options: COND },
      { key: "stoveCondition", label: "البوتاجاز", type: "select", options: COND },
    ],
  },
  {
    id: "zilal", title: "وصف المنزل (ظلال)", forms: ["zilal"],
    fields: [
      { key: "buildNature", label: "طبيعة البناء", type: "select", options: ["طوب ني", "طوب أحمر", "طوب أبيض"] },
      { key: "room1", label: "مقاس الغرفة 1", type: "text" },
      { key: "room2", label: "مقاس الغرفة 2", type: "text" },
      { key: "room3", label: "مقاس الغرفة 3", type: "text" },
      { key: "bathroomSize", label: "مقاس الحمام", type: "text" },
      { key: "kitchenSize", label: "مقاس المطبخ", type: "text" },
      { key: "doors", label: "الأبواب المطلوبة ومقاساتها", type: "text" },
      { key: "windows", label: "الشبابيك المطلوبة ومقاساتها", type: "text" },
      { key: "houseDescription", label: "وصف حالة المنزل", type: "textarea" },
      { key: "governmentApproval", label: "موافقة الجهات الحكومية على الإحلال؟", type: "yesno", options: YN },
      { key: "needsFullRebuild", label: "المنزل محتاج هدم وبناء كامل؟", type: "yesno", options: YN },
    ],
  },
  {
    id: "health", title: "الحالة الصحية",
    fields: [
      { key: "healthStatus", label: "الحالة الصحية العامة", type: "select", options: "lookup:health", column: true, core: true, aliases: ["الحالة الصحية", "الحاله الصحيه", "الصحة"] },
      { key: "hypertension", label: "حد عنده ضغط؟", type: "yesno", options: YN },
      { key: "diabetes", label: "حد عنده سكر؟", type: "yesno", options: YN },
      { key: "heartDisease", label: "أمراض القلب والأوعية الدموية", type: "yesno", options: YN },
      { key: "disabledMember", label: "في حد من ذوي الهمم؟", type: "yesno", options: YN },
      { key: "psychIllness", label: "في حد بيعاني من أمراض نفسية؟", type: "yesno", options: YN },
      { key: "monthlyMeds", label: "في حد محتاج علاج شهري؟", type: "yesno", options: YN },
      { key: "pendingSurgery", label: "في حد محتاج عملية مؤجلة؟", type: "yesno", options: YN },
      { key: "medsNames", label: "أسماء الأدوية / أمراض أخرى", type: "textarea" },
    ],
  },
  {
    id: "shifa", title: "البيانات الطبية (شفاء)", forms: ["shifa"],
    fields: [
      { key: "patientName", label: "اسم المريض", type: "text" },
      { key: "operationType", label: "نوع التدخل", type: "select", options: ["كشف رمد", "عملية مياه بيضاء", "عملية عيون أخرى", "نظارة", "أدوية"] },
      { key: "hasMedicalReport", label: "في تقرير طبي معتمد؟", type: "yesno", options: YN },
      { key: "hasHealthInsurance", label: "عنده تأمين صحي؟", type: "yesno", options: YN },
      { key: "diabetesRegular", label: "السكر منتظم؟", type: "yesno", options: YN },
      { key: "lastSugarValue", label: "آخر قراءة سكر", type: "text" },
      { key: "bloodThinners", label: "بياخد مسيلات دم؟", type: "yesno", options: YN },
      { key: "chestAllergy", label: "حساسية صدر؟", type: "yesno", options: YN },
      { key: "priorEyeSurgery", label: "عمل عملية عين قبل كده؟", type: "yesno", options: YN },
      { key: "medAllergy", label: "حساسية من أدوية أو بنج؟", type: "yesno", options: YN },
      { key: "eyeDrops", label: "بيستخدم قطرة؟", type: "text" },
      { key: "medicalContraindication", label: "في موانع طبية للعملية؟", type: "yesno", options: YN },
    ],
  },
  {
    id: "needs", title: "الملابس والأثاث",
    fields: [
      { key: "clothesCondition", label: "حالة الملابس", type: "select", options: ["ممتازة", "جيدة جداً", "جيدة", "مقبولة", "سيئة"] },
      { key: "needBeds", label: "محتاجين أسِرّة؟", type: "yesno", options: YN },
      { key: "needBlankets", label: "محتاجين بطاطين؟", type: "yesno", options: YN },
      { key: "blanketsCount", label: "عدد البطاطين الموجودة", type: "number" },
      { key: "needAppliances", label: "محتاجين أجهزة كهربائية؟", type: "yesno", options: YN },
    ],
  },
  {
    id: "otherOrgs", title: "الاتصال بجمعيات أو مؤسسات أخرى",
    fields: [
      { key: "otherOrgName", label: "اسم الجهة", type: "text" },
      { key: "otherOrgLastContact", label: "تاريخ آخر اتصال", type: "date" },
      { key: "otherOrgSupport", label: "نوع الدعم المقدم", type: "text" },
    ],
  },
  {
    id: "opinion", title: "رأي المستكشف والترشيح",
    fields: [
      { key: "explorationNotes", label: "رأي المستكشف وملاحظاته", type: "textarea", aliases: ["ملاحظات", "رأي المستكشف"] },
      { key: "recommendations", label: "ترشيح التدخلات", type: "multi", options: "lookup:recommendations", column: true, aliases: ["الترشيح", "ترشيح", "التدخل المطلوب"] },
      { key: "acceptance", label: "قرار المستكشف", type: "select", options: ["مقبول", "مرفوض", "يحتاج مراجعة"] },
      { key: "guideApproved", label: "إقرار الدليل باستحقاق الحالة", type: "yesno", options: YN, column: true },
      { key: "explorerApproved", label: "إقرار فريق الاستكشاف باستحقاق الحالة", type: "yesno", options: YN, column: true },
    ],
  },
];

export function sectionsFor(form: string): Section[] {
  return SECTIONS.filter((s) => !s.forms || s.forms.includes(form as FormType));
}

export const ALL_FIELDS: Field[] = SECTIONS.flatMap((s) => s.fields);
export const FIELD_BY_KEY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f])) as Record<string, Field>;

export function isVisible(field: Field, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const v = values[field.showIf.key];
  const eq = field.showIf.equals;
  return Array.isArray(eq) ? eq.includes(String(v)) : String(v ?? "") === eq;
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** نسبة اكتمال البيانات الأساسية والحقول الناقصة. */
export function completeness(values: Record<string, unknown>): { percent: number; missing: string[] } {
  const core = ALL_FIELDS.filter((f) => f.core);
  const missing = core.filter((f) => isEmpty(values[f.key])).map((f) => f.label);
  return { percent: Math.round(((core.length - missing.length) / core.length) * 100), missing };
}
