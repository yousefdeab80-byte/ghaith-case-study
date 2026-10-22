import Link from "next/link";
import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { normalizeDigits } from "@/lib/nid";
import { can, requireUser } from "@/lib/server/auth";
import { getProjects } from "@/lib/server/data";
import { AddBenefitForm } from "./add-form";
import { LinkBenefitsButton } from "./link-button";

type SP = { q?: string; project?: string; unlinked?: string; page?: string; linked?: string };
const PAGE = 50;

export default async function BenefitsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("benefits");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const b = schema.benefits;
  const where: SQL[] = [];
  if (sp.q?.trim()) {
    const d = normalizeDigits(sp.q);
    where.push(or(ilike(b.name, `%${sp.q.trim()}%`), ...(d ? [ilike(b.nid, `%${d}%`)] : []))!);
  }
  if (sp.project) where.push(eq(b.projectName, sp.project));
  if (sp.unlinked === "1") where.push(isNull(b.caseId));
  const w = where.length ? and(...where) : undefined;
  const [rows, [{ total }], byProject, projects, unlinked] = await Promise.all([
    db.select().from(b).where(w).orderBy(desc(b.benefitDate), desc(b.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ total: count() }).from(b).where(w),
    db.select({ name: b.projectName, n: sql<number>`sum(${b.quantity})::int` }).from(b).groupBy(b.projectName).orderBy(desc(sql`2`)),
    getProjects(),
    db.$count(b, isNull(b.caseId)),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `/benefits?${new URLSearchParams({ ...sp, linked: "", page: String(p) } as Record<string, string>)}`;

  return (
    <>
      <PageHeader title="المساعدات المنفذة" sub="سجل كل مساعدة اتسلمت لأسرة، القديم والجديد. بيستخدم في شرط عدم الاستفادة القريبة وفي التقارير."
        actions={<a className="btn" href="/api/export/benefits"><Icon name="download" />تصدير إكسل</a>} />
      {sp.linked && <div className="card mb-4 border-good/40 bg-good-tint text-sm font-semibold text-good">تم: اتربط {Number(sp.linked).toLocaleString("ar-EG")} مساعدة بسجل الحالات، واللي ملهمش ملف اتفتح لهم ملف جديد.</div>}
      {unlinked > 0 && can(user, "import") && <LinkBenefitsButton unlinked={unlinked} />}
      <div className="card mb-4"><div className="section-title mb-3">تسجيل مساعدة يدوياً</div><AddBenefitForm projects={projects} /></div>
      {byProject.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {byProject.map((p) => (
            <Link key={p.name} href={`/benefits?project=${encodeURIComponent(p.name)}`} className="badge bg-surface border border-line text-ink py-1 px-3 text-xs">
              {p.name}: <b className="mr-1 text-primary">{p.n.toLocaleString("ar-EG")}</b>
            </Link>
          ))}
        </div>
      )}
      <form className="card mb-4 flex flex-wrap gap-3 items-end" action="/benefits">
        <div className="flex-1 min-w-[200px]"><label className="label">بحث</label><input name="q" defaultValue={sp.q} className="input" placeholder="الاسم أو الرقم القومي" /></div>
        <div><label className="label">المشروع</label>
          <select name="project" defaultValue={sp.project ?? ""} className="input"><option value="">الكل</option>{byProject.map((p) => <option key={p.name}>{p.name}</option>)}</select></div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft pb-2"><input type="checkbox" name="unlinked" value="1" defaultChecked={sp.unlinked === "1"} />مش مربوطة بملف حالة</label>
        <button className="btn btn-primary"><Icon name="search" />بحث</button>
      </form>
      <div className="card p-0"><div className="table-wrap border-0"><table className="table">
        <thead><tr><th>الاسم</th><th>الرقم القومي</th><th>المشروع</th><th>القافلة</th><th>التاريخ</th><th>العدد</th><th>ملف الحالة</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-semibold">{r.name}</td><td dir="ltr" className="text-ink-soft tabular-nums text-right">{r.nid ?? "—"}</td>
              <td>{r.projectName}</td><td>{r.convoy ?? "—"}</td><td className="text-ink-soft">{r.benefitDate ?? "—"}</td><td>{r.quantity}</td>
              <td>{r.caseId ? <Link href={`/cases/${r.caseId}`} className="text-primary font-semibold hover:underline">فتح الملف</Link> : <span className="text-ink-soft text-xs">غير مربوطة</span>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="text-center text-ink-soft py-10">مفيش مساعدات مسجلة</td></tr>}
        </tbody>
      </table></div>
        {pages > 1 && <div className="flex justify-center gap-2 p-3 text-sm">
          {page > 1 && <Link className="btn btn-sm" href={href(page - 1)}>السابق</Link>}<span className="text-ink-soft">صفحة {page} من {pages}</span>
          {page < pages && <Link className="btn btn-sm" href={href(page + 1)}>التالي</Link>}</div>}
      </div>
    </>
  );
}
