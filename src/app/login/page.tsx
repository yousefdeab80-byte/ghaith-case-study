"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-b from-primary-dark to-primary">
      <form action={action} className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6 -mx-8 -mt-8 px-8 pt-8 pb-5 rounded-t-2xl bg-primary-dark">
          <img src="/logo.png" alt="مؤسسة غيث للتنمية المجتمعية" className="w-40" />
          <h1 className="text-sm font-bold text-brand mt-3">نظام إدارة قطاع دراسة الحالة</h1>
        </div>
        {error && <div className="bg-danger-tint text-danger text-sm rounded-lg px-3 py-2 mb-3">{error}</div>}
        <label className="label" htmlFor="username">اسم المستخدم</label>
        <input id="username" name="username" className="input mb-3" autoComplete="username" required />
        <label className="label" htmlFor="password">كلمة المرور</label>
        <input id="password" name="password" type="password" className="input mb-5" autoComplete="current-password" required />
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "جارٍ الدخول..." : "تسجيل الدخول"}</button>
      </form>
    </div>
  );
}
