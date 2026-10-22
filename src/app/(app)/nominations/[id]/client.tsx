"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/icons";
import { PRIORITY_LABELS } from "@/lib/constants";
import { mailtoUrl, outlookWebUrl, parseEmails } from "@/lib/nomination";
import {
  addToSheet, closeSheet, deleteSheet, removeFromSheet, reopenSheet, sendSheet, setNominationNote, updateSheet,
} from "../actions";

type Verdict = "eligible" | "not_eligible" | "incomplete";
const VERDICT: Record<Verdict, [string, string]> = {
  eligible: ["badge-low", "مطابقة"], not_eligible: ["badge-high", "غير مطابقة"], incomplete: ["badge-mid", "ناقصة"],
};
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "");

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<unknown>, ok?: string) => start(async () => {
    setMsg(null);
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  });
  const note = msg && <span className={clsx("text-xs", msg.ok ? "text-good" : "text-danger")}>{msg.text}</span>;
  return { pending, run, note, setMsg };
}

// ------------------------------------------------------------- بيانات الكشف

type SheetFields = { title: string; convoy: string; governorate: string; plannedDate: string; targetCount: string; notes: string };

export function SheetEditor({ id, sheet, governorates }: { id: string; sheet: SheetFields; governorates: string[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(sheet);
  const { pending, run, note } = useRun();
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Icon name="edit" className="w-4 h-4" />تعديل بيانات الكشف</button>;
  const set = (k: keyof SheetFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label">اسم الكشف</label><input className="input" value={f.title} onChange={set("title")} /></div>
      <div><label className="label">القافلة</label><input className="input" value={f.convoy} onChange={set("convoy")} /></div>
      <div><label className="label">المحافظة</label>
        <select className="input" value={f.governorate} onChange={set("governorate")}><option value="">أكتر من محافظة</option>{governorates.map((g) => <option key={g}>{g}</option>)}</select></div>
      <div><label className="label">تاريخ التنفيذ</label><input className="input" type="date" value={f.plannedDate} onChange={set("plannedDate")} /></div>
      <div><label className="label">المستهدف</label><input className="input" inputMode="numeric" value={f.targetCount} onChange={set("targetCount")} /></div>
      <div className="sm:col-span-2"><label className="label">ملاحظات</label><textarea className="input" value={f.notes} onChange={set("notes")} /></div>
      <div className="sm:col-span-2 flex gap-2 items-center">
        <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => run(() => updateSheet(id, f), "تم الحفظ")}>حفظ</button>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>إغلاق</button>{note}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- حالات الكشف

export type SheetRow = {
  id: string; caseId: string; fileNo: number; name: string; nid: string | null; phone: string | null; place: string;
  familySize: number | null; priority: string; note: string; verdict: Verdict; failed: string[]; lastBenefit: string | null; flags: string[];
};

export function SheetTable({ sheetId, rows, editable }: { sheetId: string; rows: SheetRow[]; editable: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "problems">("all");
  const { pending, run, note } = useRun();
  const shown = filter === "problems" ? rows.filter((r) => r.verdict !== "eligible" || r.flags.length) : rows;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const remove = (backToPool: boolean) => run(async () => { await removeFromSheet(sheetId, [...sel], backToPool); setSel(new Set()); }, "اتشالت من الكشف");

  if (!rows.length) {
    return (
      <div className="card text-center py-10 text-ink-soft">
        الكشف فاضي. {editable && <Link href={`/nominations/${sheetId}?tab=add`} className="text-primary font-bold hover:underline">ضيف حالات</Link>}
      </div>
    );
  }
  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
        <button className={clsx("btn btn-sm", filter === "all" && "bg-primary-tint")} onClick={() => setFilter("all")}>الكل ({rows.length})</button>
        <button className={clsx("btn btn-sm", filter === "problems" && "bg-primary-tint")} onClick={() => setFilter("problems")}>
          محتاجة مراجعة ({rows.filter((r) => r.verdict !== "eligible" || r.flags.length).length})
        </button>
        {editable && sel.size > 0 && <>
          <span className="text-xs text-ink-soft mr-auto">محدد {sel.size}</span>
          <button className="btn btn-sm" disabled={pending} onClick={() => remove(true)}>شيل من الكشف وسيبها مرشحة</button>
          <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => remove(false)}>شيل من الكشف وإلغي ترشيحها</button>
        </>}
        {note}
      </div>
      <div className="table-wrap border-0">
        <table className="table">
          <thead><tr>
            {editable && <th className="w-8"><input type="checkbox" checked={sel.size === shown.length && shown.length > 0}
              onChange={(e) => setSel(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} /></th>}
            <th>م</th><th>الاسم</th><th>الرقم القومي</th><th>التليفون</th><th>المكان</th><th>الأفراد</th><th>الأولوية</th><th>المعايير</th><th>ملاحظات</th>
          </tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className={clsx(r.verdict === "not_eligible" && "bg-danger-tint/40")}>
                {editable && <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td className="tabular-nums text-ink-soft">{i + 1}</td>
                <td><Link href={`/cases/${r.caseId}`} className="font-bold text-primary hover:underline" target="_blank">{r.name}</Link>
                  <div className="text-[11px] text-ink-soft">ملف {r.fileNo}</div></td>
                <td className="tabular-nums text-xs" dir="ltr">{r.nid ?? "—"}</td>
                <td className="tabular-nums text-xs" dir="ltr">{r.phone ?? "—"}</td>
                <td className="text-xs text-ink-soft">{r.place || "—"}</td>
                <td className="tabular-nums">{r.familySize ?? "—"}</td>
                <td><span className={`badge badge-${r.priority}`}>{PRIORITY_LABELS[r.priority]}</span></td>
                <td>
                  <span className={`badge ${VERDICT[r.verdict][0]}`}>{VERDICT[r.verdict][1]}</span>
                  {r.failed.length > 0 && <div className="text-[11px] text-danger mt-1">{r.failed.join("، ")}</div>}
                  {r.lastBenefit && <div className="text-[11px] text-ink-soft mt-1">آخر استفادة: {fmtDate(r.lastBenefit)}</div>}
                  {r.flags.map((f) => <div key={f} className="text-[11px] text-accent">{f}</div>)}
                </td>
                <td className="min-w-[160px]">{editable ? <NoteCell sheetId={sheetId} id={r.id} value={r.note} /> : <span className="text-xs">{r.note}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoteCell({ sheetId, id, value }: { sheetId: string; id: string; value: string }) {
  const [v, setV] = useState(value);
  const { run, note } = useRun();
  return (
    <div>
      <input className="input py-1 text-xs" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && run(() => setNominationNote(sheetId, id, v))} placeholder="—" />
      {note}
    </div>
  );
}

// ------------------------------------------------------------- إضافة حالات

export type CandidateRow = {
  id: string; fileNo: number; name: string; nid: string | null; place: string; familySize: number | null; priority: string;
  completeness: number; verdict: Verdict; failed: string[]; lastBenefit: string | null; inPool: boolean; otherSheet: string | null;
};

export function CandidatePicker({ sheetId, rows, total }: { sheetId: string; rows: CandidateRow[]; total: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { pending, run, note } = useRun();
  const selectable = useMemo(() => rows.filter((r) => r.verdict !== "not_eligible"), [rows]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const add = () => {
    const bad = rows.filter((r) => sel.has(r.id) && r.verdict === "not_eligible").length;
    if (bad && !confirm(`فيه ${bad} حالة من المحددة غير مطابقة لمعايير المشروع. تضيفها برضه؟`)) return;
    doAdd();
  };
  const doAdd = () => run(async () => {
    const n = await addToSheet(sheetId, [...sel]);
    setSel(new Set());
    router.refresh();
    return n;
  }, `اتضاف ${sel.size} للكشف`);

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line sticky top-0 bg-surface z-10">
        <span className="text-sm text-ink-soft">
          {total > rows.length ? `أول ${rows.length} من ${total} حالة (بالأولوية). ضيّق البحث عشان تشوف الباقي.` : `${rows.length} حالة`}
        </span>
        <button className="btn btn-sm" onClick={() => setSel(new Set(selectable.map((r) => r.id)))}>تحديد كل المطابقة</button>
        {sel.size > 0 && <button className="btn btn-sm" onClick={() => setSel(new Set())}>إلغاء التحديد</button>}
        <button className="btn btn-primary btn-sm mr-auto" disabled={pending || !sel.size} onClick={add}>
          <Icon name="plus" className="w-4 h-4" />إضافة المحدد للكشف ({sel.size})
        </button>
        {note}
      </div>
      <div className="table-wrap border-0">
        <table className="table">
          <thead><tr><th className="w-8" /><th>الاسم</th><th>الرقم القومي</th><th>المكان</th><th>الأفراد</th><th>الأولوية</th><th>اكتمال</th><th>المعايير</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={clsx("cursor-pointer hover:bg-bg", sel.has(r.id) && "bg-primary-tint/50")} onClick={() => toggle(r.id)}>
                <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /></td>
                <td>
                  <Link href={`/cases/${r.id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="font-bold text-primary hover:underline">{r.name}</Link>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <span className="text-[11px] text-ink-soft">ملف {r.fileNo}</span>
                    {r.inPool && <span className="badge bg-primary-tint text-primary text-[10px]">مرشحة من ملفها</span>}
                  </div>
                </td>
                <td className="tabular-nums text-xs" dir="ltr">{r.nid ?? "—"}</td>
                <td className="text-xs text-ink-soft">{r.place || "—"}</td>
                <td className="tabular-nums">{r.familySize ?? "—"}</td>
                <td><span className={`badge badge-${r.priority}`}>{PRIORITY_LABELS[r.priority]}</span></td>
                <td className="tabular-nums text-xs">{r.completeness}%</td>
                <td>
                  <span className={`badge ${VERDICT[r.verdict][0]}`}>{VERDICT[r.verdict][1]}</span>
                  {r.failed.length > 0 && <div className="text-[11px] text-danger mt-1">{r.failed.join("، ")}</div>}
                  {r.lastBenefit && <div className="text-[11px] text-ink-soft mt-1">آخر استفادة: {fmtDate(r.lastBenefit)}</div>}
                  {r.otherSheet && <div className="text-[11px] text-accent mt-1">موجودة في كشف «{r.otherSheet}»</div>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="text-center text-ink-soft py-8">مفيش حالات بالفلاتر دي</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- الإيميل

export function EmailComposer({ sheetId, from, list, count, warn, smtp, fileName, initialSubject, initialBody }: {
  sheetId: string; from: string; list: { name: string; email: string }[]; count: number; warn: number; smtp: boolean;
  fileName: string; initialSubject: string; initialBody: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState(list.map((d) => d.email).join(", "));
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [confirmManual, setConfirmManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const { pending, run, note, setMsg } = useRun();
  const toList = parseEmails(to), ccList = parseEmails(cc);
  const bad = [...toList.invalid, ...ccList.invalid];
  const ready = count > 0 && toList.valid.length > 0 && !bad.length && subject.trim();

  const toggleRecipient = (email: string) => {
    const cur = toList.valid;
    setTo((cur.includes(email.toLowerCase()) ? cur.filter((e) => e !== email.toLowerCase()) : [...cur, email]).join(", "));
  };
  const send = (method: "smtp" | "manual") => run(async () => {
    const res = await sendSheet(sheetId, { to, cc, subject, body, method });
    if (!res.ok) throw new Error(res.error);
    router.push(`/nominations/${sheetId}?tab=log`);
    router.refresh();
  });
  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card lg:col-span-2 space-y-3">
        <div><label className="label">من</label><input className="input bg-surface-alt" dir="ltr" value={from} readOnly /></div>
        <div>
          <label className="label">إلى *</label>
          <textarea className="input min-h-[60px]" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@ghaithfoundation.org, ..." />
          {list.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {list.map((d) => {
                const on = toList.valid.includes(d.email.toLowerCase());
                return (
                  <button key={d.email} type="button" onClick={() => toggleRecipient(d.email)}
                    className={clsx("badge border py-1 px-2.5", on ? "bg-primary text-white border-primary" : "bg-white border-line text-ink")}>
                    {on && <Icon name="check" className="w-3 h-3 ml-1" />}{d.name || d.email}
                  </button>
                );
              })}
            </div>
          )}
          {!list.length && <p className="text-[11px] text-ink-soft mt-1">تقدر تحفظ إيميلات الإدارات في <Link href="/settings?tab=email" className="text-primary underline">الإعدادات</Link> عشان تظهر هنا.</p>}
        </div>
        <div><label className="label">نسخة (CC)</label><input className="input" dir="ltr" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        {bad.length > 0 && <p className="text-xs text-danger">إيميلات مش مظبوطة: {bad.join("، ")}</p>}
        <div><label className="label">الموضوع *</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><label className="label">نص الإيميل</label><textarea className="input min-h-[320px] leading-7" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <p className="text-xs text-ink-soft"><Icon name="info" className="w-3.5 h-3.5 inline ml-1" />المرفق: {fileName}.xlsx ({count} حالة) فيه عمود «استلم» و«توقيع المستلم» عشان يرجع في التسوية.</p>
      </div>

      <div className="space-y-4">
        <div className="card space-y-2">
          <div className="section-title"><Icon name="send" />إرسال</div>
          {warn > 0 && <p className="text-xs text-danger">تنبيه: فيه {warn} حالة غير مطابقة للمعايير في الكشف.</p>}
          {count === 0 && <p className="text-xs text-danger">الكشف فاضي.</p>}
          {smtp ? (
            <>
              <button className="btn btn-primary w-full" disabled={pending || !ready}
                onClick={() => confirm(`هيتبعت الإيميل لـ ${toList.valid.length} مستلم ومرفق معاه الكشف (${count} حالة)، والكشف هيتقفل. تكمل؟`) && send("smtp")}>
                {pending ? "جارٍ الإرسال..." : "إرسال من السستم وقفل الكشف"}
              </button>
              <p className="text-[11px] text-ink-soft">بيتبعت من {from} ومعاه ملف الإكسل.</p>
            </>
          ) : (
            <p className="text-[11px] text-ink-soft">الإرسال المباشر من السستم مش متفعل لسه. ابعت من Outlook بالخطوات دي:</p>
          )}
          <ol className="text-sm space-y-2 list-decimal pr-5">
            <li><a className="text-primary font-semibold hover:underline" href={`/api/export/sheet?id=${sheetId}`}>نزّل ملف الكشف (Excel)</a></li>
            <li>
              افتح رسالة جاهزة في{" "}
              <a className="text-primary font-semibold hover:underline" target="_blank" rel="noreferrer" href={outlookWebUrl(toList.valid, ccList.valid, subject, body)}>Outlook على النت</a>
              {" "}أو{" "}
              <a className="text-primary font-semibold hover:underline" href={mailtoUrl(toList.valid, ccList.valid, subject, body)}>Outlook على الجهاز</a>
              <button type="button" className="text-xs text-ink-soft underline mr-2" onClick={copy}>{copied ? "اتنسخ ✓" : "أو انسخ النص"}</button>
            </li>
            <li>ارفق الملف وابعت</li>
            <li>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={confirmManual} onChange={(e) => { setConfirmManual(e.target.checked); setMsg(null); }} className="mt-0.5" />
                بأكد إن الإيميل اتبعت فعلاً من {from}
              </label>
              <button className="btn w-full mt-2" disabled={pending || !ready || !confirmManual} onClick={() => send("manual")}>تسجيل الإرسال وقفل الكشف</button>
            </li>
          </ol>
          {note}
        </div>
        <div className="card text-xs text-ink-soft space-y-1">
          <p>بعد الإرسال الكشف بيتقفل ومحدش يقدر يعدل فيه، ونسخة منه بتتحفظ في السجل زي ما اتبعتت بالظبط.</p>
          <p>لو محتاج تعديل بعد الإرسال، المدير يقدر يفتحه تاني مع كتابة السبب، وتبعت إيميل تحديث.</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- أزرار الكشف

export function DeleteSheet({ id }: { id: string }) {
  const { pending, run, note } = useRun();
  return (
    <>
      <button className="btn btn-danger" disabled={pending}
        onClick={() => confirm("حذف الكشف؟ الحالات اللي فيه هترجع لقائمة المرشحين.") && run(() => deleteSheet(id))}>حذف الكشف</button>
      {note}
    </>
  );
}

export function CloseSheet({ id }: { id: string }) {
  const { pending, run, note } = useRun();
  return (
    <>
      <button className="btn" disabled={pending} onClick={() => confirm("قفل الكشف نهائياً؟") && run(() => closeSheet(id))}>قفل الكشف</button>
      {note}
    </>
  );
}

export function ReopenSheet({ id }: { id: string }) {
  const { pending, run, note } = useRun();
  return (
    <>
      <button className="btn" disabled={pending} onClick={() => {
        const reason = prompt("سبب فتح الكشف للتعديل:");
        if (reason) run(() => reopenSheet(id, reason));
      }}>فتح للتعديل</button>
      {note}
    </>
  );
}
