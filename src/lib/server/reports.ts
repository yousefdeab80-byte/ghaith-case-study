import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, lte, ne, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { HISTORICAL_STATS, PRIORITY_LABELS, SOURCE_LABELS, STATUS_LABELS, FORM_TYPES } from "@/lib/constants";

/** صف تقرير: [البند، العدد]. */
export type Row = [string, number];

const UNKNOWN = "غير مسجل";
const c = schema.cases, b = schema.benefits;

const rows = (r: { k: string | null; n: number }[], labels?: Record<string, string>): Row[] =>
  r.map((x) => [x.k ? labels?.[x.k] ?? x.k : UNKNOWN, Number(x.n)]);

/* ───────────── تقرير قاعدة بيانات الحالات ───────────── */

export type CaseReportFilter = { gov?: string; status?: string; from?: string; to?: string };

function caseWhere(f: CaseReportFilter): SQL | undefined {
  const w: SQL[] = [];
  if (f.gov) w.push(eq(c.governorate, f.gov));
  if (f.status) w.push(eq(c.status, f.status));
  if (f.from) w.push(gte(c.createdAt, new Date(f.from)));
  if (f.to) w.push(lte(c.createdAt, new Date(`${f.to}T23:59:59`)));
  return w.length ? and(...w) : undefined;
}

const caseGroup = (expr: SQL, where: SQL | undefined, limit = 500) =>
  db.select({ k: sql<string | null>`${expr}`, n: count() }).from(c).where(where).groupBy(sql`1`).orderBy(desc(count())).limit(limit);

/** ترتيب ثابت للفئات (مش بالأكبر) عشان الفئات الرقمية تتقري صح. */
function ordered(r: { k: string | null; n: number }[], order: string[]): Row[] {
  const m = new Map(r.map((x) => [x.k ?? UNKNOWN, Number(x.n)]));
  return order.filter((k) => m.has(k)).map((k) => [k, m.get(k)!]);
}

const FAMILY_BUCKETS = ["1–2 أفراد", "3–4 أفراد", "5–6 أفراد", "7 أفراد فأكثر", UNKNOWN];
const familyBucket = sql`case when ${c.familySize} is null then ${UNKNOWN} when ${c.familySize} <= 2 then '1–2 أفراد'
  when ${c.familySize} <= 4 then '3–4 أفراد' when ${c.familySize} <= 6 then '5–6 أفراد' else '7 أفراد فأكثر' end`;

const INCOME_BUCKETS = ["بدون دخل", "أقل من 1,000", "1,000–2,000", "2,000–3,000", "3,000–5,000", "5,000 فأكثر", UNKNOWN];
const incomeBucket = sql`case when ${c.totalIncome} is null then ${UNKNOWN} when ${c.totalIncome} = 0 then 'بدون دخل'
  when ${c.totalIncome} < 1000 then 'أقل من 1,000' when ${c.totalIncome} < 2000 then '1,000–2,000'
  when ${c.totalIncome} < 3000 then '2,000–3,000' when ${c.totalIncome} < 5000 then '3,000–5,000' else '5,000 فأكثر' end`;

const PER_CAPITA_BUCKETS = ["أقل من 300", "300–600", "600–1,000", "1,000 فأكثر", UNKNOWN];
const perCapitaBucket = sql`case when ${c.totalIncome} is null or coalesce(${c.familySize}, 0) = 0 then ${UNKNOWN}
  when ${c.totalIncome} / ${c.familySize} < 300 then 'أقل من 300' when ${c.totalIncome} / ${c.familySize} < 600 then '300–600'
  when ${c.totalIncome} / ${c.familySize} < 1000 then '600–1,000' else '1,000 فأكثر' end`;

