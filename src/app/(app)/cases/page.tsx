import Link from "next/link";
import { asc, count, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { CompletenessBar, PriorityBadge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { FilterSelect } from "@/components/filter-select";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/server/auth";
import { getLookups, getProjects } from "@/lib/server/data";
import { caseFilters, type CaseSearch as SP } from "@/lib/server/case-query";

const PAGE = 50;

export default async function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("cases.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = caseFilters(sp);
  const order = sp.sort === "priority" ? [desc(schema.cases.priorityScore)]
    : sp.sort === "completeness" ? [asc(schema.cases.completeness)]
    : [desc(schema.cases.fileNo)];
  const [rows, [{ total }], lookups, projects] = await Promise.all([
    db.select().from(schema.cases).where(where).orderBy(...order).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ total: count() }).from(schema.cases).where(where),
    getLookups(),
    getProjects(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/cases?${p}`;
  };
  const exportHref = `/api/export/cases?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][])}`;

  return (
    <>
      <PageHeader title="سجل الحالات" sub={`${total.toLocaleString("ar-EG")} حالة`}
        actions={<>
          <a href={exportHref} className="btn"><Icon name="download" />تصدير إكسل</a>
          <Link href="/cases/new" className="btn btn-primary"><Icon name="plus" />حالة جديدة</Link>
        </>} />

      <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end" action="/cases">
        <div className="lg:col-span-2">
          <label className="label">بحث</label>
          <input name="q" defaultValue={sp.q} className="input" placeholder="الاسم، الرقم القومي، التليفون، القرية، رقم الملف" />
        </div>
        <FilterSelect name="status" label="حالة الملف" value={sp.status} options={Object.entries(STATUS_LABELS)} />
        <FilterSelect name="gov" label="المحافظة" value={sp.gov} options={lookups.governorates.map((g) => [g, g])} />
        <FilterSelect name="priority" label="الأولوية" value={sp.priority} options={Object.entries(PRIORITY_LABELS)} />
        <FilterSelect name="project" label="مرشحة لمشروع" value={sp.project} options={projects.map((p) => [p.id, p.name])} />
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft whitespace-nowrap">
            <input type="checkbox" name="incomplete" value="1" defaultChecked={sp.incomplete === "1"} />بيانات ناقصة
          </label>
          <button className="btn btn-primary flex-1"><Icon name="search" />بحث</button>
        </div>
        <input type="hidden" name="sort" value={sp.sort ?? ""} />
      </form>

      <div className="card p-0">
        <div className="table-wrap border-0">
          <table className="table">
            <thead>
              <tr>
                <th><Link href={qs({ sort: undefined, page: undefined })}>رقم الملف</Link></th>
                <th>الاسم</th><th>الرقم القومي</th><th>المكان</th><th>حالة الملف</th>
                <th><Link href={qs({ sort: "priority", page: undefined })}>الأولوية ▾</Link></th>
                <th><Link href={qs({ sort: "completeness", page: undefined })}>اكتمال البيانات ▴</Link></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-bg">
                  <td className="tabular-nums text-ink-soft">{c.fileNo}</td>
                  <td><Link href={`/cases/${c.id}`} className="font-bold text-primary hover:underline">{c.headName}</Link>
                    {c.wifeName && <div className="text-[11px] text-ink-soft">{c.wifeName}</div>}</td>
                  <td className="tabular-nums text-ink-soft" dir="ltr">{c.headNid ?? "—"}</td>
                  <td className="text-ink-soft text-xs">{[c.village, c.markaz, c.governorate].filter(Boolean).join(" – ") || "—"}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><PriorityBadge level={c.priorityLevel} /></td>
                  <td><CompletenessBar percent={c.completeness} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="text-center text-ink-soft py-10">مفيش حالات مطابقة</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 text-sm">
            {page > 1 && <Link className="btn btn-sm" href={qs({ page: String(page - 1) })}>السابق</Link>}
            <span className="text-ink-soft">صفحة {page} من {pages}</span>
            {page < pages && <Link className="btn btn-sm" href={qs({ page: String(page + 1) })}>التالي</Link>}
          </div>
        )}
      </div>
    </>
  );
}
