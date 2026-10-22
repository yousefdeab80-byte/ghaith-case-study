"use client";

import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import type { FeedbackQuestion, Project, User } from "@/db/schema";
import { PERMISSIONS, ROLE_LABELS, DEFAULT_PERMISSIONS } from "@/lib/constants";
import { createUser, resetPassword, saveEmailSettings, saveLookup, saveProject, updateUser, type ProjectInput } from "./actions";
import { Icon } from "@/components/icons";

const useRun = () => {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<unknown>, ok = "تم الحفظ") => start(async () => {
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  });
  const note = msg && <span className={clsx("text-xs", msg.ok ? "text-good" : "text-danger")}>{msg.text}</span>;
  return { pending, run, note };
};

// ------------------------------------------------------------- المستخدمين

export function NewUserForm() {
  const [error, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5 items-end">
      <div><label className="label">الاسم</label><input name="name" className="input" required /></div>
      <div><label className="label">اسم المستخدم</label><input name="username" className="input" dir="ltr" required /></div>
      <div><label className="label">كلمة المرور</label><input name="password" className="input" type="password" required minLength={8} /></div>
      <div><label className="label">الدور</label>
        <select name="role" className="input">{Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <button className="btn btn-primary" disabled={pending}>إضافة مستخدم</button>
      {error && <p className="text-danger text-xs sm:col-span-5">{error}</p>}
    </form>
  );
}

export function UserRow({ user }: { user: Pick<User, "id" | "name" | "username" | "role" | "active" | "permissions"> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [perms, setPerms] = useState<Record<string, boolean>>(user.permissions);
  const [pwd, setPwd] = useState("");
  const { pending, run, note } = useRun();
  return (
    <div className="border border-line rounded-lg">
      <button className="w-full flex items-center justify-between px-4 py-3 text-right" onClick={() => setOpen(!open)}>
        <span><b>{user.name}</b> <span className="text-xs text-ink-soft" dir="ltr">({user.username})</span></span>
        <span className="flex gap-2 items-center">
          <span className="badge bg-primary-tint text-primary">{ROLE_LABELS[user.role] ?? user.role}</span>
          {!user.active && <span className="badge badge-excluded">موقوف</span>}
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">الاسم</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="label">الدور</label>
              <select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPerms(DEFAULT_PERMISSIONS[e.target.value] ?? perms); }}>
                {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />الحساب شغال</label>
          </div>
          <div>
            <div className="label">الصلاحيات</div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={role === "manager" || !!perms[p.key]} disabled={role === "manager"}
                    onChange={(e) => setPerms({ ...perms, [p.key]: e.target.checked })} />{p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button className="btn btn-primary" disabled={pending} onClick={() => run(() => updateUser(user.id, { name, role, active, permissions: perms }))}>حفظ</button>
            <input className="input w-48" type="password" placeholder="كلمة مرور جديدة" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button className="btn" disabled={pending || !pwd} onClick={() => run(() => resetPassword(user.id, pwd), "اتغيرت كلمة المرور")}>تغيير كلمة المرور</button>
            {note}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- المشروعات

const RULES: Record<string, string> = {
  seasonal: "مبادرة موسمية (المعايير الثابتة)", dafa: "دفء (احتياج بطاطين)", schoolbag: "فرحة بشنطة (أطفال في سن الدراسة)",
  zilal: "ظلال (أسقف)", irtiwa: "ارتواء (وصلات مياه)", shifa: "شفاء (رمد وعمليات)", irtiqa: "ارتقاء (تدريب ذوي الإعاقة)",
};
const Q_TYPES: Record<FeedbackQuestion["type"], string> = { yesno_pos: "نعم = الدرجة كاملة", yesno_neg: "لا = الدرجة كاملة", scale: "ممتاز / جيد / مقبول / ضعيف" };

export function ProjectEditor({ project }: { project?: Project }) {
  const [open, setOpen] = useState(!project);
  const [p, setP] = useState<ProjectInput>({
    name: project?.name ?? "", sector: project?.sector ?? "مبادرة موسمية", rulesKey: project?.rulesKey ?? "seasonal",
    active: project?.active ?? true, minDaysBetweenBenefits: project?.minDaysBetweenBenefits ?? null,
    sampleRatio: Number(project?.sampleRatio ?? 0.3), settlementDeadlineDays: project?.settlementDeadlineDays ?? 4,
    impactAfterDays: project?.impactAfterDays ?? null, requiredDocs: project?.requiredDocs ?? [],
    feedbackQuestions: project?.feedbackQuestions ?? [],
  });
  const { pending, run, note } = useRun();
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setP({ ...p, [k]: v });
  const total = p.feedbackQuestions.reduce((s, q) => s + (Number(q.weight) || 0), 0);
  const setQ = (i: number, patch: Partial<FeedbackQuestion>) => set("feedbackQuestions", p.feedbackQuestions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  if (!open) {
    return (
      <button className="w-full flex items-center justify-between border border-line rounded-lg px-4 py-3 text-right hover:bg-bg" onClick={() => setOpen(true)}>
        <span className="font-bold">{project?.name}</span>
        <span className="flex gap-2">
          <span className="badge bg-surface-alt text-ink">{project?.sector}</span>
          <span className="badge bg-primary-tint text-primary">{project?.feedbackQuestions.length} أسئلة فيد باك</span>
          {!project?.active && <span className="badge badge-excluded">متوقف</span>}
        </span>
      </button>
    );
  }
  return (
    <div className="border border-primary/40 rounded-lg p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label">اسم المشروع</label><input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">القطاع</label>
          <select className="input" value={p.sector} onChange={(e) => set("sector", e.target.value)}>{["تكافل", "تمكين", "مبادرة موسمية"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="lg:col-span-2"><label className="label">معايير الاستحقاق المطبقة</label>
          <select className="input" value={p.rulesKey} onChange={(e) => set("rulesKey", e.target.value)}>{Object.entries(RULES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label className="label">أقل مدة بين استفادتين (يوم)</label><input className="input" type="number" value={p.minDaysBetweenBenefits ?? ""} onChange={(e) => set("minDaysBetweenBenefits", e.target.value ? Number(e.target.value) : null)} /></div>
        <div><label className="label">نسبة عينة المكالمات %</label><input className="input" type="number" value={Math.round(p.sampleRatio * 100)} onChange={(e) => set("sampleRatio", Number(e.target.value) / 100)} /></div>
        <div><label className="label">مهلة تسليم مستندات التسوية (يوم)</label><input className="input" type="number" value={p.settlementDeadlineDays} onChange={(e) => set("settlementDeadlineDays", Number(e.target.value))} /></div>
        <div><label className="label">قياس الأثر بعد (يوم)</label><input className="input" type="number" value={p.impactAfterDays ?? ""} onChange={(e) => set("impactAfterDays", e.target.value ? Number(e.target.value) : null)} /></div>
      </div>
      <div>
        <label className="label">المستندات المطلوبة (كل مستند في سطر)</label>
        <textarea className="input min-h-[90px]" value={p.requiredDocs.join("\n")} onChange={(e) => set("requiredDocs", e.target.value.split("\n"))} />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="label mb-0">أسئلة مكالمة الفيد باك وأوزانها</span>
          <span className={clsx("text-xs font-bold", total === 100 ? "text-good" : "text-danger")}>مجموع الأوزان: {total} / 100</span>
        </div>
        <div className="space-y-2">
          {p.feedbackQuestions.map((q, i) => (
            <div key={i} className="grid gap-2 grid-cols-12 items-center">
              <input className="input col-span-12 sm:col-span-6" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
              <select className="input col-span-7 sm:col-span-3" value={q.type} onChange={(e) => setQ(i, { type: e.target.value as FeedbackQuestion["type"] })}>
                {Object.entries(Q_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input className="input col-span-3 sm:col-span-2" type="number" value={q.weight} onChange={(e) => setQ(i, { weight: Number(e.target.value) })} />
              <button className="text-danger col-span-2 sm:col-span-1" onClick={() => set("feedbackQuestions", p.feedbackQuestions.filter((_, j) => j !== i))}><Icon name="trash" /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-sm mt-2" onClick={() => set("feedbackQuestions", [...p.feedbackQuestions, { id: "", text: "", type: "scale", weight: 20 }])}>إضافة سؤال</button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} />المشروع شغال</label>
        <button className="btn btn-primary" disabled={pending} onClick={() => run(() => saveProject(project?.id ?? null, p))}>حفظ المشروع</button>
        {project && <button className="btn" onClick={() => setOpen(false)}>قفل</button>}
        {note}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- القوائم والإيميل

export function LookupEditor({ k, label, values }: { k: string; label: string; values: string[] }) {
  const [text, setText] = useState(values.join("\n"));
  const { pending, run, note } = useRun();
  return (
    <div className="border border-line rounded-lg p-3">
      <div className="label">{label}</div>
      <textarea className="input min-h-[150px] text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2 mt-2">
        <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => run(() => saveLookup(k, text))}>حفظ</button>{note}
      </div>
    </div>
  );
}

export function EmailSettings({ email, list }: { email: string; list: { name: string; email: string }[] }) {
  const [from, setFrom] = useState(email);
  const [rows, setRows] = useState(list);
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-3">
      <div className="max-w-md"><label className="label">الإيميل الرسمي اللي بتتبعت منه الترشيحات</label>
        <input className="input" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="label">قائمة التوزيع (الإدارات اللي بتستلم الترشيحات)</div>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="input" placeholder="الاسم / الإدارة" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input className="input" dir="ltr" placeholder="email@ghaithfoundation.org" value={r.email} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
          <button className="text-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="trash" /></button>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <button className="btn btn-sm" onClick={() => setRows([...rows, { name: "", email: "" }])}>إضافة</button>
        <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => run(() => saveEmailSettings(from, rows))}>حفظ</button>{note}
      </div>
    </div>
  );
}
