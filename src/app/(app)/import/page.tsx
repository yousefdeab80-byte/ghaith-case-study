import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/server/auth";
import { Importer } from "./importer";

export default async function ImportPage() {
  await requireUser("import");
  const batches = await db.select().from(schema.importBatches).orderBy(desc(schema.importBatches.createdAt)).limit(15);
  return (
    <>
      <PageHeader title="استيراد وتصدير البيانات" sub="ارفع الكشوف القديمة بأي شكل، واربط أعمدتها بحقول السستم"
        actions={<>
          <a className="btn" href="/api/export/cases"><Icon name="download" />تصدير كل الحالات</a>
          <a className="btn" href="/api/export/benefits"><Icon name="download" />تصدير المساعدات</a>
          <a className="btn" href="/api/export/template"><Icon name="download" />قالب فاضي للحالات</a>
        </>} />
      <Importer />
      {batches.length > 0 && (
        <div className="card mt-4">
          <div className="section-title mb-3">آخر عمليات الاستيراد</div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الملف</th><th>النوع</th><th>الصفوف</th><th>اتضاف</th><th>اتكمل</th><th>ملاحظات</th><th>التاريخ</th></tr></thead>
            <tbody>{batches.map((b) => (
              <tr key={b.id}><td>{b.fileName}</td><td>{b.kind === "cases" ? "حالات" : "مساعدات"}</td><td>{b.totalRows}</td><td>{b.created}</td><td>{b.merged}</td><td>{b.issues.length}</td>
                <td className="text-xs text-ink-soft">{new Date(b.createdAt).toLocaleString("ar-EG")}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </>
  );
}
