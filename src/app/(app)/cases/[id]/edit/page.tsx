import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { CaseForm } from "@/components/case-form";
import { sectionsFor } from "@/lib/forms";
import { toValues } from "@/lib/case-record";
import { requireUser } from "@/lib/server/auth";
import { getLookups } from "@/lib/server/data";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("cases.edit");
  const { id } = await params;
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.id, id));
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`تعديل ملف رقم ${c.fileNo}`} sub={c.headName} />
      <CaseForm mode="full" caseId={c.id} formType={c.formType} sections={sectionsFor(c.formType)} lookups={await getLookups()} initial={toValues(c)} />
    </>
  );
}
