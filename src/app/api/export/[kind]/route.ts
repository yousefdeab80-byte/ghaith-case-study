import * as XLSX from "xlsx";
import { asc, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, currentUser } from "@/lib/server/auth";
import { caseFilters, type CaseSearch } from "@/lib/server/case-query";
import { ALL_FIELDS } from "@/lib/forms";
import { toValues } from "@/lib/case-record";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";

const xlsx = (rows: Record<string, unknown>[], name: string) => {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!views"] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, "البيانات");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
    },
  });
};

const flatFields = ALL_FIELDS.filter((f) => f.type !== "members");

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await currentUser();
  const { kind } = await params;
  const date = new Date().toISOString().slice(0, 10);

  if (kind === "template") {
    return xlsx([Object.fromEntries(flatFields.map((f) => [f.label, ""]))], "قالب-الحالات");
  }
  if (kind === "cases") {
    if (!can(user, "cases.view")) return new Response("forbidden", { status: 403 });
    const sp = Object.fromEntries(new URL(req.url).searchParams) as CaseSearch;
    const rows = await db.select().from(schema.cases).where(caseFilters(sp)).orderBy(asc(schema.cases.fileNo));
    return xlsx(rows.map((c) => {
      const v = toValues(c);
      return {
        "رقم الملف": c.fileNo, "حالة الملف": STATUS_LABELS[c.status], "الأولوية": PRIORITY_LABELS[c.priorityLevel], "اكتمال البيانات %": c.completeness,
        ...Object.fromEntries(flatFields.map((f) => [f.label, Array.isArray(v[f.key]) ? (v[f.key] as string[]).join("، ") : v[f.key] ?? ""])),
        "عدد أفراد الأسرة المسجلين": c.members.length,
        "سبب الاستبعاد": c.exclusionReason ?? "",
      };
    }), `الحالات-${date}`);
  }
  if (kind === "benefits") {
    if (!can(user, "benefits")) return new Response("forbidden", { status: 403 });
    const rows = await db.select().from(schema.benefits).orderBy(desc(schema.benefits.benefitDate));
    return xlsx(rows.map((b) => ({
      "الاسم": b.name, "الرقم القومي": b.nid ?? "", "التليفون": b.phone ?? "", "المشروع": b.projectName, "القافلة": b.convoy ?? "",
      "التاريخ": b.benefitDate ?? "", "المحافظة": b.governorate ?? "", "القرية": b.village ?? "", "العدد": b.quantity,
      "مربوطة بملف حالة": b.caseId ? "نعم" : "لا",
    })), `المساعدات-${date}`);
  }
  return new Response("not found", { status: 404 });
}
