import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CaseForm } from "@/components/case-form";
import { FORM_TYPES } from "@/lib/constants";
import { sectionsFor } from "@/lib/forms";
import { requireUser } from "@/lib/server/auth";
import { getLookups } from "@/lib/server/data";

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  await requireUser("cases.edit");
  const { form } = await searchParams;
  const type = FORM_TYPES.find((f) => f.id === form);
  if (!type) {
    return (
      <>
        <PageHeader title="تسجيل حالة جديدة" sub="اختار الاستمارة المناسبة، وبعدها هتجاوب على الأسئلة خطوة بخطوة" />
        <div className="grid gap-4 md:grid-cols-3">
          {FORM_TYPES.map((f) => (
            <Link key={f.id} href={`/cases/new?form=${f.id}`} className="card hover:border-primary transition">
              <div className="section-title">{f.label}</div>
              <p className="text-sm text-ink-soft">{f.desc}</p>
            </Link>
          ))}
        </div>
      </>
    );
  }
  const lookups = await getLookups();
  return (
    <>
      <PageHeader title={type.label} sub="تقدر تحفظ في أي خطوة وتكمل البيانات بعدين" actions={<Link href="/cases/new" className="btn">تغيير الاستمارة</Link>} />
      <CaseForm mode="wizard" formType={type.id} sections={sectionsFor(type.id)} lookups={lookups} />
    </>
  );
}
