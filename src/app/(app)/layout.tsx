import { Sidebar, type NavItem } from "@/components/nav";
import { can, requireUser } from "@/lib/server/auth";
import { ROLE_LABELS, type PermissionKey } from "@/lib/constants";
import { logout } from "@/app/login/actions";

const NAV: (NavItem & { perm: PermissionKey })[] = [
  { href: "/", label: "لوحة التحكم", icon: "dashboard", perm: "dashboard" },
  { href: "/reports", label: "التقارير", icon: "chart", perm: "dashboard" },
  { href: "/cases/new", label: "تسجيل حالة جديدة", icon: "plus", perm: "cases.edit" },
  { href: "/cases", label: "سجل الحالات", icon: "list", perm: "cases.view" },
  { href: "/nominations", label: "الترشيحات والكشوف", icon: "send", perm: "nominate" },
  { href: "/benefits", label: "المساعدات المنفذة", icon: "box", perm: "benefits" },
  { href: "/import", label: "استيراد وتصدير", icon: "upload", perm: "import" },
  { href: "/settings", label: "الإعدادات", icon: "gear", perm: "settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV.filter((n) => can(user, n.perm)).map(({ perm: _perm, ...n }) => n);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} user={user.name} role={ROLE_LABELS[user.role] ?? user.role} logout={logout} />
      <main className="flex-1 min-w-0 p-4 pt-16 lg:p-7 print:p-0">{children}</main>
    </div>
  );
}
