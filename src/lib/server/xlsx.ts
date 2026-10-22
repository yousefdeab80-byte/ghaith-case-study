import "server-only";
import * as XLSX from "xlsx";

/** ملف إكسل بشيت واحد من اليمين للشمال. */
export function buildXlsx(rows: Record<string, unknown>[], sheetName = "البيانات"): Buffer {
  return buildWorkbook([{ name: sheetName, rows }]);
}

/** ملف إكسل بأكتر من شيت (زي التقارير: شيت لكل جدول). */
export function buildWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const used = new Set<string>();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "لا توجد بيانات" }]);
    ws["!views"] = [{ RTL: true }];
    if (rows.length) ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] ?? "").length + 1))) }));
    let title = name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
    for (let i = 2; used.has(title); i++) title = `${name.slice(0, 28)} ${i}`;
    used.add(title);
    XLSX.utils.book_append_sheet(wb, ws, title);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function xlsxResponse(buf: Buffer, name: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
    },
  });
}

/** اسم ملف آمن (من غير / ولا رموز بتبوظ الويندوز). */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
