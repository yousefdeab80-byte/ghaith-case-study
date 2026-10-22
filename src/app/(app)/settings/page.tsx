import Link from "next/link";
import { asc } from "drizzle-orm";
import clsx from "clsx";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { DEFAULT_LOOKUPS } from "@/lib/constants";
import { requireUser } from "@/lib/server/auth";
import { getLookups, getProjects, getSetting } from "@/lib/server/data";
import { getEmailTemplate } from "@/lib/server/sheets";
import { smtpConfigured } from "@/lib/server/mail";
import { EmailSettings, EmailTemplateEditor, LookupEditor, NewUserForm, ProjectEditor, UserRow } from "./editors";

const TABS = { users: "المستخدمين والصلاحيات", projects: "المشروعات والمعايير والأسئلة", lookups: "القوائم", email: "الإيميل وقائمة التوزيع" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser("settings");
  const { tab = "users" } = await searchParams;
  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="flex flex-wrap gap-1 mb-4 border-b border-line">
        {Object.entries(TABS).map(([k, l]) => (
          <Link key={k} href={`/settings?tab=${k}`} className={clsx("px-4 py-2 text-sm font-semibold -mb-px border-b-2", tab === k ? "border-primary text-primary" : "border-transparent text-ink-soft")}>{l}</Link>
        ))}
      </div>
      {tab === "users" && <Users />}
      {tab === "projects" && <Projects />}
      {tab === "lookups" && <Lookups />}
      {tab === "email" && <Email />}
    </>
  );
}

async function Users() {
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt));
  return (
    <div className="space-y-4">
      <div className="card"><div className="section-title mb-3">مستخدم جديد</div><NewUserForm /></div>
      <div className="card space-y-2">
        {users.map((u) => <UserRow key={u.id} user={{ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active, permissions: u.permissions }} />)}
      </div>
    </div>
  );
}

async function Projects() {
  const projects = await getProjects();
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <div className="section-sub">المعايير والأسئلة والأوزان منقولة من السياسات وملف داش بورد استطلاع الرأي. أي تعديل هنا بيتطبق على طول.</div>
        {projects.map((p) => <ProjectEditor key={p.id} project={p} />)}
      </div>
      <div className="card"><div className="section-title mb-3">مشروع أو مبادرة جديدة</div><ProjectEditor /></div>
    </div>
  );
}

async function Lookups() {
  const lookups = await getLookups();
  return (
    <div className="card grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Object.entries(DEFAULT_LOOKUPS).map(([k, v]) => <LookupEditor key={k} k={k} label={v.label} values={lookups[k]} />)}
    </div>
  );
}

async function Email() {
  const [email, list] = await Promise.all([
    getSetting("nominationEmail", "abdallh.mohamed@ghaithfoundation.org"),
    getSetting<{ name: string; email: string }[]>("distributionList", []),
  ]);
  const template = await getEmailTemplate();
  return (
    <div className="space-y-4">
      <div className="card"><EmailSettings email={email} list={list} /></div>
      <div className="card"><EmailTemplateEditor template={template} /></div>
      <div className="card text-sm text-ink-soft space-y-1">
        <div className="section-title">الإرسال المباشر من السستم</div>
        <p>{smtpConfigured() ? "مفعّل: الإيميلات بتتبعت من السستم ومعاها ملف الكشف." : "مش مفعّل: الإيميل بيتفتح جاهز في Outlook وانت بتبعته وتأكد الإرسال."}</p>
        <p>لتفعيله مع Microsoft 365 محتاجين نضيف في Vercel: SMTP_HOST=smtp.office365.com و SMTP_PORT=587 و SMTP_USER و SMTP_PASS لصندوق الإيميل، ويكون SMTP AUTH مفعّل عليه من الـ IT.</p>
      </div>
    </div>
  );
}
