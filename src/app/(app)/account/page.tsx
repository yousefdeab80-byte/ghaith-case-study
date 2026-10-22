"use client";

import { useActionState } from "react";
import { changeOwnPassword } from "../settings/actions";

export default function AccountPage() {
  const [msg, action, pending] = useActionState(changeOwnPassword, null);
  return (
    <div className="card max-w-md">
      <div className="section-title mb-3">تغيير كلمة المرور</div>
      <form action={action} className="space-y-3">
        <div><label className="label">كلمة المرور الحالية</label><input name="current" type="password" className="input" required /></div>
        <div><label className="label">كلمة المرور الجديدة</label><input name="next" type="password" className="input" required minLength={8} /></div>
        <button className="btn btn-primary" disabled={pending}>حفظ</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </div>
  );
}
