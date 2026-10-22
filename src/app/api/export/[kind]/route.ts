import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, currentUser } from "@/lib/server/auth";
import { caseFilters, type CaseSearch } from "@/lib/server/case-query";
import { ALL_FIELDS } from "@/lib/forms";
import { toValues } from "@/lib/case-record";
import { buildXlsx, safeFileName, xlsxResponse } from "@/lib/server/xlsx";
import { getSheet, getSheetCases } from "@/lib/server/sheets";
import { sheetRow } from "@/lib/nomination";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";

const xlsx = (rows: Record<string, unknown>[], name: string) => xlsxResponse(buildXlsx(rows), name);

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
  if (kind === "sheet") {
    if (!can(user, "nominate")) return new Response("forbidden", { status: 403 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const found = /^[0-9a-f-]{36}$/.test(id) ? await getSheet(id) : null;
    if (!found) return new Response("not found", { status: 404 });
    const rows = await getSheetCases(id);
    return xlsxResponse(buildXlsx(rows.map((r, i) => sheetRow(r.c, i, r.nomination.note)), "كشف الترشيح"), safeFileName(`${found.project.name} - ${found.sheet.title}`));
  }
  if (kind === "sheet-email") {
    if (!can(user, "nominate")) return new Response("forbidden", { status: 403 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const [e] = /^[0-9a-f-]{36}$/.test(id) ? await db.select().from(schema.sheetEmails).where(eq(schema.sheetEmails.id, id)) : [];
    if (!e) return new Response("not found", { status: 404 });
    return xlsxResponse(buildXlsx(e.snapshot, "كشف الترشيح"), safeFileName(`${e.subject} - ${e.sentAt.toISOString().slice(0, 10)}`));
  }
  return new Response("not found", { status: 404 });
}
