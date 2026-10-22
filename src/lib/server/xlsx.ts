import "server-only";
import * as XLSX from "xlsx";

/** ملف إكسل بشيت واحد من اليمين للشمال. */
export function buildXlsx(rows: Record<string, unknown>[], sheetName = "البيانات"): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!views"] = [{ RTL: true }];
  if (rows.length) ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] ?? "").length + 1))) }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
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