const COMPLETENESS_BUCKETS = ["مكتملة 100%", "75–99%", "50–74%", "25–49%", "أقل من 25%"];
const completenessBucket = sql`case when ${c.completeness} >= 100 then 'مكتملة 100%' when ${c.completeness} >= 75 then '75–99%'
  when ${c.completeness} >= 50 then '50–74%' when ${c.completeness} >= 25 then '25–49%' else 'أقل من 25%' end`;

export async function casesReport(f: CaseReportFilter) {
  const w = caseWhere(f);
  const notExcluded = and(ne(c.status, "excluded"), w);
  const whereSql = w ? sql`where ${w}` : sql``;
  const formLabels = Object.fromEntries(FORM_TYPES.map((t) => [t.id, t.label]));

  const [
    [totals], status, priority, gov, markaz, village, marital, income, health, roof, family, incomeB, perCapita,
    completeness, source, formType, explorers, monthly, recs, [benefited], nominations,
  ] = await Promise.all([
    db.select({
      total: count(),
      people: sql<number>`coalesce(sum(${c.familySize}), 0)::int`,
      children: sql<number>`coalesce(sum(${c.childrenCount}), 0)::int`,
      avgFamily: sql<number>`coalesce(round(avg(${c.familySize}), 1), 0)::float`,
      avgIncome: sql<number>`coalesce(round(avg(${c.totalIncome})), 0)::int`,
      complete: sql<number>`count(*) filter (where ${c.completeness} >= 100)::int`,
      avgCompleteness: sql<number>`coalesce(round(avg(${c.completeness})), 0)::int`,
      withNid: sql<number>`count(*) filter (where ${c.headNid} is not null)::int`,
      withPhone: sql<number>`count(*) filter (where ${c.phone} is not null or ${c.phone2} is not null)::int`,
      governorates: sql<number>`count(distinct ${c.governorate})::int`,
      villages: sql<number>`count(distinct ${c.village})::int`,
      thisMonth: sql<number>`count(*) filter (where ${c.createdAt} >= date_trunc('month', now()))::int`,
    }).from(c).where(w),
    caseGroup(sql`${c.status}`, w),
    caseGroup(sql`${c.priorityLevel}`, notExcluded),
    caseGroup(sql`${c.governorate}`, w),
    caseGroup(sql`concat_ws(' – ', ${c.governorate}, ${c.markaz})`, and(isNotNull(c.markaz), w), 20),
    caseGroup(sql`concat_ws(' – ', ${c.markaz}, ${c.village})`, and(isNotNull(c.village), w), 20),
    caseGroup(sql`${c.maritalStatus}`, w),
    caseGroup(sql`${c.incomeType}`, w),
    caseGroup(sql`${c.healthStatus}`, w),
    caseGroup(sql`${c.roofType}`, w),
    caseGroup(familyBucket, w),
    caseGroup(incomeBucket, w),
    caseGroup(perCapitaBucket, w),
    caseGroup(completenessBucket, w),
    caseGroup(sql`${c.source}`, w),
    caseGroup(sql`${c.formType}`, w),
    caseGroup(sql`${c.explorerName}`, and(isNotNull(c.explorerName), w), 15),
    db.select({ k: sql<string>`to_char(${c.createdAt}, 'YYYY-MM')`, n: count() }).from(c)
      .where(and(gte(c.createdAt, sql`date_trunc('month', now()) - interval '11 months'`), w)).groupBy(sql`1`).orderBy(sql`1`),
    db.execute<{ k: string; n: number }>(sql`select r as k, count(*)::int as n from ${c}, jsonb_array_elements_text(${c.recommendations}) r ${whereSql} group by 1 order by 2 desc limit 15`),
    db.select({
      // أسماء صريحة لأن drizzle بيكتب الأعمدة من غير اسم الجدول في الاستعلامات اللي فيها جدول واحد
      any: sql<number>`count(*) filter (where exists (select 1 from benefits bb where bb.case_id = "cases"."id"))::int`,
    }).from(c).where(w),
    db.select({
      project: schema.projects.name,
      pool: sql<number>`count(*) filter (where ${schema.nominations.sheetId} is null)::int`,
      draft: sql<number>`count(*) filter (where ${schema.nominations.sheetId} is not null and ${schema.nominations.status} = 'nominated')::int`,
      sent: sql<number>`count(*) filter (where ${schema.nominations.status} = 'sent')::int`,
    }).from(schema.nominations)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.nominations.projectId))
      .innerJoin(c, eq(c.id, schema.nominations.caseId))
      .where(w).groupBy(schema.projects.name).orderBy(desc(count())),
  ]);

  // آخر 12 شهر، والشهور الفاضية بصفر
  const byMonth = new Map(monthly.map((m) => [m.k, Number(m.n)]));
  const months: Row[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push([k, byMonth.get(k) ?? 0]);
  }

  return {
    totals: { ...totals, benefited: benefited.any },
    status: rows(status, STATUS_LABELS),
    priority: ordered(priority, ["high", "mid", "low"]).map(([k, n]) => [PRIORITY_LABELS[k] ?? k, n] as Row),
    gov: rows(gov), markaz: rows(markaz), village: rows(village),
    marital: rows(marital), income: rows(income), health: rows(health), roof: rows(roof),
    family: ordered(family, FAMILY_BUCKETS), incomeBuckets: ordered(incomeB, INCOME_BUCKETS), perCapita: ordered(perCapita, PER_CAPITA_BUCKETS),
    completeness: ordered(completeness, COMPLETENESS_BUCKETS),
    source: rows(source, SOURCE_LABELS), formType: rows(formType, formLabels), explorers: rows(explorers),
    months, recommendations: rows([...recs].map((r) => ({ k: r.k, n: Number(r.n) }))),
    nominations,
  };
}
export type CasesReport = Awaited<ReturnType<typeof casesReport>>;

