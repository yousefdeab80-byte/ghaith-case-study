import Link from "next/link";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { FilterSelect } from "@/components/filter-select";
import { requireUser } from "@/lib/server/auth";
import { getLookups, getProjects } from "@/lib/server/data";
import { SHEET_STATUS } from "@/lib/nomination";
import { NewSheetForm } from "./new-sheet-form";

const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—");

export default async function NominationsPage({ searchParams }: { searchParams: Promise<{ project?: string; status?: string; new?: string }> }) {
  await requireUser("nominate");
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.project) where.push(eq(schema.sheets.projectId, sp.project));
  if (sp.status) where.push(eq(schema.sheets.status, sp.status));

  const [projects, lookups, sheets, counts, pool] = await Promise.all([
    getProjects(),
    getLookups(),
    db.select({ s: schema.sheets, projectName: schema.projects.name }).from(schema.sheets)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.sheets.projectId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(schema.sheets.updatedAt)).limit(200),
    db.select({ sheetId: schema.nominations.sheetId, n: count() }).from(schema.nominations).groupBy(schema.nominations.sheetId),
    db.select({ projectId: schema.nominations.projectId, n: count() }).from(schema.nominations)
      .where(isNull(schema.nominations.sheetId)).groupBy(schema.nominations.projectId),
  ]);
  const sizeOf = new Map(counts.map((c) => [c.sheetId, c.n]));
  const poolOf = new Map(pool.map((p) => [p.projectId, p.n]));
  const active = projects.filter((p) => p.active);
  const waiting = active.filter((p) => poolOf.get(p.id));

  return (
    <>
      <PageHeader title="الترشيحات وكشوف الإرسال" sub="كل كشف = تنفيذ واحد (قافلة / دفعة) من مشروع. بتضيف له الحالات المطابقة، وبعدين تبعته للإدارات بإيميل رسمي فيتقفل." />

      <details className="card mb-4" open={sp.new === "1" || sheets.length === 0}>
        <summary className="section-title cursor-pointer list-none"><Icon name="plus" />كشف ترشيح جديد</summary>
        <div className="mt-3">
          <NewSheetForm projects={active.map((p) => ({ id: p.id, name: p.name }))} governorates={lookups.governorates} defaultProject={sp.project} />
        </div>
      </details>

      {waiting.length > 0 && (
        <div className="card mb-4">
          <div className="section-title">حالات مرشحة من ملفاتها ومستنية كشف</div>
          <div className="section-sub">اترشحت من صفحة الحالة ولسه متحطتش في كشف. افتح كشف للمشروع وهتلاقيها أول القائمة.</div>
          <div className="flex flex-wrap gap-2">
            {waiting.map((p) => (
              <Link key={p.id} href={`/nominations?project=${p.id}&new=1`} className="badge bg-primary-tint text-primary py-1.5 px-3">
                {p.name}: {poolOf.get(p.id)?.toLocaleString("ar-EG")}
              </Link>
            ))}
          </div>
        </div>
      )}

      <form className="card mb-4 grid gap-3 sm:grid-cols-3 items-end" action="/nominations">
        <FilterSelect name="project" label="المشروع" value={sp.project} options={projects.map((p) => [p.id, p.name])} />
        <FilterSelect name="status" label="حالة الكشف" value={sp.status} options={Object.entries(SHEET_STATUS).map(([k, v]) => [k, v.label])} />
        <button className="btn btn-primary"><Icon name="search" />عرض</button>
      </form>

      <div className="card p-0">
        <div className="table-wrap border-0">
          <table className="table">
            <thead><tr><th>الكشف</th><th>المشروع</th><th>المكان</th><th>تاريخ التنفيذ</th><th>عدد الحالات</th><th>الحالة</th><th>آخر تعديل</th></tr></thead>
            <tbody>
              {sheets.map(({ s, projectName }) => {
                const n = sizeOf.get(s.id) ?? 0;
                const st = SHEET_STATUS[s.status];
                return (
                  <tr key={s.id} className="hover:bg-bg">
                    <td><Link href={`/nominations/${s.id}`} className="font-bold text-primary hover:underline">{s.title}</Link>
                      {s.convoy && <div className="text-[11px] text-ink-soft">قافلة {s.convoy}</div>}</td>
                    <td>{projectName}</td>
                    <td className="text-xs text-ink-soft">{s.governorate ?? "أكتر من محافظة"}</td>
                    <td className="text-xs">{fmt(s.plannedDate)}</td>
                    <td className="tabular-nums">{n.toLocaleString("ar-EG")}{s.targetCount ? <span className="text-ink-soft text-xs"> / {s.targetCount.toLocaleString("ar-EG")}</span> : null}</td>
                    <td><span className={`badge ${st?.cls}`}>{st?.label ?? s.status}</span></td>
                    <td className="text-xs text-ink-soft">{fmt(s.updatedAt)}</td>
                  </tr>
                );
              })}
              {!sheets.length && <tr><td colSpan={7} className="text-center text-ink-soft py-8">مفيش كشوف لسه</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
