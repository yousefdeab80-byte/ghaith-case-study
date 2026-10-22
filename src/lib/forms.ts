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
  /** ياخد عرض السطر كله */
  wide?: boolean;
  /** إجمالي محسوب من حقول تانية (بيظهر كاقتراح جنب الحقل): key × times × factor */
  sumOf?: { key: string; times?: string; factor?: number }[];
};

export type Section = { id: string; title: string; forms?: FormType[]; fields: Field[]; optional?: boolean };

/** مجموع حقول sumOf، أو null لو مفيش ولا قيمة متسجلة. */
export function computeSum(field: Field, values: Record<string, unknown>): number | null {
  if (!field.sumOf) return null;
  const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  let total = 0, any = false;
  for (const p of field.sumOf) {
    const v = num(values[p.key]);
    if (v === null) continue;
    const t = p.times ? num(values[p.times]) : 1;
    if (t === null) continue;
    total += v * t * (p.factor ?? 1);
    any = true;
  }
  return any ? Math.round(total) : null;
}

const YN = ["نعم", "لا"];
const COND = ["لا يوجد", "جيدة", "قديمة", "معطلة"];
const ALL_BUT_SHIFA: FormType[] = ["general", "zilal"];

/*
 * الأقسام بنفس ترتيب ومسميات استمارات الاستكشاف الورقية (مبادرات، شفاء، ظلال)،
 * عشان اللي بيدخل البيانات يمشي على الورقة من فوق لتحت. الحقول اللي مش في الورق
 * (بس السستم محتاجها أو اتسجلت قبل كده) في آخر قسم "بيانات إضافية".
 */
