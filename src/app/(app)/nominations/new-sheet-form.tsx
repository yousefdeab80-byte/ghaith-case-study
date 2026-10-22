"use client";

import { useActionState } from "react";
import { createSheet } from "./actions";

export function NewSheetForm({ projects, governorates, defaultProject }: { projects: { id: string; name: string }[]; governorates: string[]; defaultProject?: string }) {
  const [error, action, pending] = useActionState(createSheet, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
      <div className="lg:col-span-2"><label className="label">المشروع *</label>
        <select name="projectId" className="input" defaultValue={defaultProject ?? ""} required>
          <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div className="lg:col-span-2"><label className="label">اسم الكشف *</label>
        <input name="title" className="input" placeholder="مثلاً: قافلة 3 – أطفيح – أكتوبر" required /></div>
      <div><label className="label">رقم / اسم القافلة</label><input name="convoy" className="input" /></div>
      <div><label className="label">المحافظة</label>
        <select name="governorate" className="input"><option value="">أكتر من محافظة</option>{governorates.map((g) => <option key={g}>{g}</option>)}</select></div>
      <div><label className="label">تاريخ التنفيذ المخطط</label><input name="plannedDate" type="date" className="input" /></div>
      <div><label className="label">العدد المستهدف</label><input name="targetCount" inputMode="numeric" className="input" /></div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "..." : "إنشاء الكشف"}</button>
      {error && <p className="text-danger text-xs sm:col-span-2 lg:col-span-6">{error}</p>}
    </form>
  );
}
