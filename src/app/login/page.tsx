"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-b from-primary-dark to-primary">
      <form action={action} className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo.svg" alt="" className="w-11 h-11 mb-2" />
          <h1 className="text-xl font-extrabold text-primary">غيث</h1>
          <p className="text-xs text-ink-soft mt-1">نظام إدارة قطاع دراسة الحالة</p>
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
