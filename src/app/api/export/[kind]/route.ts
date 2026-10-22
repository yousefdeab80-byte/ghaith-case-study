import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, currentUser } from "@/lib/server/auth";
import { caseFilters, type CaseSearch } from "@/lib/server/case-query";
import { ALL_FIELDS } from "@/lib/forms";
import { toValues } from "@/lib/case-record";
import { buildWorkbook, buildXlsx, safeFileName, xlsxResponse } from "@/lib/server/xlsx";
import { achievementsReport, casesReport, type AchievementFilter, type CaseReportFilter, type GroupRow, type Row } from "@/lib/server/reports";
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
  if (kind === "report-cases" || kind === "report-achievements") {
    if (!can(user, "dashboard")) return new Response("forbidden", { status: 403 });
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const sheets = kind === "report-cases" ? casesReportSheets(await casesReport(sp as CaseReportFilter)) : achievementsSheets(await achievementsReport(sp as AchievementFilter));
    const name = kind === "report-cases" ? "تقرير-قاعدة-بيانات-الحالات" : "تقرير-التنفيذات-والإنجازات";
    return xlsxResponse(buildWorkbook(sheets), `${name}-${date}`);
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

const table = (head: string, rows: Row[], unit = "عدد الأسر") => rows.map(([k, v]) => ({ [head]: k, [unit]: v }));
const groups = (head: string, rows: GroupRow[]) => rows.map((r) => ({ [head]: r.k, "المساعدات": r.n, "الأسر": r.f }));

function casesReportSheets(r: Awaited<ReturnType<typeof casesReport>>) {
  const t = r.totals;
  return [
    { name: "ملخص", rows: [
      ["الأسر المسجلة", t.total], ["إجمالي الأفراد", t.people], ["الأطفال", t.children], ["متوسط حجم الأسرة", t.avgFamily],
      ["أسر استفادت فعلاً", t.benefited], ["بياناتها مكتملة 100%", t.complete], ["متوسط اكتمال البيانات %", t.avgCompleteness],
      ["معاها رقم قومي", t.withNid], ["معاها تليفون", t.withPhone], ["عدد المحافظات", t.governorates], ["عدد القرى", t.villages],
      ["متوسط الدخل الشهري", t.avgIncome], ["اتسجلت الشهر ده", t.thisMonth],
    ].map(([k, v]) => ({ "البند": k, "القيمة": v })) },
    { name: "حالة الملف", rows: table("حالة الملف", r.status) },
    { name: "الأولوية", rows: table("الأولوية", r.priority) },
    { name: "اكتمال البيانات", rows: table("نسبة الاكتمال", r.completeness) },
    { name: "المحافظات", rows: table("المحافظة", r.gov) },
    { name: "المراكز", rows: table("المركز", r.markaz) },
    { name: "القرى", rows: table("القرية", r.village) },
    { name: "الحالة الاجتماعية", rows: table("الحالة الاجتماعية", r.marital) },
    { name: "الحالة الصحية", rows: table("الحالة الصحية", r.health) },
    { name: "حجم الأسرة", rows: table("عدد الأفراد", r.family) },
    { name: "نوع السقف", rows: table("نوع السقف", r.roof) },
    { name: "مصدر الدخل", rows: table("مصدر الدخل", r.income) },
    { name: "الدخل الشهري", rows: table("الدخل الشهري", r.incomeBuckets) },
    { name: "نصيب الفرد", rows: table("نصيب الفرد من الدخل", r.perCapita) },
    { name: "التدخلات المقترحة", rows: table("التدخل", r.recommendations) },
    { name: "الترشيحات", rows: r.nominations.map((x) => ({ "المشروع": x.project, "مستنية كشف": x.pool, "في كشف (مسودة)": x.draft, "اتبعتت": x.sent })) },
    { name: "التسجيل الشهري", rows: table("الشهر", r.months) },
    { name: "مصدر التسجيل", rows: table("المصدر", r.source) },
    { name: "نوع الاستمارة", rows: table("الاستمارة", r.formType) },
    { name: "الباحثين", rows: table("الباحث", r.explorers) },
  ];
}

function achievementsSheets(r: Awaited<ReturnType<typeof achievementsReport>>) {
  const t = r.totals;
  const out: { name: string; rows: Record<string, unknown>[] }[] = [
    { name: "ملخص", rows: [
      ["مساعدات اتسلمت (مسجلة في السستم)", t.aid], ["عدد السجلات", t.records], ["أسر استفادت", t.families], ["أفراد وصلهم الأثر", t.people],
      ["أسر استفادت من أكتر من مشروع", t.repeat], ["مشروعات", t.projects], ["محافظات", t.governorates], ["قرى", t.villages], ["قوافل / دفعات", t.convoys],
      ["أول تاريخ", t.first ?? ""], ["آخر تاريخ", t.last ?? ""],
      ...(r.cumulative ? [["إجمالي المساعدات منذ 2023 (تراكمي)", r.cumulative.aid], ["إجمالي المستفيدين منذ 2023 (تراكمي)", r.cumulative.beneficiaries]] : []),
    ].map(([k, v]) => ({ "البند": k, "القيمة": v })) },
  ];
  if (r.cumulative) out.push(
    { name: "تراكمي - السنين", rows: table("السنة", r.cumulative.years, "المساعدات") },
    { name: "تراكمي - المستفيدين", rows: table("السنة", r.cumulative.beneficiariesByYear, "المستفيدين") },
    { name: "تراكمي - المشروعات", rows: table("المشروع", r.cumulative.projects, "المساعدات") },
    { name: "تراكمي - المحافظات", rows: table("المحافظة", r.cumulative.governorates, "المساعدات") },
  );
  return [
    ...out,
    { name: "حسب السنة", rows: groups("السنة", r.byYear) },
    { name: "حسب الشهر", rows: groups("الشهر", r.byMonth) },
    { name: "حسب المشروع", rows: groups("المشروع", r.byProject) },
    { name: "حسب القطاع", rows: groups("القطاع", r.bySector) },
    { name: "حسب المحافظة", rows: groups("المحافظة", r.byGov) },
    { name: "حسب القرية", rows: groups("القرية", r.byVillage) },
    { name: "القوافل", rows: r.convoys.map((x) => ({ "المشروع": x.project, "القافلة": x.convoy, "المحافظات": x.govs, "من": x.from, "إلى": x.to, "المساعدات": x.n, "الأسر": x.f })) },
    { name: "كشوف الترشيح", rows: r.sheets.map((x) => ({ "المشروع": x.project, "عدد الكشوف": x.sheets, "عدد الحالات": x.cases })) },
  ];
}
