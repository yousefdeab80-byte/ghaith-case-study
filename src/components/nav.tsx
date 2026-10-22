"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "./icons";

export type NavItem = { href: string; label: string; icon: string };

export function Sidebar({ items, user, role, logout }: { items: NavItem[]; user: string; role: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // أطول رابط مطابق بس هو اللي يتعلّم (عشان "/cases/new" و"/cases" ميتعلموش مع بعض)
  const match = items.filter((it) => (it.href === "/" ? path === "/" : path === it.href || path.startsWith(`${it.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const active = (href: string) => href === match;
  return (
    <>
      <button className="print:hidden lg:hidden fixed top-3 right-3 z-40 btn btn-sm bg-primary text-white border-primary" onClick={() => setOpen(!open)} aria-label="القائمة">
        <Icon name="menu" />
      </button>
      <aside className={clsx(
        "print:hidden fixed lg:sticky top-0 right-0 z-30 h-screen w-60 shrink-0 bg-primary-dark text-white flex flex-col p-4 transition-transform",
        open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
      )}>
        <div className="px-2 pb-4 mb-3 border-b border-white/10 text-center">
          <img src="/logo.png" alt="مؤسسة غيث للتنمية المجتمعية" className="w-36 mx-auto" />
          <div className="text-[12px] font-bold text-brand mt-2">قطاع دراسة الحالة</div>
        </div>
        <nav className="flex-1 overflow-y-auto space-y-0.5">
          {items.map((it) => (
            <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
              className={clsx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold",
                active(it.href) ? "bg-brand text-primary-dark" : "hover:bg-white/10")}>
              <Icon name={it.icon} />{it.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-3 mt-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand text-primary-dark flex items-center justify-center"><Icon name="user" /></div>
          <div className="flex-1 min-w-0">
            <Link href="/account" className="block text-sm font-bold truncate hover:underline" title="حسابي">{user}</Link>
            <div className="text-[11px] opacity-70">{role}</div>
          </div>
          <form action={logout}><button className="p-1.5 rounded hover:bg-white/10" title="خروج"><Icon name="logout" /></button></form>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
