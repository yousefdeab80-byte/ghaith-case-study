/**
 * الأولوية (نظام اختيار الحالات بالمراحل الخمسة) ومعايير الاستحقاق والاستبعاد لكل مشروع،
 * منقولة من "السياسات والإجراءات لدى قطاع دراسة الحالة 2026/2027".
 */
import { DIRECT_SUPPORT_GOVERNORATES } from "./constants";

export type CaseValues = Record<string, unknown>;

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const yes = (v: unknown) => v === true || ["نعم", "نعم تستدعي", "true"].includes(str(v));
const no = (v: unknown) => v === false || ["لا", "لا تستدعي", "false"].includes(str(v));

// ---------------------------------------------------------------- الأولوية

const MARITAL_RANK: Record<string, number> = { "أرملة": 3, "مطلقة": 2, "منفصلة": 2, "الزوج مسجون": 2, "متزوجة": 1 };
const INCOME_RANK: Record<string, number> = { "لا يوجد": 3, "تكافل وكرامة": 2, "يوميات": 1 };
const HEALTH_RANK: Record<string, number> = {
  "أمراض مزمنة": 3, "إعاقة": 3, "عجز / عملية كبرى": 2, "ضغط / سكر": 1, "تحتاج متابعة طبية": 1, "سليمة": 0,
};
const WEAK_ROOFS = ["خشبية", "خشب متهالك", "بوص", "صاج", "بدون"];

export type Priority = { score: number; points: number; level: "high" | "mid" | "low"; reasons: string[] };

/**
 * المراحل الخمسة بالترتيب: الحالة الزوجية ← الدخل ← الصحة ← عدد الأفراد ← الأسقف.
 * score ترتيبي (المرحلة الأعلى تغلب)، وpoints مجموع بسيط لتحديد المستوى.
 */
export function computePriority(c: CaseValues): Priority {
  const reasons: string[] = [];
  const marital = MARITAL_RANK[str(c.maritalStatus)] ?? 0;
  const income = INCOME_RANK[str(c.incomeType)] ?? 0;
  let health = HEALTH_RANK[str(c.healthStatus)] ?? 0;
  if (health < 3 && (yes(c.disabledMember) || yes(c.pendingSurgery))) health = Math.max(health, 2);
  if (health < 1 && (yes(c.hypertension) || yes(c.diabetes))) health = 1;
  const size = num(c.familySize) ?? 0;
  const family = size >= 5 ? 2 : size > 0 ? 1 : 0;
  const roof = WEAK_ROOFS.includes(str(c.roofType)) ? 2 : 0;

  if (marital >= 2) reasons.push(str(c.maritalStatus));
  if (income >= 2) reasons.push(`الدخل: ${str(c.incomeType)}`);
  if (health >= 2) reasons.push("حالة صحية صعبة");
  if (family === 2) reasons.push(`${size} أفراد`);
  if (roof) reasons.push(`سقف ${str(c.roofType)}`);

  const inc = num(c.totalIncome), exp = num(c.totalExpenses);
  const deficit = inc !== null && exp !== null && exp > inc ? 1 : 0;
  if (deficit) reasons.push("المصروفات أكبر من الدخل");

  const score = marital * 10000 + income * 1000 + health * 100 + family * 10 + roof;
  const points = marital + income + health + family + roof + deficit;
  const level = points >= 8 ? "high" : points >= 4 ? "mid" : "low";
  return { score, points, level, reasons };
}

// ---------------------------------------------------------------- الاستحقاق

export type Check = { label: string; status: "pass" | "fail" | "unknown"; exclusion?: boolean };
export type Eligibility = { verdict: "eligible" | "not_eligible" | "incomplete"; checks: Check[] };

export type EligibilityContext = {
  /** آخر استفادة للحالة من نفس المشروع (YYYY-MM-DD) */
  lastBenefitDate?: string | null;
  minDaysBetweenBenefits?: number | null;
  today?: Date;
};

const check = (label: string, ok: boolean | null, exclusion = false): Check =>
  ({ label, status: ok === null ? "unknown" : ok ? "pass" : "fail", exclusion });
const tri = (v: unknown): boolean | null => (yes(v) ? true : no(v) ? false : null);
const notTri = (v: unknown): boolean | null => { const t = tri(v); return t === null ? null : !t; };

function weakEconomy(c: CaseValues): boolean | null {
  const inc = num(c.totalIncome), exp = num(c.totalExpenses);
  if (inc !== null && exp !== null) return exp >= inc || ["لا يوجد", "تكافل وكرامة", "يوميات"].includes(str(c.incomeType));
  if (str(c.incomeType)) return ["لا يوجد", "تكافل وكرامة", "يوميات"].includes(str(c.incomeType));
  return null;
}

function noRecentBenefit(ctx: EligibilityContext): Check {
  const label = ctx.minDaysBetweenBenefits
    ? `لم تستفد من نفس المشروع آخر ${ctx.minDaysBetweenBenefits} يوم`
    : "عدم الاستفادة السابقة القريبة";
  if (!ctx.lastBenefitDate || !ctx.minDaysBetweenBenefits) return check(label, true, true);
  const days = ((ctx.today ?? new Date()).getTime() - new Date(ctx.lastBenefitDate).getTime()) / 86400000;
  return check(label, days >= ctx.minDaysBetweenBenefits, true);
}

