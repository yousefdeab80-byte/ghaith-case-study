import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/filter-select";
import { Icon } from "@/components/icons";
import { BarList, Columns, Kpi, NumTable, Panel, monthLabel, n } from "@/components/report-ui";
import { GOVERNORATES, STATUS_LABELS } from "@/lib/constants";
import { casesReport, type CaseReportFilter } from "@/lib/server/reports";
import { PrintButton } from "./tabs";

export const dynamic = "force-dynamic";

const pctOf = (v: number, total: number) => (total ? `${Math.round((v / total) * 100).toLocaleString("ar-EG")}%` : "—");

export default async function CasesReportPage({ searchParams }: { searchParams: Promise<CaseReportFilter> }) {
  const f = await searchParams;
  const r = await casesReport(f);
  const t = r.totals;
  const status = Object.fromEntries(r.status);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const filterText = [f.gov, f.status && STATUS_LABELS[f.status], f.from && `من ${f.from}`, f.to && `إلى ${f.to}`].filter(Boolean).join(" · ");

  return (
    <div className="report">
      <PageHeader title="تقرير قاعدة بيانات الحالات"
        sub={`كل الأسر المسجلة في سجل الحالات: مين هم، فين، وظروفهم إيه${filterText ? ` — ${filterText}` : ""}. اتعمل ${new Date().toLocaleDateString("ar-EG", { dateStyle: "long" })}`}
        actions={<><a className="btn print:hidden" href={`/api/export/report-cases${qs ? `?${qs}` : ""}`}><Icon name="download" />تصدير إكسل</a><span className="print:hidden"><PrintButton /></span></>} />

      <form className="card mb-5 flex flex-wrap gap-3 items-end print:hidden" action="/reports">
        <FilterSelect name="gov" label="المحافظة" value={f.gov} options={GOVERNORATES.map((g) => [g, g])} />
        <FilterSelect name="status" label="حالة الملف" value={f.status} options={Object.entries(STATUS_LABELS)} />
        <div><label className="label">مسجلة من</label><input type="date" name="from" defaultValue={f.from} className="input" /></div>
        <div><label className="label">إلى</label><input type="date" name="to" defaultValue={f.to} className="input" /></div>
        <button className="btn btn-primary"><Icon name="search" />عرض</button>
        {qs && <a href="/reports" className="btn">مسح الفلاتر</a>}
      </form>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi big label="الأسر المسجلة" value={t.total} foot={`في ${n(t.governorates)} محافظة و${n(t.villages)} قرية`} />
        <Kpi big label="إجمالي الأفراد" value={t.people} foot={`متوسط ${n(t.avgFamily)} فرد للأسرة`} />
        <Kpi big label="الأطفال" value={t.children} foot="حسب المسجل في الاستمارات" />
        <Kpi big label="أسر استفادت فعلاً" value={t.benefited} foot={`${pctOf(t.benefited, t.total)} من المسجلين`} />
        <Kpi label="مؤهلة ومستنية مساعدة" value={status[STATUS_LABELS.eligible] ?? 0} tone="accent" />
        <Kpi label="قيد الدراسة" value={status[STATUS_LABELS.study] ?? 0} />
        <Kpi label="بياناتها مكتملة 100%" value={t.complete} foot={`متوسط اكتمال البيانات ${n(t.avgCompleteness)}%`} />
        <Kpi label="اتسجلت الشهر ده" value={t.thisMonth} foot={`${pctOf(t.withNid, t.total)} معاها رقم قومي · ${pctOf(t.withPhone, t.total)} معاها تليفون`} />
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">حالة الملفات</h2>
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title="حسب حالة الملف"><BarList rows={r.status} unit="أسرة" /></Panel>
        <Panel title="حسب الأولوية" sub="من غير المستبعدة، حسب المراحل الخمسة للفلترة"><BarList rows={r.priority} unit="أسرة" /></Panel>
        <Panel title="اكتمال البيانات" sub="نسبة الحقول المتملية في الاستمارة"><BarList rows={r.completeness} unit="أسرة" /></Panel>
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">التوزيع الجغرافي</h2>
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title="حسب المحافظة"><BarList rows={r.gov} unit="أسرة" /></Panel>
        <Panel title="أكبر المراكز"><BarList rows={r.markaz} unit="أسرة" /></Panel>
        <Panel title="أكبر القرى"><BarList rows={r.village} unit="أسرة" /></Panel>
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">الظروف الاجتماعية والصحية</h2>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Panel title="الحالة الاجتماعية لرب الأسرة"><BarList rows={r.marital} unit="أسرة" /></Panel>
        <Panel title="الحالة الصحية"><BarList rows={r.health} unit="أسرة" /></Panel>
        <Panel title="عدد أفراد الأسرة"><BarList rows={r.family} unit="أسرة" /></Panel>
        <Panel title="نوع السقف"><BarList rows={r.roof} unit="أسرة" /></Panel>
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">الوضع الاقتصادي</h2>
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title="مصدر الدخل"><BarList rows={r.income} unit="أسرة" /></Panel>
        <Panel title="إجمالي الدخل الشهري" sub={`بالجنيه · متوسط دخل الأسرة ${n(t.avgIncome)} جنيه`}><BarList rows={r.incomeBuckets} unit="أسرة" /></Panel>
        <Panel title="نصيب الفرد من الدخل" sub="الدخل الشهري ÷ عدد الأفراد"><BarList rows={r.perCapita} unit="أسرة" /></Panel>
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">الاحتياجات والترشيحات</h2>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Panel title="التدخلات المقترحة من الباحث" sub="عدد الأسر اللي اترشح لها كل تدخل في الاستمارة"><BarList rows={r.recommendations} unit="أسرة" /></Panel>
        <Panel title="الترشيحات للمشروعات" sub="مرشحة من ملفها، في كشف لسه متبعتش، واتبعتت للإدارات">
          <NumTable head={["المشروع", "مستنية كشف", "في كشف (مسودة)", "اتبعتت"]} rows={r.nominations.map((x) => [x.project, x.pool, x.draft, x.sent])} />
        </Panel>
      </div>

      <h2 className="text-lg font-extrabold text-primary mt-6 mb-3">التسجيل</h2>
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Panel title="الأسر المسجلة شهرياً" sub="آخر 12 شهر" className="lg:col-span-3"><Columns rows={r.months} label={monthLabel} unit="أسرة" /></Panel>
        <Panel title="مصدر التسجيل"><BarList rows={r.source} unit="أسرة" /></Panel>
        <Panel title="نوع الاستمارة"><BarList rows={r.formType} unit="أسرة" /></Panel>
        <Panel title="أكتر الباحثين تسجيلاً"><BarList rows={r.explorers} unit="أسرة" /></Panel>
      </div>
    </div>
  );
}
