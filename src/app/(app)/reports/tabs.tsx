"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/reports", label: "قاعدة بيانات الحالات" },
  { href: "/reports/achievements", label: "التنفيذات وإنجازات المؤسسة" },
];

export function ReportTabs() {
  const path = usePathname();
  return (
    <div className="flex gap-1 border-b border-line mb-5 print:hidden">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={clsx("px-4 py-2 text-sm font-bold border-b-2 -mb-px", path === t.href ? "border-brand text-primary" : "border-transparent text-ink-soft hover:text-primary")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}>طباعة / حفظ PDF</button>;
}
