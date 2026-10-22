import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { CompletenessBar, PriorityBadge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { FORM_TYPES } from "@/lib/constants";
import { completeness, isVisible, sectionsFor } from "@/lib/forms";
import { toValues } from "@/lib/case-record";
import { computePriority, evaluateEligibility } from "@/lib/eligibility";
import { parseNid } from "@/lib/nid";
import { can, requireUser } from "@/lib/server/auth";
import { getProjects } from "@/lib/server/data";
import { DeleteCase, NominateToggle, StatusControl } from "./controls";

const VERDICT: Record<string, [string, string]> = {
  eligible: ["badge-low", "مطابقة"],
  not_eligible: ["badge-high", "غير مطابقة"],
  incomplete: ["badge-mid", "بيانات ناقصة"],
};
const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—");

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("cases.view");
  const { id } = await params;
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.id, id));
  if (!c) notFound();

  const nids = [c.headNid, c.wifeNid].filter(Boolean) as string[];
  const benefitWhere = nids.length
    ? or(eq(schema.benefits.caseId, c.id), and(isNotNull(schema.benefits.nid), or(...nids.map((n) => eq(schema.benefits.nid, n)))))
    : eq(schema.benefits.caseId, c.id);
  const [projects, noms, benefits, audit] = await Promise.all([
    getProjects(true),
    db.select().from(schema.nominations).where(eq(schema.nominations.caseId, c.id)),
    db.select().from(schema.benefits).where(benefitWhere).orderBy(desc(schema.benefits.benefitDate)),
    db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entity, "case"), eq(schema.auditLog.entityId, c.id))).orderBy(desc(schema.auditLog.at)).limit(30),
  ]);

  const values = toValues(c);
  const comp = completeness(values);
  const prio = computePriority(values);
  const nominated = new Set(noms.map((n) => n.projectId));
  const lastBenefit = (name: string) => benefits.find((b) => b.projectName === name)?.benefitDate ?? null;
  const headInfo = c.headNid ? parseNid(c.headNid) : null;
  const canNominate = can(user, "nominate");

  return (
    <>
      <PageHeader
        title={c.headName}
        sub={`ملف رقم ${c.fileNo} · ${FORM_TYPES.find((f) => f.id === c.formType)?.label ?? ""} · اتسجل ${fmt(c.createdAt)}`}
        actions={<>
          {can(user, "cases.edit") && <Link href={`/cases/${c.id}/edit`} className="btn btn-primary"><Icon name="edit" />تعديل / تكملة البيانات</Link>}
          {can(user, "cases.delete") && <DeleteCase id={c.id} />}
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div className="card">
          <div className="flex gap-2 mb-3"><StatusBadge status={c.status} /><PriorityBadge level={c.priorityLevel} /></div>
          {c.status === "excluded" && c.exclusionReason && <p className="text-sm text-danger mb-2">سبب الاستبعاد: {c.exclusionReason}</p>}
          <Kv k="الرقم القومي" v={c.headNid ? <span dir="ltr">{c.headNid}</span> : "—"} />
          {headInfo?.valid && <Kv k="من الرقم القومي" v={`${headInfo.age} سنة · ${headInfo.gender} · مواليد ${headInfo.governorate}`} />}
          <Kv k="التليفون" v={c.phone ? <span dir="ltr">{c.phone}</span> : "—"} />
          <Kv k="المكان" v={[c.village, c.markaz, c.governorate].filter(Boolean).join(" – ") || "—"} />
          <Kv k="عدد الأفراد" v={c.familySize ?? "—"} />
          <Kv k="الدخل / المصروفات" v={`${c.totalIncome ?? "—"} / ${c.totalExpenses ?? "—"} جنيه`} />
          {can(user, "cases.status") && <div className="mt-4 pt-4 border-t border-line"><StatusControl id={c.id} status={c.status} /></div>}
        </div>

        <div className="card">
          <div className="section-title">الأولوية</div>
          <div className="section-sub">حسب نظام اختيار الحالات: الحالة الزوجية ← الدخل ← الصحة ← عدد الأفراد ← الأسقف</div>
          <div className="flex flex-wrap gap-1.5">
            {prio.reasons.length ? prio.reasons.map((r) => <span key={r} className="badge bg-surface-alt text-ink">{r}</span>) : <span className="text-sm text-ink-soft">مفيش عوامل أولوية مسجلة</span>}
          </div>
          <div className="section-title mt-5">اكتمال البيانات</div>
          <CompletenessBar percent={comp.percent} />
          {comp.missing.length > 0 && <p className="text-xs text-ink-soft mt-2">ناقص: {comp.missing.join("، ")}</p>}
        </div>

        <div className="card">
          <div className="section-title">سجل الاستفادات</div>
          <div className="section-sub">كل المساعدات اللي الأسرة استلمتها قبل كده</div>
          {benefits.length ? (
            <ul className="space-y-2 text-sm">
              {benefits.map((b) => (
                <li key={b.id} className="flex justify-between gap-2 border-b border-line pb-1.5">
                  <span className="font-semibold">{b.projectName}{b.convoy ? ` · قافلة ${b.convoy}` : ""}</span>
                  <span className="text-ink-soft text-xs">{fmt(b.benefitDate)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">مفيش استفادات مسجلة</p>}
        </div>
      </div>

      <div className="card mb-4">
        <div className="section-title">مطابقة معايير المشروعات والترشيح</div>
        <div className="section-sub">السستم بيقارن بيانات الحالة بمعايير الاستحقاق والاستبعاد لكل مشروع من السياسات. افتح أي مشروع عشان تشوف التفاصيل.</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const e = evaluateEligibility(p.rulesKey, values, { lastBenefitDate: lastBenefit(p.name), minDaysBetweenBenefits: p.minDaysBetweenBenefits });
            const [cls, label] = VERDICT[e.verdict];
            return (
              <details key={p.id} className="rounded-lg border border-line bg-bg/50 px-3 py-2">
                <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                  <span className="font-bold text-sm">{p.name}</span>
                  <span className="flex items-center gap-2">
                    <span className={`badge ${cls}`}>{label}</span>
                    {canNominate && <NominateToggle caseId={c.id} projectId={p.id} on={nominated.has(p.id)} />}
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {e.checks.map((ch) => (
                    <li key={ch.label} className="flex gap-1.5">
                      <span className={ch.status === "pass" ? "text-good" : ch.status === "fail" ? "text-danger" : "text-accent"}>
                        {ch.status === "pass" ? "✓" : ch.status === "fail" ? "✗" : "؟"}
                      </span>
                      <span>{ch.label}{ch.exclusion && ch.status === "fail" ? " (سبب استبعاد)" : ""}</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {sectionsFor(c.formType).map((s) => {
          const fields = s.fields.filter((f) => isVisible(f, values));
          return (
            <div key={s.id} className="card">
              <div className="section-title mb-3">{s.title}</div>
              {fields.map((f) => {
                const v = values[f.key];
                if (f.type === "members") {
                  const members = (v as { name?: string; relation?: string; age?: string; eduStage?: string; job?: string }[]) ?? [];
                  return members.length ? (
                    <div key={f.key} className="table-wrap mt-2"><table className="table">
                      <thead><tr><th>الاسم</th><th>القرابة</th><th>السن</th><th>التعليم</th><th>العمل</th></tr></thead>
                      <tbody>{members.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.relation}</td><td>{m.age}</td><td>{m.eduStage}</td><td>{m.job}</td></tr>)}</tbody>
                    </table></div>
                  ) : null;
                }
                const shown = Array.isArray(v) ? v.join("، ") : v === undefined || v === null || v === "" ? null : String(v);
                return <Kv key={f.key} k={f.label} v={shown ?? <span className="text-danger/70">—</span>} />;
              })}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="section-title">سجل التعديلات</div>
        <div className="section-sub">مين عدّل إيه وامتى</div>
        {audit.length ? (
          <ul className="text-xs space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="border-b border-line pb-2">
                <b>{a.userName ?? "النظام"}</b> · {ACTION_LABELS[a.action] ?? a.action} · <span className="text-ink-soft">{new Date(a.at).toLocaleString("ar-EG")}</span>
                {a.changes && a.action === "update" && (
                  <div className="text-ink-soft mt-1">{Object.entries(a.changes).slice(0, 8).map(([k, ch]) => `${k}: ${fmtVal(ch.from)} ← ${fmtVal(ch.to)}`).join(" · ")}</div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-soft">مفيش تعديلات</p>}
      </div>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = { create: "سجّل الحالة", update: "عدّل البيانات", status: "غيّر حالة الملف", nominate: "رشّح لمشروع", unnominate: "شال ترشيح", import: "استيراد", merge: "دمج من ملف إكسل" };
const fmtVal = (v: unknown) => (v === null || v === undefined || v === "" ? "فاضي" : Array.isArray(v) ? v.join("،") : typeof v === "object" ? "…" : String(v));

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-line/60 text-sm last:border-0">
      <span className="text-ink-soft">{k}</span><span className="font-semibold text-left">{v}</span>
    </div>
  );
}
