import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/filter-select";
import { Icon } from "@/components/icons";
import { BarList, Columns, Kpi, NumTable, Panel, monthLabel, n } from "@/components/report-ui";
import { GOVERNORATES } from "@/lib/constants";
import { achievementsReport, type AchievementFilter, type GroupRow } from "@/lib/server/reports";
import { PrintButton } from "../tabs";

export const dynamic = "force-dynamic";

const pairs = (r: GroupRow[]) => r.map((x) => [x.k, x.n] as [string, number]);
const fams = (r: GroupRow[]) => ({ label: "أسرة", values: r.map((x) => x.f) });

export default async function AchievementsPage({ searchParams }: { searchParams: Promise<AchievementFilter> }) {
  const f = await searchParams;
  const r = await achievementsReport(f);
  const t = r.totals;
  const cum = r.cumulative;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const filterText = [f.year && `سنة ${f.year}`, f.project, f.gov].filter(Boolean).join(" · ");

  return (
    <div className="report">
      <PageHeader title="تقرير التنفيذات وإنجازات المؤسسة"
        sub={`اللي المؤسسة وصّلته للأسر: مساعدات، مشروعات، قوافل وأماكن${filterText ? ` — ${filterText}` : ""}. اتعمل ${new Date().toLocaleDateString("ar-EG", { dateStyle: "long" })}`}
        actions={<><a className="btn print:hidden" href={`/api/export/report-achievements${qs ? `?${qs}` : ""}`}><Icon name="download" />تصدير إكسل</a><span className="print:hidden"><PrintButton /></span></>} />

      <form className="card mb-5 flex flex-wrap gap-3 items-end print:hidden" action="/reports/achievements">
        <FilterSelect name="year" label="السنة" value={f.year} options={r.options.years.map((y) => [y, y])} all="كل السنين" />
        <FilterSelect name="project" label="المشروع" value={f.project} options={r.options.projects.map((p) => [p, p])} all="كل المشروعات" />
        <FilterSelect name="gov" label="المحافظة" value={f.gov} options={GOVERNORATES.map((g) => [g, g])} all="كل المحافظات" />
        <button className="btn btn-primary"><Icon name="search" />عرض</button>
        {qs && <a href="/reports/achievements" className="btn">مسح الفلاتر</a>}
      </form>

      {cum && (
        <>
          <section className="rounded-card bg-primary text-white p-6 mb-4 break-inside-avoid print:border print:border-primary">
            <div className="text-sm opacity-80">إنجازات مؤسسة غيث منذ 2023</div>
            <div className="grid gap-6 sm:grid-cols-3 mt-3">
              <div><div className="text-4xl font-extrabold tabular-nums">{n(cum.aid)}</div><div className="text-sm opacity-80 mt-1">مساعدة اتسلمت للأسر</div></div>
              <div><div className="text-4xl font-extrabold tabular-nums text-brand">{n(cum.beneficiaries)}</div><div className="text-sm opacity-80 mt-1">مستفيد</div></div>
              <div><div className="text-4xl font-extrabold tabular-nums">{n(cum.governorates.length)}</div><div className="text-sm opacity-80 mt-1">محافظة وصلتها المساعدات · {n(cum.projects.length)} مشروع ومبادرة</div></div>
            </div>
            <p className="text-[11px] opacity-70 mt-4">أرقام 2023–2026 من سجلات المؤسسة، وبعدها من المسجل في السستم.</p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <Panel title="المساعدات حسب السنة"><Columns rows={cum.years} unit="مساعدة" /></Panel>
            <Panel title="المستفيدين حسب السنة"><Columns rows={cum.beneficiariesByYear} unit="مستفيد" /></Panel>
            <Panel title="المساعدات حسب المشروع (تراكمي)"><BarList rows={cum.projects} unit="مساعدة" /></Panel>
            <Panel title="المساعدات حسب المحافظة (تراكمي)"><BarList rows={cum.governorates} unit="مساعدة" /></Panel>
          </div>
        </>
      )}

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-1">المسجل في السستم بالتفصيل</h2>
      <p className="text-xs text-ink-soft mb-3">
        من سجل المساعدات المنفذة{t.first ? ` (من ${t.first} إلى ${t.last})` : ""}. {n(t.linked)} من {n(t.records)} سجل مربوطين بملف في سجل الحالات.
      </p>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi big label="مساعدات اتسلمت" value={t.aid} foot={`${n(t.records)} سجل`} />
        <Kpi big label="أسر استفادت" value={t.families} foot={`${n(t.repeat)} أسرة استفادت من أكتر من مشروع`} />
        <Kpi big label="أفراد وصلهم الأثر" value={t.people} foot="أفراد الأسر المربوطة بملفات" tone="accent" />
        <Kpi big label="مشروعات ومبادرات" value={t.projects} foot={`${n(t.convoys)} قافلة / دفعة`} />
        <Kpi label="محافظات" value={t.governorates} />
        <Kpi label="قرى" value={t.villages} />
        <Kpi label="كشوف ترشيح اتبعتت" value={r.sheets.reduce((s, x) => s + x.sheets, 0)} foot={`فيها ${n(r.sheets.reduce((s, x) => s + x.cases, 0))} حالة`} />
        <Kpi label="متوسط المساعدات للأسرة" value={t.families ? (t.aid / t.families).toFixed(1) : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title={f.year ? `المساعدات شهرياً في ${f.year}` : "المساعدات شهرياً"} sub={f.year ? undefined : "آخر 12 شهر"} className="lg:col-span-2">
          <Columns rows={pairs(r.byMonth)} label={monthLabel} unit="مساعدة" />
        </Panel>
        <Panel title="حسب السنة"><NumTable head={["السنة", "مساعدات", "أسر"]} rows={r.byYear.map((x) => [x.k, x.n, x.f])} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Panel title="حسب المشروع"><BarList rows={pairs(r.byProject)} extra={fams(r.byProject)} unit="مساعدة" /></Panel>
        <Panel title="حسب القطاع" sub="التكافل، التمكين، والمبادرات الموسمية"><BarList rows={pairs(r.bySector)} extra={fams(r.bySector)} unit="مساعدة" /></Panel>
        <Panel title="حسب المحافظة"><BarList rows={pairs(r.byGov)} extra={fams(r.byGov)} unit="مساعدة" /></Panel>
        <Panel title="أكتر القرى استفادة"><BarList rows={pairs(r.byVillage)} extra={fams(r.byVillage)} unit="مساعدة" /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title="القوافل والدفعات" sub="آخر 25 قافلة مسجلة" className="lg:col-span-2">
          <NumTable head={["المشروع", "القافلة", "المحافظات", "من", "إلى", "مساعدات", "أسر"]}
            rows={r.convoys.map((x) => [x.project, x.convoy, x.govs, x.from, x.to, x.n, x.f])} />
        </Panel>
        <Panel title="كشوف الترشيح اللي اتبعتت للإدارات">
          <NumTable head={["المشروع", "كشوف", "حالات"]} rows={r.sheets.map((x) => [x.project, x.sheets, x.cases])} />
        </Panel>
      </div>
    </div>
  );
}