/* ───────────── تقرير التنفيذات والإنجازات ───────────── */

export type AchievementFilter = { year?: string; project?: string; gov?: string };

/** المحافظة من سجل المساعدة، ولو فاضية من ملف الحالة المربوط. */
const benefitGov = sql<string | null>`coalesce(nullif(${b.governorate}, ''), ${c.governorate})`;
const benefitYear = sql<string | null>`extract(year from ${b.benefitDate})::int::text`;
const qty = sql<number>`coalesce(sum(${b.quantity}), 0)::int`;
/** الأسرة: ملف الحالة، وإلا الرقم القومي، وإلا الاسم. */
const family = sql`coalesce(${b.caseId}::text, ${b.nid}, ${b.name})`;
const families = sql<number>`count(distinct ${family})::int`;

function benefitWhere(f: AchievementFilter): SQL | undefined {
  const w: SQL[] = [];
  if (f.year) w.push(sql`${benefitYear} = ${f.year}`);
  if (f.project) w.push(eq(b.projectName, f.project));
  if (f.gov) w.push(sql`${benefitGov} = ${f.gov}`);
  return w.length ? and(...w) : undefined;
}

function benefitGroup(expr: SQL, where: SQL | undefined, order: "n" | "k" = "n", limit = 500) {
  return db.select({ k: sql<string | null>`${expr}`, n: qty, f: families }).from(b).leftJoin(c, eq(c.id, b.caseId))
    .where(where).groupBy(sql`1`).orderBy(order === "n" ? desc(sql`2`) : sql`1`).limit(limit);
}

export type GroupRow = { k: string; n: number; f: number };
const groupRows = (r: { k: string | null; n: number; f: number }[]): GroupRow[] => r.map((x) => ({ k: x.k ?? UNKNOWN, n: Number(x.n), f: Number(x.f) }));

/**
 * الأرقام التراكمية: أرقام المؤسسة التاريخية (2023–2026) + المسجل في السستم.
 * لسنين التاريخ بناخد الأكبر (عشان لو الداتا القديمة اتستوردت متتحسبش مرتين)، وبعدها بنجمع المسجل.
 */
