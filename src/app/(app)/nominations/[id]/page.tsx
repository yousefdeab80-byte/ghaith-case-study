import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { FilterSelect } from "@/components/filter-select";
import { PRIORITY_LABELS } from "@/lib/constants";
import { toValues } from "@/lib/case-record";
import { evaluateEligibility } from "@/lib/eligibility";
import { distributionLines, fillTemplate, SHEET_STATUS } from "@/lib/nomination";
import { can, requireUser } from "@/lib/server/auth";
import { getLookups, getSetting } from "@/lib/server/data";
import { findCandidates, getEmailTemplate, getSheet, getSheetCases, lastBenefits, type CandidateSearch } from "@/lib/server/sheets";
import { smtpConfigured } from "@/lib/server/mail";
import { CandidatePicker, CloseSheet, DeleteSheet, EmailComposer, ReopenSheet, SheetEditor, SheetTable } from "./client";

const TABS = { cases: "حالات الكشف", add: "إضافة حالات", email: "الإيميل الرسمي", log: "السجل" } as const;
const fmt = (d: Date | string | null, time = false) => (d ? new Date(d).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } : {}) }) : "—");

type SP = CandidateSearch & { tab?: keyof typeof TABS };

export default async function SheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser("nominate");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const found = await getSheet(id);
  if (!found) notFound();
  const { sheet, project } = found;
  const draft = sheet.status === "draft";
  const tab = sp.tab && sp.tab in TABS ? sp.tab : draft ? "cases" : "cases";

  const rows = await getSheetCases(id);
  const benefits = await lastBenefits(rows.map((r) => r.c), project);
  const today = sheet.plannedDate ? new Date(sheet.plannedDate) : new Date();
  const checked = rows.map((r) => {
    const e = evaluateEligibility(project.rulesKey, toValues(r.c), { lastBenefitDate: benefits.get(r.c.id), minDaysBetweenBenefits: project.minDaysBetweenBenefits, today });
    const flags: string[] = [];
    if (!r.c.headNid) flags.push("من غير رقم قومي");
    if (!r.c.phone) flags.push("من غير تليفون");
    if (r.c.status === "excluded") flags.push("الحالة اتستبعدت بعد الترشيح");
    if (sheet.governorate && r.c.governorate && r.c.governorate !== sheet.governorate) flags.push(`من ${r.c.governorate}`);
    return {
      id: r.nomination.id, caseId: r.c.id, fileNo: r.c.fileNo, name: r.c.headName, nid: r.c.headNid, phone: r.c.phone,
      place: [r.c.village, r.c.markaz, r.c.governorate].filter(Boolean).join(" – "), familySize: r.c.familySize,
      priority: r.c.priorityLevel, note: r.nomination.note ?? "", verdict: e.verdict,
      failed: e.checks.filter((c) => c.status === "fail").map((c) => c.label), lastBenefit: benefits.get(r.c.id) ?? null, flags,
    };
  });
  const verdicts = { eligible: 0, incomplete: 0, not_eligible: 0 };
  checked.forEach((c) => verdicts[c.verdict]++);
  const flagged = checked.filter((c) => c.flags.length).length;
  const dist = distributionLines(rows.map((r) => r.c));
  const st = SHEET_STATUS[sheet.status];

  const tabHref = (t: string) => `/nominations/${id}?tab=${t}`;

  return (
    <>
      <PageHeader
        title={sheet.title}
        sub={`${project.name}${sheet.convoy ? ` · قافلة ${sheet.convoy}` : ""} · ${sheet.governorate ?? "أكتر من محافظة"} · تنفيذ ${fmt(sheet.plannedDate)}`}
        actions={<>
          <a href={`/api/export/sheet?id=${id}`} className="btn"><Icon name="download" />تحميل الكشف Excel</a>
          {sheet.status === "sent" && <CloseSheet id={id} />}
          {sheet.status !== "draft" && can(user, "settings") && <ReopenSheet id={id} />}
          {draft && <DeleteSheet id={id} />}
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className={`badge ${st?.cls}`}>{st?.label}</span>
            {sheet.sentAt && <span className="text-xs text-ink-soft">اتبعت {fmt(sheet.sentAt, true)}</span>}
          </div>
          <div className="text-3xl font-extrabold text-primary tabular-nums">
            {rows.length.toLocaleString("ar-EG")}
            {sheet.targetCount ? <span className="text-base text-ink-soft font-semibold"> من {sheet.targetCount.toLocaleString("ar-EG")} مستهدف</span> : <span className="text-base text-ink-soft font-semibold"> حالة</span>}
          </div>
          {sheet.targetCount ? (
            <div className="h-2 rounded-full bg-surface-alt overflow-hidden mt-2">
              <div className={clsx("h-full", rows.length > sheet.targetCount ? "bg-danger" : "bg-primary")} style={{ width: `${Math.min(100, (rows.length / sheet.targetCount) * 100)}%` }} />
            </div>
          ) : null}
          {draft && <div className="mt-4 pt-4 border-t border-line"><SheetEditor sheet={{
            title: sheet.title, convoy: sheet.convoy ?? "", governorate: sheet.governorate ?? "", plannedDate: sheet.plannedDate ?? "",
            targetCount: sheet.targetCount ? String(sheet.targetCount) : "", notes: sheet.notes ?? "",
          }} id={id} governorates={(await getLookups()).governorates} /></div>}
          {!draft && sheet.notes && <p className="text-sm text-ink-soft mt-3">{sheet.notes}</p>}
        </div>

        <div className="card">
          <div className="section-title">مراجعة الكشف قبل الإرسال</div>
          <div className="section-sub">مطابقة كل حالة لمعايير «{project.name}» دلوقتي</div>
          <ul className="text-sm space-y-1.5">
            <li className="flex justify-between"><span>مطابقة</span><b className="text-good tabular-nums">{verdicts.eligible}</b></li>
            <li className="flex justify-between"><span>بياناتها ناقصة</span><b className="text-accent tabular-nums">{verdicts.incomplete}</b></li>
            <li className="flex justify-between"><span>غير مطابقة</span><b className="text-danger tabular-nums">{verdicts.not_eligible}</b></li>
            <li className="flex justify-between"><span>عليها ملاحظات (رقم قومي، تليفون، مكان)</span><b className="tabular-nums">{flagged}</b></li>
          </ul>
          {verdicts.not_eligible > 0 && draft && <p className="text-xs text-danger mt-3">فيه حالات مش مطابقة للمعايير. راجعها في الجدول تحت (معلّمة بالأحمر) قبل الإرسال.</p>}
        </div>

        <div className="card">
          <div className="section-title">التوزيع الجغرافي</div>
          {dist.length ? <ul className="text-sm space-y-1 mt-2">{dist.slice(0, 10).map((l) => <li key={l}>{l.slice(2)}</li>)}</ul> : <p className="text-sm text-ink-soft">الكشف فاضي</p>}
          {dist.length > 10 && <p className="text-xs text-ink-soft mt-1">+ {dist.length - 10} أماكن تانية</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4 border-b border-line">
        {Object.entries(TABS).filter(([k]) => draft || k !== "add").map(([k, l]) => (
          <Link key={k} href={tabHref(k)} className={clsx("px-4 py-2 text-sm font-semibold -mb-px border-b-2", tab === k ? "border-primary text-primary" : "border-transparent text-ink-soft")}>{l}</Link>
        ))}
      </div>

      {tab === "cases" && <SheetTable sheetId={id} rows={checked} editable={draft} />}
      {tab === "add" && draft && <AddTab sheetId={id} sp={sp} />}
      {tab === "email" && <EmailTab sheetId={id} count={rows.length} dist={dist} draft={draft} userName={user.name} warn={verdicts.not_eligible} />}
      {tab === "log" && <LogTab sheetId={id} />}
    </>
  );
}

async function AddTab({ sheetId, sp }: { sheetId: string; sp: SP }) {
  const found = (await getSheet(sheetId))!;
  const [lookups, { list, total }] = await Promise.all([getLookups(), findCandidates(found.sheet, found.project, sp)]);
  const gov = sp.gov ?? found.sheet.governorate ?? "";
  return (
    <>
      <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end" action={`/nominations/${sheetId}`}>
        <input type="hidden" name="tab" value="add" />
        <div className="lg:col-span-2"><label className="label">بحث</label>
          <input name="q" defaultValue={sp.q} className="input" placeholder="الاسم، الرقم القومي، التليفون، القرية، رقم الملف" /></div>
        <FilterSelect name="gov" label="المحافظة" value={gov} options={lookups.governorates.map((g) => [g, g])} />
        <FilterSelect name="priority" label="الأولوية" value={sp.priority} options={Object.entries(PRIORITY_LABELS)} />
        <FilterSelect name="show" label="اعرض" value={sp.show ?? "eligible"} all="كل الحالات" options={[
          ["eligible", "المطابقة + المرشحة من ملفها"], ["incomplete", "المطابقة + الناقصة بيانات"], ["pool", "المرشحة من ملفها بس"],
        ]} />
        <button className="btn btn-primary"><Icon name="search" />بحث</button>
      </form>
      <CandidatePicker sheetId={sheetId} total={total} rows={list.map((x) => ({
        id: x.c.id, fileNo: x.c.fileNo, name: x.c.headName, nid: x.c.headNid,
        place: [x.c.village, x.c.markaz, x.c.governorate].filter(Boolean).join(" – "), familySize: x.c.familySize,
        priority: x.c.priorityLevel, completeness: x.c.completeness, verdict: x.verdict, failed: x.failed,
        lastBenefit: x.lastBenefit, inPool: x.inPool, otherSheet: x.otherSheet,
      }))} />
    </>
  );
}

async function EmailTab({ sheetId, count, dist, draft, userName, warn }: { sheetId: string; count: number; dist: string[]; draft: boolean; userName: string; warn: number }) {
  const found = (await getSheet(sheetId))!;
  const [from, list, tpl, [last]] = await Promise.all([
    getSetting("nominationEmail", "abdallh.mohamed@ghaithfoundation.org"),
    getSetting<{ name: string; email: string }[]>("distributionList", []),
    getEmailTemplate(),
    db.select().from(schema.sheetEmails).where(eq(schema.sheetEmails.sheetId, sheetId)).orderBy(desc(schema.sheetEmails.sentAt)).limit(1),
  ]);
  if (!draft) {
    return last ? <SentEmail e={last} /> : <div className="card text-sm text-ink-soft">مفيش إيميل مسجل للكشف ده.</div>;
  }
  const vars = {
    "المشروع": found.project.name, "الكشف": found.sheet.title, "القافلة": found.sheet.convoy ?? "", "العدد": count,
    "التوزيع": dist.join("\n"), "التاريخ": found.sheet.plannedDate ? fmt(found.sheet.plannedDate) : "",
    "مهلة_التسوية": found.project.settlementDeadlineDays, "المرسل": userName,
  };
  return (
    <EmailComposer sheetId={sheetId} from={from} list={list} count={count} warn={warn} smtp={smtpConfigured()}
      fileName={`${found.project.name} - ${found.sheet.title}`}
      initialSubject={fillTemplate(tpl.subject, vars)} initialBody={fillTemplate(tpl.body, vars)} />
  );
}

function SentEmail({ e }: { e: typeof schema.sheetEmails.$inferSelect }) {
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="badge badge-eligible">{e.method === "smtp" ? "اتبعت من السستم" : "اتبعت من Outlook واتأكد"}</span>
        <span className="text-ink-soft text-xs">{fmt(e.sentAt, true)} · {e.sentByName} · {e.rowCount} حالة</span>
        <a href={`/api/export/sheet-email?id=${e.id}`} className="btn btn-sm mr-auto"><Icon name="download" />الكشف زي ما اتبعت</a>
      </div>
      <div><span className="text-ink-soft">من: </span><span dir="ltr">{e.fromEmail}</span></div>
      <div><span className="text-ink-soft">إلى: </span><span dir="ltr">{e.to.join(", ")}</span></div>
      {e.cc.length > 0 && <div><span className="text-ink-soft">نسخة: </span><span dir="ltr">{e.cc.join(", ")}</span></div>}
      <div><span className="text-ink-soft">الموضوع: </span><b>{e.subject}</b></div>
      <pre className="whitespace-pre-wrap font-sans bg-bg rounded-lg p-3 border border-line">{e.body}</pre>
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  create: "إنشاء الكشف", update: "تعديل بيانات الكشف", add_cases: "إضافة حالات", remove_cases: "شيل حالات",
  send_email: "إرسال الإيميل من السستم", confirm_sent: "تأكيد الإرسال من Outlook", reopen: "فتح الكشف للتعديل", close: "قفل الكشف",
};

async function LogTab({ sheetId }: { sheetId: string }) {
  const [emails, audit] = await Promise.all([
    db.select().from(schema.sheetEmails).where(eq(schema.sheetEmails.sheetId, sheetId)).orderBy(desc(schema.sheetEmails.sentAt)),
    db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entity, "sheet"), eq(schema.auditLog.entityId, sheetId))).orderBy(desc(schema.auditLog.at)).limit(100),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="section-title">الإيميلات اللي اتبعتت</div>
        {emails.length ? emails.map((e) => <SentEmail key={e.id} e={e} />) : <div className="card text-sm text-ink-soft">لسه متبعتش</div>}
      </div>
      <div className="card">
        <div className="section-title">سجل التعديلات</div>
        <ul className="text-sm divide-y divide-line">
          {audit.map((a) => {
            const extra = a.changes ? Object.values(a.changes).map((c) => String(c.to ?? "")).filter(Boolean).join(" · ") : "";
            return (
              <li key={a.id} className="py-2 flex justify-between gap-2">
                <span><b>{ACTIONS[a.action] ?? a.action}</b>{extra && <span className="text-ink-soft"> ({extra})</span>}</span>
                <span className="text-xs text-ink-soft whitespace-nowrap">{a.userName} · {fmt(a.at, true)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