export const SECTIONS: Section[] = [
  {
    id: "personal", title: "بيانات شخصية",
    fields: [
      { key: "exploredAt", label: "تاريخ الاستكشاف", type: "date", column: true, aliases: ["التاريخ", "تاريخ البحث"] },
      { key: "headName", label: "اسم الزوج (رب الأسرة)", type: "text", column: true, required: true, core: true, aliases: ["الاسم", "اسم الحالة", "اسم الزوج", "اسم رب الأسرة", "اسم المستفيد"] },
      { key: "headNid", label: "الرقم القومي", type: "nid", column: true, core: true, aliases: ["الرقم القومي", "رقم قومي", "الرقم القومى", "رقم البطاقة", "الرقم القومي للزوج"] },
      { key: "headEducation", label: "التعليم", type: "select", options: "lookup:education", aliases: ["المؤهل", "التعليم"] },
      { key: "headAge", label: "السن", type: "number", aliases: ["السن"], hint: "بيتحسب لوحده من الرقم القومي لو سبته فاضي" },
      { key: "wifeName", label: "اسم الزوجة", type: "text", column: true, aliases: ["اسم الزوجة", "الزوجة"] },
      { key: "wifeNid", label: "الرقم القومي للزوجة", type: "nid", column: true, aliases: ["الرقم القومي للزوجة", "رقم قومي الزوجة"] },
      { key: "village", label: "القرية", type: "text", column: true, core: true, aliases: ["القرية", "القريه", "العزبة"] },
      { key: "markaz", label: "المركز", type: "text", column: true, core: true, aliases: ["المركز", "مركز"] },
      { key: "governorate", label: "المحافظة", type: "select", options: "lookup:governorates", column: true, core: true, aliases: ["المحافظة", "المحافظه"] },
      { key: "address", label: "العنوان بالتفصيل", type: "text", column: true, wide: true, aliases: ["العنوان", "العنوان بالتفصيل"] },
      { key: "maritalStatus", label: "الحالة الاجتماعية", type: "select", options: "lookup:marital", column: true, core: true, aliases: ["الحالة الاجتماعية", "الحالة الزوجية", "الحالة الاجتماعيه"] },
      { key: "healthStatus", label: "الحالة الصحية", type: "select", options: "lookup:health", column: true, core: true, aliases: ["الحالة الصحية", "الحاله الصحيه", "الصحة"] },
      { key: "phone", label: "رقم التليفون", type: "phone", column: true, core: true, aliases: ["التليفون", "رقم التليفون", "الموبايل", "رقم الهاتف", "تليفون"] },
    ],
  },
  {
    id: "family", title: "أفراد الأسرة",
    fields: [
      { key: "familySize", label: "عدد أفراد المنزل", type: "number", column: true, core: true, aliases: ["عدد الأفراد", "عدد افراد الاسرة", "عدد أفراد الأسرة", "عدد الافراد", "عدد أفراد المنزل"] },
      { key: "childrenCount", label: "عدد الأبناء", type: "number", column: true, core: true, aliases: ["عدد الأبناء", "عدد الابناء", "الأبناء"], hint: "بيتحسب من جدول الأفراد لو سبته فاضي" },
      { key: "members", label: "أفراد الأسرة", type: "members", hint: "الاسم، الصلة، السن، النوع، المرحلة التعليمية، وهل عنده شنطة مدرسة" },
      { key: "needsBag", label: "يحتاج شنطة؟", type: "yesno", options: YN },
      { key: "needsBagNames", label: "أسماء اللي محتاجين شنطة", type: "text", showIf: { key: "needsBag", equals: "نعم" } },
      { key: "hasDisease", label: "هل توجد أمراض؟", type: "yesno", options: YN },
      { key: "diseasePerson", label: "اسم المريض", type: "text", showIf: { key: "hasDisease", equals: "نعم" } },
      { key: "diseaseType", label: "نوع المرض", type: "text", showIf: { key: "hasDisease", equals: "نعم" } },
    ],
  },
  {
    id: "economic", title: "الجانب الاقتصادي",
    fields: [
      { key: "headWorks", label: "طبيعة العمل", type: "yesno", options: ["يعمل", "لا يعمل"] },
      { key: "workSector", label: "نوع العمل", type: "select", options: "lookup:workSector", showIf: { key: "headWorks", equals: "يعمل" } },
      { key: "workDays", label: "عدد أيام العمل خلال الأسبوع", type: "number", showIf: { key: "headWorks", equals: "يعمل" } },
      { key: "dailyWage", label: "قيمة اليومية (جنيه)", type: "number", showIf: { key: "headWorks", equals: "يعمل" } },
      { key: "incomeType", label: "مصدر الدخل الأساسي", type: "select", options: "lookup:incomeType", column: true, core: true, aliases: ["الدخل", "مصدر الدخل", "نوع الدخل"] },
      { key: "otherSources", label: "مصادر أخرى", type: "multi", options: ["معاش تأميني", "تكافل وكرامة", "مساعدات جمعيات", "مساعدات أقارب"] },
      { key: "otherSourcesAmount", label: "قيمة المصادر الأخرى (جنيه)", type: "number" },
      { key: "memberWorks", label: "هل يعمل أحد أفراد الأسرة؟", type: "yesno", options: YN },
      { key: "memberWorkName", label: "الاسم", type: "text", showIf: { key: "memberWorks", equals: "نعم" } },
      { key: "memberWorkJob", label: "الوظيفة", type: "text", showIf: { key: "memberWorks", equals: "نعم" } },
      { key: "memberWorkIncome", label: "الدخل (جنيه)", type: "number", showIf: { key: "memberWorks", equals: "نعم" } },
      { key: "govFood", label: "الغذاء: تموين حكومي", type: "yesno", options: YN },
      { key: "ngoFood", label: "الغذاء: تموين جمعيات", type: "yesno", options: YN },
    ],
  },
  {
    id: "expenses", title: "النفقات والالتزامات الشهرية",
    fields: [
      { key: "rent", label: "إيجار", type: "number" },
      { key: "utilities", label: "مرافق", type: "number" },
      { key: "treatment", label: "علاج", type: "number" },
      { key: "lessons", label: "دروس", type: "number" },
      { key: "monthlyFoodCost", label: "مبلغ الغذاء الشهري المستهلك", type: "number" },
      { key: "smoker", label: "رب الأسرة مدخن؟", type: "yesno", options: YN },
      { key: "smokeCount", label: "عدد السجاير / العلب", type: "text", showIf: { key: "smoker", equals: "نعم" } },
      { key: "installment", label: "قسط", type: "number" },
      { key: "savingsCircle", label: "جمعية", type: "number" },
      { key: "debt", label: "دين", type: "number" },
      { key: "otherObligations", label: "مصادر أخرى (التزامات)", type: "number" },
      {
        key: "totalIncome", label: "إجمالي الدخل", type: "number", column: true, core: true, aliases: ["إجمالي الدخل", "اجمالي الدخل", "الدخل الشهري"],
        sumOf: [{ key: "dailyWage", times: "workDays", factor: 4 }, { key: "otherSourcesAmount" }, { key: "memberWorkIncome" }],
      },
      {
        key: "totalExpenses", label: "إجمالي النفقات", type: "number", column: true, core: true, aliases: ["إجمالي المصروفات", "اجمالي المصروفات", "المصروفات", "إجمالي النفقات"],
        sumOf: ["rent", "utilities", "treatment", "lessons", "monthlyFoodCost", "installment", "savingsCircle", "debt", "otherObligations"].map((key) => ({ key })),
      },
    ],
  },
  {
    id: "property", title: "الأملاك وحالة المنزل",
    fields: [
      { key: "possessions", label: "الأملاك", type: "multi", options: ["مواشي", "محل / كشك", "موتوسيكل", "عربية كارو", "تروسيكل", "عقار", "أرض زراعية", "أملاك متوارثة"] },
      { key: "homeOwnership", label: "ملكية المنزل", type: "yesno", options: ["إيجار", "ملك"] },
      { key: "walls", label: "الحوائط", type: "multi", options: ["طوب", "محارة"] },
      { key: "finishes", label: "التشطيبات", type: "multi", options: ["دهان", "سيراميك", "عمدان خرسانة"] },
      { key: "roofType", label: "السقف", type: "select", options: "lookup:roof", column: true, core: true, aliases: ["السقف", "الأسقف", "نوع السقف"] },
    ],
  },
  {
    id: "houseDescription", title: "بيانات وصف المنزل", forms: ["zilal"],
    fields: [
      { key: "houseDescription", label: "وصف كامل المنزل", type: "textarea" },
      { key: "room1Desc", label: "وصف غرفة 1", type: "text" },
      { key: "room2Desc", label: "وصف غرفة 2", type: "text" },
      { key: "room3Desc", label: "وصف غرفة 3", type: "text" },
      { key: "room4Desc", label: "وصف غرفة 4", type: "text" },
      { key: "hallDesc", label: "وصف الصالة", type: "text" },
      { key: "bathroomDesc", label: "وصف الحمام", type: "text" },
      { key: "kitchenDesc", label: "وصف المطبخ", type: "text" },
      { key: "floorsDesc", label: "وصف أرضيات المنزل", type: "text" },
      { key: "hasTouchPhones", label: "هل يوجد تليفونات تاتش؟", type: "yesno", options: YN },
      { key: "touchPhonesCount", label: "عدد التليفونات التاتش", type: "number", showIf: { key: "hasTouchPhones", equals: "نعم" } },
      { key: "hasRouter", label: "هل يوجد راوتر نت في المنزل؟", type: "yesno", options: YN },
      { key: "fridgeCondition", label: "ثلاجة", type: "yesno", options: COND },
      { key: "washerCondition", label: "غسالة", type: "yesno", options: COND },
      { key: "stoveCondition", label: "بوتاجاز", type: "yesno", options: COND },
      { key: "tvCondition", label: "تليفزيون", type: "yesno", options: COND },
      { key: "fanCondition", label: "مروحة", type: "yesno", options: COND },
      { key: "furnitureDesc", label: "وصف أثاث المنزل", type: "textarea" },
    ],
  },
  {
    id: "shifa", title: "الجانب الصحي", forms: ["shifa"],
    fields: [
      { key: "patientName", label: "اسم الحالة التي تحتاج إلى عملية", type: "text" },
      { key: "operationType", label: "نوع العملية", type: "select", options: ["كشف رمد", "عملية مياه بيضاء", "عملية عيون أخرى", "نظارة", "أدوية"] },
      { key: "diabetes", label: "هل في مرض السكر؟", type: "yesno", options: YN },
      { key: "diabetesRegular", label: "هل مرض السكر منتظم؟", type: "yesno", options: YN, showIf: { key: "diabetes", equals: "نعم" } },
      { key: "lastSugarValue", label: "درجة آخر تحليل سكر تراكمي", type: "text", showIf: { key: "diabetes", equals: "نعم" } },
      { key: "lastSugarDate", label: "موعد آخر تحليل سكر", type: "date", showIf: { key: "diabetes", equals: "نعم" } },
      { key: "hypertension", label: "هل الحالة تعاني من ارتفاع ضغط الدم؟", type: "yesno", options: YN },
      { key: "bpMedsRegular", label: "بتاخد علاج الضغط بانتظام؟", type: "yesno", options: YN, showIf: { key: "hypertension", equals: "نعم" } },
      { key: "lastBpDate", label: "آخر معاد تم قياس الضغط", type: "date", showIf: { key: "hypertension", equals: "نعم" } },
      { key: "heartDisease", label: "هل في أي مشاكل في القلب؟", type: "yesno", options: YN },
      { key: "bloodThinners", label: "بتاخد أي أدوية لسيولة الدم؟", type: "yesno", options: YN },
      { key: "bloodThinnersType", label: "نوع دواء السيولة", type: "text", showIf: { key: "bloodThinners", equals: "نعم" } },
      { key: "chestAllergy", label: "هل عندك حساسية على الصدر؟", type: "yesno", options: YN },
      { key: "persistentCough", label: "هل في كحة مستمرة أو شديدة؟", type: "yesno", options: YN },
      { key: "tremor", label: "هل بتعاني من أي رعشة في الجسم؟", type: "yesno", options: YN },
      { key: "prostateMeds", label: "لو الحالة رجل: بتاخد أدوية لتضخم البروستاتا؟", type: "yesno", options: YN },
      { key: "prostateMedType", label: "نوع دواء البروستاتا", type: "text", showIf: { key: "prostateMeds", equals: "نعم" } },
      { key: "priorEyeSurgery", label: "هل عملت أي عملية في عينك قبل كده؟", type: "yesno", options: YN },
      { key: "priorEyeSurgeryType", label: "نوع عملية العين", type: "text", showIf: { key: "priorEyeSurgery", equals: "نعم" } },
      { key: "medAllergy", label: "هل عندك حساسية من أي نوع دواء معين؟", type: "yesno", options: YN },
      { key: "medAllergyType", label: "نوع الدواء", type: "text", showIf: { key: "medAllergy", equals: "نعم" } },
      { key: "anesthesiaAllergy", label: "هل عندك حساسية من البنج (التخدير)؟", type: "yesno", options: YN },
      { key: "usesEyeDrops", label: "هل بتستخدم أي قطرات للعين حالياً؟", type: "yesno", options: YN },
      { key: "eyeDrops", label: "نوع القطرة", type: "text", showIf: { key: "usesEyeDrops", equals: "نعم" } },
    ],
  },
  {
    id: "initiatives", title: "بيانات خاصة بالمبادرات والمشاريع", forms: ALL_BUT_SHIFA,
    fields: [
      { key: "hasBlankets", label: "دفء: هل يوجد بطاطين بالمنزل؟", type: "yesno", options: YN },
      { key: "blanketsCount", label: "عدد البطاطين", type: "number", showIf: { key: "hasBlankets", equals: "نعم" } },
      { key: "roofNeed", label: "ظلال: الاحتياج لأسقف", type: "yesno", options: YN },
      { key: "roofsCount", label: "عدد الأسقف", type: "number", showIf: { key: "roofNeed", equals: ["نعم", "نعم تستدعي"] } },
      { key: "buildNature", label: "طبيعة البناء", type: "yesno", options: ["طوب ني", "طوب أحمر", "طوب أبيض"] },
      { key: "room1", label: "مقاس سقف غرفة 1", type: "text" },
      { key: "room2", label: "مقاس سقف غرفة 2", type: "text" },
      { key: "room3", label: "مقاس سقف غرفة 3", type: "text" },
      { key: "room4", label: "مقاس سقف غرفة 4", type: "text" },
      { key: "bathroomSize", label: "مقاس الحمام", type: "text" },
      { key: "kitchenSize", label: "مقاس المطبخ", type: "text" },
      { key: "door1", label: "مقاس باب 1", type: "text" },
      { key: "door2", label: "مقاس باب 2", type: "text" },
      { key: "door3", label: "مقاس باب 3", type: "text" },
      { key: "window1", label: "مقاس شباك 1", type: "text" },
      { key: "window2", label: "مقاس شباك 2", type: "text" },
      { key: "window3", label: "مقاس شباك 3", type: "text" },
      { key: "waterNeed", label: "ارتواء: الاحتياج لوصلة مياه", type: "yesno", options: YN, forms: ["general"] },
      { key: "waterDistance", label: "بعد المنزل عن مصدر المياه", type: "text", forms: ["general"], showIf: { key: "waterNeed", equals: ["نعم", "نعم تستدعي"] } },
    ],
  },
  {
    id: "opinion", title: "ملاحظات الاستكشاف",
    fields: [
      { key: "explorationNotes", label: "رأي المستكشف", type: "textarea", aliases: ["ملاحظات", "رأي المستكشف"] },
      { key: "recommendations", label: "الترشيحات", type: "multi", options: "lookup:recommendations", column: true, forms: ALL_BUT_SHIFA, aliases: ["الترشيح", "ترشيح", "التدخل المطلوب", "الترشيحات"] },
      { key: "explorerName", label: "اسم المستكشف", type: "text", column: true, core: true, aliases: ["المستكشف", "اسم الباحث", "اسم المستكشف"] },
      { key: "acceptance", label: "القرار", type: "yesno", options: ["مقبول", "مرفوض"] },
    ],
  },
  {
    id: "extra", title: "بيانات إضافية (اختياري، مش في الاستمارة الورقية)", optional: true,
    fields: [
      { key: "guideName", label: "اسم الدليل المرافق", type: "text", column: true, core: true, aliases: ["الدليل", "اسم الدليل"] },
      { key: "sheetSerial", label: "رقم المسلسل بالكشف", type: "text", aliases: ["م", "مسلسل", "رقم المسلسل"] },
      { key: "phone2", label: "رقم تليفون آخر", type: "phone", column: true, aliases: ["تليفون آخر", "رقم آخر"] },
      { key: "wifeAge", label: "سن الزوجة", type: "number" },
      { key: "headJobType", label: "نوع وظيفة الأب", type: "select", options: "lookup:jobType", aliases: ["الوظيفة", "المهنة"] },
      { key: "headIncome", label: "دخل الأب الشهري", type: "number" },
      { key: "wifeJobType", label: "نوع وظيفة الأم", type: "select", options: "lookup:jobType" },
      { key: "wifeIncome", label: "دخل الأم الشهري", type: "number" },
      { key: "hypertension", label: "حد في الأسرة عنده ضغط؟", type: "yesno", options: YN, forms: ALL_BUT_SHIFA },
      { key: "diabetes", label: "حد في الأسرة عنده سكر؟", type: "yesno", options: YN, forms: ALL_BUT_SHIFA },
      { key: "heartDisease", label: "أمراض القلب والأوعية الدموية", type: "yesno", options: YN, forms: ALL_BUT_SHIFA },
      { key: "disabledMember", label: "في حد من ذوي الهمم؟", type: "yesno", options: YN },
      { key: "psychIllness", label: "في حد بيعاني من أمراض نفسية؟", type: "yesno", options: YN },
      { key: "monthlyMeds", label: "في حد محتاج علاج شهري؟", type: "yesno", options: YN },
      { key: "pendingSurgery", label: "في حد محتاج عملية مؤجلة؟", type: "yesno", options: YN },
      { key: "medsNames", label: "أسماء الأدوية / أمراض أخرى", type: "textarea" },
      { key: "hasMedicalReport", label: "في تقرير طبي معتمد؟", type: "yesno", options: YN, forms: ["shifa"] },
      { key: "hasHealthInsurance", label: "عنده تأمين صحي؟", type: "yesno", options: YN, forms: ["shifa"] },
      { key: "medicalContraindication", label: "في موانع طبية للعملية؟", type: "yesno", options: YN, forms: ["shifa"] },
      { key: "waterConnection", label: "وصلة المياه", type: "select", options: ["رسمية", "أهالي", "بدون"] },
      { key: "electricity", label: "الكهرباء", type: "select", options: ["عداد", "ممارسة", "بدون"] },
      { key: "electricityNeed", label: "الكهرباء تستدعي تدخل؟", type: "yesno", options: YN },
      { key: "propertyDispute", label: "في نزاع على ملكية العقار؟", type: "yesno", options: YN },
      { key: "permanentResidence", label: "الأسرة مقيمة في المنزل إقامة دائمة؟", type: "yesno", options: YN },
      { key: "governmentApproval", label: "موافقة الجهات الحكومية على الإحلال؟", type: "yesno", options: YN, forms: ALL_BUT_SHIFA },
      { key: "needsFullRebuild", label: "المنزل محتاج هدم وبناء كامل؟", type: "yesno", options: YN, forms: ALL_BUT_SHIFA },
      { key: "doors", label: "الأبواب المطلوبة (ملاحظات)", type: "text", forms: ALL_BUT_SHIFA },
      { key: "windows", label: "الشبابيك المطلوبة (ملاحظات)", type: "text", forms: ALL_BUT_SHIFA },
      { key: "clothesCondition", label: "حالة الملابس", type: "select", options: ["ممتازة", "جيدة جداً", "جيدة", "مقبولة", "سيئة"] },
      { key: "needBeds", label: "محتاجين أسِرّة؟", type: "yesno", options: YN },
      { key: "needBlankets", label: "محتاجين بطاطين؟", type: "yesno", options: YN },
      { key: "needAppliances", label: "محتاجين أجهزة كهربائية؟", type: "yesno", options: YN },
      { key: "otherOrgName", label: "جمعية / مؤسسة أخرى بتساعدهم", type: "text" },
      { key: "otherOrgLastContact", label: "تاريخ آخر اتصال بيها", type: "date" },
      { key: "otherOrgSupport", label: "نوع الدعم المقدم", type: "text" },
      { key: "guideApproved", label: "إقرار الدليل باستحقاق الحالة", type: "yesno", options: YN, column: true },
      { key: "explorerApproved", label: "إقرار فريق الاستكشاف باستحقاق الحالة", type: "yesno", options: YN, column: true },
    ],
  },
];

const forForm = (forms: FormType[] | undefined, form: string) => !forms || forms.includes(form as FormType);

/** أقسام وحقول استمارة معينة بنفس ترتيب الورقة. */
export function sectionsFor(form: string): Section[] {
  return SECTIONS.filter((s) => forForm(s.forms, form)).map((s) => ({ ...s, fields: s.fields.filter((f) => forForm(f.forms, form)) }));
}

/** كل الحقول مرة واحدة لكل مفتاح (فيه حقول بتتكرر بمسمى مختلف حسب الاستمارة). */
export const ALL_FIELDS: Field[] = [...new Map(SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f])).values()];
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
