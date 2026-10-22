"use client";

import { useActionState } from "react";
import { addBenefit } from "./actions";

export function AddBenefitForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [error, action, pending] = useActionState(addBenefit, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8 items-end">
      <div className="lg:col-span-2"><label className="label">الاسم *</label><input name="name" className="input" required /></div>
      <div className="lg:col-span-2"><label className="label">الرقم القومي</label><input name="nid" className="input" dir="ltr" /></div>
      <div><label className="label">المشروع *</label>
        <select name="projectId" className="input" required><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label className="label">القافلة</label><input name="convoy" className="input" /></div>
      <div><label className="label">التاريخ</label><input name="benefitDate" type="date" className="input" /></div>
      <button className="btn btn-primary" disabled={pending}>إضافة</button>
      {error && <p className="text-danger text-xs sm:col-span-4 lg:col-span-8">{error}</p>}
    </form>
  );
}