function fixedCriteria(c: CaseValues, ctx: EligibilityContext): Check[] {
  const gov = str(c.governorate);
  return [
    check("إقرار الدليل باستحقاق الحالة", tri(c.guideApproved) ?? false),
    check("إقرار فريق الاستكشاف باستحقاق الحالة", tri(c.explorerApproved) ?? false),
    check("ضعف الحالة الاجتماعية والاقتصادية / الدخل لا يتناسب مع عدد الأفراد", weakEconomy(c)),
    check("الحالة في نطاق الدعم المباشر", gov ? DIRECT_SUPPORT_GOVERNORATES.includes(gov) : null),
    noRecentBenefit(ctx),
  ];
}

const RULES: Record<string, (c: CaseValues, ctx: EligibilityContext) => Check[]> = {
  seasonal: (c, ctx) => fixedCriteria(c, ctx),

  dafa: (c, ctx) => [
    ...fixedCriteria(c, ctx),
    check("عدد الأفراد لا يتناسب مع الموارد (احتياج بطاطين)", tri(c.needBlankets)),
  ],

  schoolbag: (c, ctx) => {
    const members = Array.isArray(c.members) ? (c.members as { age?: string; eduStage?: string }[]) : [];
    const school = members.some((m) => { const a = num(m.age); return a !== null && a >= 6 && a <= 18; });
    const kids = num(c.childrenCount);
    return [
      ...fixedCriteria(c, ctx),
      check("أطفال في المراحل التعليمية المستهدفة", school ? true : kids === 0 ? false : null),
    ];
  },

  zilal: (c, ctx) => {
    const inc = num(c.totalIncome), exp = num(c.totalExpenses);
    const workers = Math.max(1, num(c.workersCount) ?? 1);
    const financial = inc === null || exp === null ? weakEconomy(c) : exp >= inc || inc / workers <= 1000;
    const roofUnsafe = str(c.roofNeed) ? yes(c.roofNeed) : str(c.roofType) ? WEAK_ROOFS.includes(str(c.roofType)) : null;
    return [
      check("انعدام الأمان الإنشائي (سقف متهالك أو بدون أبواب/شبابيك)", roofUnsafe),
      check("الإقامة الدائمة في المنزل", tri(c.permanentResidence)),
      check("عدم قدرة الأسرة على تكاليف الإصلاح (دخل الفرد العامل ≤ 1000 أو المصروفات ≥ الدخل)", financial),
      check("وضوح ملكية العقار وعدم وجود نزاع", notTri(c.propertyDispute), true),
      check("موافقة الجهات الحكومية", tri(c.governmentApproval)),
      check("لا تحتاج هدم وبناء كامل", notTri(c.needsFullRebuild), true),
      check("إقرار الدليل باستحقاق الحالة", tri(c.guideApproved) ?? false),
      check("إقرار فريق الاستكشاف باستحقاق الحالة", tri(c.explorerApproved) ?? false),
      noRecentBenefit(ctx),
    ];
  },

  irtiwa: (c, ctx) => [
    check("عدم وجود وصلة مياه حكومية داخل المنزل", str(c.waterConnection) ? str(c.waterConnection) !== "رسمية" : null, true),
    check("إقامة الأسرة إقامة دائمة بالمنزل", tri(c.permanentResidence)),
    check("عدم القدرة المالية على تكلفة التوصيل", weakEconomy(c)),
    check("صلاحية المنزل قانونياً (لا يوجد نزاع)", notTri(c.propertyDispute), true),
    check("إقرار الدليل باستحقاق الحالة", tri(c.guideApproved) ?? false),
    check("إقرار فريق الاستكشاف باستحقاق الحالة", tri(c.explorerApproved) ?? false),
    noRecentBenefit(ctx),
  ],

  shifa: (c, ctx) => {
    const op = str(c.operationType);
    const isSurgery = op.startsWith("عملية");
    const checks = [
      check("وجود احتياج طبي فعلي في تخصص الرمد", op ? true : null),
      check("عدم القدرة المالية على تكلفة العلاج", weakEconomy(c)),
      check("إثبات الهوية والإقامة", str(c.headNid) && str(c.village) ? true : null),
      noRecentBenefit(ctx),
    ];
    if (isSurgery) {
      checks.push(
        check("تقرير طبي معتمد", tri(c.hasMedicalReport)),
        check("عدم وجود موانع طبية", notTri(c.medicalContraindication), true),
        check("عدم وجود تأمين صحي", notTri(c.hasHealthInsurance)),
      );
    }
    return checks;
  },

  irtiqa: (c) => {
    const age = num(c.traineeAge) ?? num(c.headAge);
    return [
      check("من ذوي الإعاقة", tri(c.disabledMember)),
      check("السن من 18 إلى 35", age === null ? null : age >= 18 && age <= 35),
      check("عدم وجود وظيفة أو دخل ثابت", str(c.incomeType) ? !["موظف", "شهري"].includes(str(c.incomeType)) : null),
      check("المستوى التعليمي فوق متوسط على الأقل", str(c.headEducation) ? ["فوق متوسط", "جامعي"].includes(str(c.headEducation)) : null),
    ];
  },
};

export const RULE_KEYS = Object.keys(RULES);

export function evaluateEligibility(rulesKey: string, c: CaseValues, ctx: EligibilityContext = {}): Eligibility {
  const checks = (RULES[rulesKey] ?? RULES.seasonal)(c, ctx);
  const verdict = checks.some((x) => x.status === "fail")
    ? "not_eligible"
    : checks.some((x) => x.status === "unknown") ? "incomplete" : "eligible";
  return { verdict, checks };
}
