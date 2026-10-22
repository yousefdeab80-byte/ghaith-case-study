"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Field, Section } from "@/lib/forms";
import { completeness, computeSum, isVisible } from "@/lib/forms";
import { parseNid } from "@/lib/nid";
import type { FamilyMember } from "@/db/schema";
import { createCase, findByNid, updateCase } from "@/app/(app)/cases/actions";
import { Icon } from "./icons";

type Values = Record<string, unknown>;

export function CaseForm({
  sections, lookups, formType, initial = {}, caseId, mode,
}: {
  sections: Section[]; lookups: Record<string, string[]>; formType: string; initial?: Values; caseId?: string; mode: "wizard" | "full";
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));
  const comp = useMemo(() => completeness(values), [values]);

  const checkDup = async (key: string, nid: string) => {
    const hit = nid ? await findByNid(nid, caseId) : null;
    setDupWarn((p) => ({ ...p, [key]: hit ? `متسجل قبل كده في ملف رقم ${hit.fileNo} (${hit.headName})` : "" }));
  };

  const save = () => start(async () => {
    setError(null);
    const res = caseId ? await updateCase(caseId, values) : await createCase(formType, values);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/cases/${res.id}`);
    router.refresh();
  });

  const renderSection = (s: Section) => (
    <div key={s.id} className="card">
      <div className="section-title">{s.title}</div>
      {s.optional && <p className="section-sub">الحقول دي مش في الاستمارة الورقية، املاها لو المعلومة متاحة أو سيبها فاضية.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-3">
        {s.fields.filter((f) => isVisible(f, values)).map((f) => (
          <FieldInput key={f.key} field={f} value={values[f.key]} lookups={lookups} onChange={(v) => set(f.key, v)}
            onNidBlur={(nid) => checkDup(f.key, nid)} warning={dupWarn[f.key]} suggested={computeSum(f, values)} />
        ))}
      </div>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
      <span>اكتمال البيانات الأساسية: <b className="text-primary">{comp.percent}%</b></span>
      {comp.missing.length > 0 && <span>ناقص: {comp.missing.slice(0, 5).join("، ")}{comp.missing.length > 5 ? "..." : ""}</span>}
    </div>
  );

  const errorBox = error && <div className="bg-danger-tint text-danger text-sm rounded-lg px-3 py-2">{error}</div>;

  if (mode === "full") {
    return (
      <div className="space-y-4 pb-24">
        {header}
        {sections.map(renderSection)}
        <div className="fixed bottom-0 left-0 right-0 lg:right-60 bg-surface/95 border-t border-line p-3 flex items-center gap-3 justify-end backdrop-blur">
          {errorBox}
          <button className="btn" onClick={() => router.back()} type="button">إلغاء</button>
          <button className="btn btn-primary" onClick={save} disabled={pending} type="button">{pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
        </div>
      </div>
    );
  }

  const last = step === sections.length - 1;
  return (
    <div className="space-y-4">
      <div className="card py-3">
        <div className="flex gap-1 mb-3">
          {sections.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setStep(i)} title={s.title}
              className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-surface-alt")} />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-primary">الخطوة {step + 1} من {sections.length}: {sections[step].title}</span>
          {header}
        </div>
      </div>
      {renderSection(sections[step])}
      {errorBox}
      <div className="flex flex-wrap gap-2 justify-between">
        <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>السابق</button>
        <div className="flex gap-2">
          {!last && <button type="button" className="btn" onClick={save} disabled={pending}>حفظ والإكمال لاحقاً</button>}
          {last
            ? <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ الحالة"}</button>
            : <button type="button" className="btn btn-primary" onClick={() => { setStep(step + 1); window.scrollTo({ top: 0 }); }}>التالي</button>}
        </div>
      </div>
    </div>
  );
}

function optionsFor(field: Field, lookups: Record<string, string[]>, current: unknown): string[] {
  const base = !field.options ? [] : Array.isArray(field.options) ? field.options : lookups[field.options.slice(7)] ?? [];
  const extra = (Array.isArray(current) ? current : current ? [current] : []).map(String).filter((c) => !base.includes(c));
  return [...base, ...extra];
}

function FieldInput({ field, value, lookups, onChange, onNidBlur, warning, suggested }: {
  field: Field; value: unknown; lookups: Record<string, string[]>; onChange: (v: unknown) => void;
  onNidBlur: (nid: string) => void; warning?: string; suggested?: number | null;
}) {
  const str = value === undefined || value === null ? "" : String(value);
  const wide = field.wide || field.type === "members" || field.type === "textarea" || field.type === "multi";
  const label = <label className="label">{field.label}{field.required && <span className="text-danger"> *</span>}</label>;

  let control: React.ReactNode;
  switch (field.type) {
    case "select":
      control = (
        <select className="input" value={str} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {optionsFor(field, lookups, value).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
      break;
    case "yesno": {
      const opts = optionsFor(field, lookups, value);
      control = (
        <div className="flex gap-1.5">
          {opts.map((o) => (
            <button key={o} type="button" onClick={() => onChange(str === o ? undefined : o)}
              className={clsx("btn btn-sm flex-1", str === o && "bg-primary text-white border-primary hover:bg-primary-dark")}>{o}</button>
          ))}
        </div>
      );
      break;
    }
    case "multi": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="flex flex-wrap gap-1.5">
          {optionsFor(field, lookups, value).map((o) => {
            const on = arr.includes(o);
            return (
              <button key={o} type="button" onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className={clsx("badge border text-xs py-1 px-3", on ? "bg-primary text-white border-primary" : "bg-white border-line text-ink")}>
                {on && <Icon name="check" className="w-3 h-3 ml-1" />}{o}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "textarea":
      control = <textarea className="input min-h-[80px]" value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "members":
      control = <MembersEditor value={Array.isArray(value) ? (value as FamilyMember[]) : []} onChange={onChange} />;
      break;
    case "nid": {
      const info = str ? parseNid(str) : null;
      control = (
        <>
          <input className="input tabular-nums" inputMode="numeric" dir="ltr" value={str} maxLength={14}
            onChange={(e) => onChange(e.target.value)} onBlur={() => onNidBlur(str)} />
          {info && (info.valid
            ? <p className="text-[11px] text-good mt-1">مواليد {info.birthDate} · {info.age} سنة · {info.gender} · {info.governorate}</p>
            : <p className="text-[11px] text-danger mt-1">{info.error}</p>)}
          {warning && <p className="text-[11px] text-danger mt-1">{warning}</p>}
        </>
      );
      break;
    }
    case "phone":
      control = <input className="input tabular-nums" inputMode="tel" dir="ltr" value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = (
        <>
          <input className="input tabular-nums" inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value)} />
          {suggested !== null && suggested !== undefined && String(suggested) !== str && (
            <button type="button" className="text-[11px] text-primary font-semibold mt-1 hover:underline" onClick={() => onChange(String(suggested))}>
              مجموع البنود: {suggested.toLocaleString("ar-EG")} جنيه، استخدمه
            </button>
          )}
        </>
      );
      break;
    case "date":
      control = <input className="input" type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = <input className="input" value={str} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={clsx(wide && "sm:col-span-2 lg:col-span-3")}>
      {label}{control}
      {field.hint && <p className="text-[11px] text-ink-soft mt-1">{field.hint}</p>}
    </div>
  );
}

const RELATIONS = ["زوجة", "زوج", "ابن", "ابنة", "أب", "أم", "أخرى"];
/** نفس أعمدة جدول "أفراد الأسرة" في الاستمارة الورقية. */
const MEMBER_COLS: { key: keyof FamilyMember; label: string; w?: string; options?: string[] }[] = [
  { key: "name", label: "الاسم" }, { key: "relation", label: "الصلة", w: "w-28", options: RELATIONS }, { key: "age", label: "السن", w: "w-16" },
  { key: "gender", label: "النوع", w: "w-24", options: ["ذكر", "أنثى"] }, { key: "eduStage", label: "المرحلة التعليمية", w: "w-36" },
  { key: "hasBag", label: "توجد شنطة", w: "w-24", options: ["نعم", "لا"] },
];

function MembersEditor({ value, onChange }: { value: FamilyMember[]; onChange: (v: FamilyMember[]) => void }) {
  const update = (i: number, k: keyof FamilyMember, v: string) => onChange(value.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{MEMBER_COLS.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {value.map((m, i) => (
            <tr key={i}>
              {MEMBER_COLS.map((c) => (
                <td key={c.key} className={c.w}>
                  {c.options
                    ? <select className="input py-1" value={m[c.key] ?? ""} onChange={(e) => update(i, c.key, e.target.value)}>
                        <option value="">—</option>{[...c.options, ...(m[c.key] && !c.options.includes(m[c.key]!) ? [m[c.key]!] : [])].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    : <input className="input py-1" value={m[c.key] ?? ""} onChange={(e) => update(i, c.key, e.target.value)} />}
                </td>
              ))}
              <td><button type="button" className="text-danger p-1" onClick={() => onChange(value.filter((_, j) => j !== i))} title="حذف"><Icon name="trash" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2"><button type="button" className="btn btn-sm" onClick={() => onChange([...value, {}])}><Icon name="plus" className="w-4 h-4" />إضافة فرد</button></div>
    </div>
  );
}