function cumulative(hist: Record<string, number>, liveOld: GroupRow[], liveNew: GroupRow[]): Row[] {
  const out = new Map<string, number>();
  const keys = new Set([...Object.keys(hist), ...liveOld.map((r) => r.k), ...liveNew.map((r) => r.k)]);
  for (const k of keys) {
    const old = Math.max(hist[k] ?? 0, liveOld.find((r) => r.k === k)?.n ?? 0);
    out.set(k, old + (liveNew.find((r) => r.k === k)?.n ?? 0));
  }
  return [...out.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}

export const HISTORY_LAST_YEAR = 2026;

export async function achievementsReport(f: AchievementFilter) {
  const w = benefitWhere(f);
  const old = sql`(${b.benefitDate} is null or extract(year from ${b.benefitDate}) <= ${HISTORY_LAST_YEAR})`;
  const recent = sql`extract(year from ${b.benefitDate}) > ${HISTORY_LAST_YEAR}`;
  const sheetW: SQL[] = [inArray(schema.sheets.status, ["sent", "closed"])];
  if (f.year) sheetW.push(sql`extract(year from ${schema.sheets.sentAt})::int::text = ${f.year}`);
  if (f.project) sheetW.push(eq(schema.projects.name, f.project));
  if (f.gov) sheetW.push(eq(schema.sheets.governorate, f.gov));

  const [
    [totals], [reach], byYear, byMonth, byProject, bySector, byGov, byVillage, convoys, sheets, years, projectsList,
    projOld, projNew, govOld, govNew, yearOld,
  ] = await Promise.all([
    db.select({
      aid: qty, records: count(), families,
      projects: sql<number>`count(distinct ${b.projectName})::int`,
      governorates: sql<number>`count(distinct ${benefitGov})::int`,
      villages: sql<number>`count(distinct coalesce(nullif(${b.village}, ''), ${c.village}))::int`,
      convoys: sql<number>`count(distinct (${b.projectName}, ${b.convoy})) filter (where ${b.convoy} is not null)::int`,
      linked: sql<number>`count(*) filter (where ${b.caseId} is not null)::int`,
      first: sql<string | null>`min(${b.benefitDate})::text`, last: sql<string | null>`max(${b.benefitDate})::text`,
    }).from(b).leftJoin(c, eq(c.id, b.caseId)).where(w),
    // الأفراد اللي وصلهم الأثر (أفراد الأسر المربوطة بملفات) والأسر اللي استفادت من أكتر من مشروع
    db.execute<{ people: number; repeat: number }>(sql`
      with fam as (
        select ${family} as fam, max(${c.familySize}) as size, count(distinct ${b.projectName}) as projects
        from ${b} left join ${c} on ${c.id} = ${b.caseId} ${w ? sql`where ${w}` : sql``} group by 1
      ) select coalesce(sum(size), 0)::int as people, count(*) filter (where projects > 1)::int as repeat from fam`),
    benefitGroup(benefitYear, w, "k"),
    benefitGroup(sql`to_char(${b.benefitDate}, 'YYYY-MM')`, and(isNotNull(b.benefitDate), f.year ? w : and(sql`${b.benefitDate} >= date_trunc('month', now()) - interval '11 months'`, w)), "k"),
    benefitGroup(sql`${b.projectName}`, w),
    db.select({ k: sql<string | null>`${schema.projects.sector}`, n: qty, f: families }).from(b).leftJoin(c, eq(c.id, b.caseId))
      .leftJoin(schema.projects, eq(schema.projects.name, b.projectName)).where(w).groupBy(sql`1`).orderBy(desc(sql`2`)),
    benefitGroup(benefitGov, w),
    benefitGroup(sql`concat_ws(' – ', ${benefitGov}, coalesce(nullif(${b.village}, ''), ${c.village}))`, and(sql`coalesce(nullif(${b.village}, ''), ${c.village}) is not null`, w), "n", 20),
    db.select({
      project: b.projectName, convoy: b.convoy, n: qty, f: families,
      from: sql<string | null>`min(${b.benefitDate})::text`, to: sql<string | null>`max(${b.benefitDate})::text`,
      govs: sql<string | null>`string_agg(distinct ${benefitGov}, '، ')`,
    }).from(b).leftJoin(c, eq(c.id, b.caseId)).where(and(isNotNull(b.convoy), w))
      .groupBy(b.projectName, b.convoy).orderBy(desc(sql`max(${b.benefitDate})`)).limit(25),
    db.select({
      project: schema.projects.name, sheets: sql<number>`count(distinct ${schema.sheets.id})::int`,
      cases: sql<number>`count(${schema.nominations.id})::int`,
    }).from(schema.sheets).innerJoin(schema.projects, eq(schema.projects.id, schema.sheets.projectId))
      .leftJoin(schema.nominations, eq(schema.nominations.sheetId, schema.sheets.id))
      .where(and(...sheetW)).groupBy(schema.projects.name).orderBy(desc(sql`3`)),
    db.selectDistinct({ y: benefitYear }).from(b).where(isNotNull(b.benefitDate)).orderBy(desc(benefitYear)),
    db.selectDistinct({ p: b.projectName }).from(b).orderBy(b.projectName),
    benefitGroup(sql`${b.projectName}`, old),
    benefitGroup(sql`${b.projectName}`, recent),
    benefitGroup(benefitGov, old),
    benefitGroup(benefitGov, recent),
    benefitGroup(benefitYear, old, "k"),
  ]);

  const filtered = Boolean(f.year || f.project || f.gov);
  const liveRecent = groupRows(byYear).filter((r) => Number(r.k) > HISTORY_LAST_YEAR);
  const yearsCum = cumulative(HISTORICAL_STATS.byYearAid, groupRows(yearOld).filter((r) => r.k !== UNKNOWN), liveRecent)
    .sort((a, z) => a[0].localeCompare(z[0]));
  // المساعدات المسجلة من غير تاريخ غالباً من الداتا القديمة اللي محسوبة في الأرقام التاريخية، فمش بنجمعها هنا
  const cumTotal = yearsCum.reduce((s, [, n]) => s + n, 0);
  const beneficiariesCum = Object.values(HISTORICAL_STATS.byYearBeneficiaries).reduce((s, n) => s + n, 0)
    + liveRecent.reduce((s, r) => s + r.f, 0);

  return {
    filtered,
    totals: { ...totals, people: Number(reach?.people ?? 0), repeat: Number(reach?.repeat ?? 0) },
    cumulative: filtered ? null : {
      aid: Math.max(cumTotal, HISTORICAL_STATS.totalAid),
      beneficiaries: Math.max(beneficiariesCum, HISTORICAL_STATS.totalBeneficiaries),
      years: yearsCum,
      beneficiariesByYear: Object.entries(HISTORICAL_STATS.byYearBeneficiaries) as Row[],
      projects: cumulative(HISTORICAL_STATS.byProjectAid, groupRows(projOld), groupRows(projNew)),
      governorates: cumulative(HISTORICAL_STATS.byGovernorateAid, groupRows(govOld).filter((r) => r.k !== UNKNOWN), groupRows(govNew).filter((r) => r.k !== UNKNOWN)),
    },
    byYear: groupRows(byYear), byMonth: groupRows(byMonth), byProject: groupRows(byProject), bySector: groupRows(bySector),
    byGov: groupRows(byGov), byVillage: groupRows(byVillage),
    convoys: convoys.map((r) => ({ ...r, n: Number(r.n), f: Number(r.f) })), sheets,
    options: { years: years.map((r) => r.y).filter(Boolean) as string[], projects: projectsList.map((r) => r.p) },
  };
}
export type AchievementsReport = Awaited<ReturnType<typeof achievementsReport>>;
