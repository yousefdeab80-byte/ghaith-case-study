import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { HISTORICAL_STATS } from "@/lib/constants";
import { requireUser } from "@/lib/server/auth";

const n = (v: number) => v.toLocaleString("ar-EG");

export default async function Dashboard() {
  await requireUser("dashboard");
  const c = schema.cases, b = schema.benefits;
  const [[totals], byStatus, byPriority, byGovCases, benefitsByYear, benefitsByProject, [{ liveAid }], recent] = await Promise.all([
    db.select({ total: count(), incomplete: sql<number>`count(*) filter (where ${c.completeness} < 100)::int`, people: sql<number>`coalesce(sum(${c.familySize}),0)::int` }).from(c),
    db.select({ k: c.status, n: count() }).from(c).groupBy(c.status),
    db.select({ k: c.priorityLevel, n: count() }).from(c).where(eq(c.status, "eligible")).groupBy(c.priorityLevel),
    db.select({ k: c.governorate, n: count() }).from(c).groupBy(c.governorate).orderBy(desc(count())).limit(8),
    db.select({ k: sql<string>`extract(year from ${b.benefitDate})::text`, n: sql<number>`sum(${b.quantity})::int` }).from(b).groupBy(sql`1`),
    db.select({ k: b.projectName, n: sql<number>`sum(${b.quantity})::int` }).from(b).groupBy(b.projectName),
    db.select({ liveAid: sql<number>`coalesce(sum(${b.quantity}),0)::int` }).from(b),
    db.select().from(c).orderBy(desc(c.createdAt)).limit(6),
  ]);
  const status = Object.fromEntries(byStatus.map((r) => [r.k, r.n]));
  const prio = Object.fromEntries(byPriority.map((r) => [r.k, r.n]));

  const years = { ...HISTORICAL_STATS.byYearAid };
  for (const r of benefitsByYear) if (r.k && Number(r.k) > 2026) years[r.k] = (years[r.k] ?? 0) + r.n;
  const projects: Record<string, number> = { ...HISTORICAL_STATS.byProjectAid };
  for (const r of benefitsByProject) projects[r.k] = Math.max(projects[r.k] ?? 0, r.n);

  return (
    <>
      <PageHeader title="لوحة التحكم" sub="نظرة عامة على حالات القطاع والمساعدات المنفذة"
        actions={<><Link className="btn" href="/reports">تقرير قاعدة بيانات الحالات</Link><Link className="btn btn-primary" href="/reports/achievements">تقرير الإنجازات</Link></>} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label="إجمالي المساعدات منذ 2023" value={HISTORICAL_STATS.totalAid + liveAid} foot={`منها ${n(liveAid)} مسجلة في السستم`} />
        <Stat label="الحالات المسجلة" value={totals.total} foot={`${n(totals.people)} فرد`} />
        <Stat label="حالات مؤهلة بالانتظار" value={status.eligible ?? 0} foot={`${n(prio.high ?? 0)} منها أولوية مرتفعة`} href="/cases?status=eligible&sort=priority" />
        <Stat label="حالات بياناتها ناقصة" value={totals.incomplete} foot="محتاجة تكملة" href="/cases?incomplete=1&sort=completeness" tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div className="card">
          <div className="section-title">الحالات حسب حالة الملف</div>
          <Bars rows={[["قيد الدراسة", status.study ?? 0], ["مؤهلة للمساعدة", status.eligible ?? 0], ["تم التنفيذ", status.served ?? 0], ["مستبعدة", status.excluded ?? 0]]} />
        </div>
        <div className="card">
          <div className="section-title">المساعدات حسب السنة</div>
          <div className="section-sub">أرقام 2023–2026 من سجلات المؤسسة + المسجل في السستم بعدها</div>
          <Bars rows={Object.entries(years).sort()} />
        </div>
        <div className="card">
          <div className="section-title">الحالات المسجلة حسب المحافظة</div>
          <Bars rows={byGovCases.map((r) => [r.k ?? "غير محدد", r.n])} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <div className="card">
          <div className="section-title">المساعدات حسب المشروع</div>
          <div className="section-sub">الإجمالي التاريخي أو المسجل في السستم، أيهما أكبر</div>
          <Bars rows={Object.entries(projects).sort((a, b) => b[1] - a[1])} />
        </div>
        <div className="card">
          <div className="section-title">المساعدات حسب المحافظة (2023–2026)</div>
          <Bars rows={Object.entries(HISTORICAL_STATS.byGovernorateAid).sort((a, b) => b[1] - a[1])} />
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3"><div className="section-title">آخر الحالات المسجلة</div><Link href="/cases" className="text-sm text-primary font-semibold">كل الحالات</Link></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>رقم الملف</th><th>الاسم</th><th>المكان</th><th>الحالة</th><th>الأولوية</th></tr></thead>
          <tbody>{recent.map((r) => (
            <tr key={r.id}><td className="text-ink-soft">{r.fileNo}</td><td><Link href={`/cases/${r.id}`} className="font-bold text-primary">{r.headName}</Link></td>
              <td className="text-xs text-ink-soft">{[r.village, r.governorate].filter(Boolean).join(" – ")}</td><td><StatusBadge status={r.status} /></td><td><PriorityBadge level={r.priorityLevel} /></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

function Stat({ label, value, foot, href, tone }: { label: string; value: number; foot?: string; href?: string; tone?: "accent" }) {
  const body = (
    <div className="card p-4 h-full">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tone === "accent" ? "text-accent" : "text-primary"}`}>{n(value)}</div>
      {foot && <div className="text-[11px] text-ink-soft mt-1">{foot}</div>}
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-90">{body}</Link> : body;
}

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-sm text-ink-soft">لا توجد بيانات بعد</p>;
  return (
    <div className="space-y-2 mt-3">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_1fr_56px] items-center gap-2 text-xs">
          <span className="truncate text-ink-soft" title={k}>{k}</span>
          <div className="h-2.5 rounded-full bg-surface-alt overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="tabular-nums font-semibold text-left">{n(v)}</span>
        </div>
      ))}
    </div>
  );
}
