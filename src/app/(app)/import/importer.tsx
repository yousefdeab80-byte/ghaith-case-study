"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import clsx from "clsx";
import { FORM_TYPES } from "@/lib/constants";
import { BENEFIT_IMPORT_FIELDS, CASE_IMPORT_FIELDS, planCaseImport, suggestMapping, type CaseImportPlan, type RowIssue } from "@/lib/import";
import { existingNids, finishBatch, importBenefitsChunk, importCasesChunk, startBatch } from "./actions";

type Kind = "cases" | "benefits";
type Sheet = { name: string; grid: unknown[][] };
const CHUNK = 400;

/** أول صف فيه 3 خانات مليانة على الأقل بنعتبره صف العناوين. */
function detectHeaderRow(grid: unknown[][]): number {
  const i = grid.findIndex((r) => r.filter((c) => String(c ?? "").trim()).length >= 3);
  return Math.max(0, i);
}

export function Importer() {
  const [kind, setKind] = useState<Kind>("cases");
  const [formType, setFormType] = useState("general");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [plan, setPlan] = useState<CaseImportPlan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; merged: number; skipped: number; issues: RowIssue[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = kind === "cases" ? CASE_IMPORT_FIELDS : BENEFIT_IMPORT_FIELDS;

  const sheet = sheets[sheetIdx];
  const headers = useMemo(() => (sheet?.grid[headerRow] ?? []).map((h, i) => String(h ?? "").trim() || `عمود ${i + 1}`), [sheet, headerRow]);
  const { rows, rowNumbers } = useMemo(() => {
    if (!sheet) return { rows: [], rowNumbers: [] };
    const kept = sheet.grid.map((r, i) => ({ r, n: i + 1 })).slice(headerRow + 1).filter(({ r }) => r.some((c) => String(c ?? "").trim()));
    return { rows: kept.map(({ r }) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))), rowNumbers: kept.map(({ n }) => n) };
  }, [sheet, headerRow, headers]);

  const reset = () => { setPlan(null); setResult(null); setProgress(null); };

  const onFile = async (f: File) => {
    reset();
    setFileName(f.name);
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: false });
    const list = wb.SheetNames.map((name) => ({ name, grid: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: true }) }));
    setSheets(list);
    pickSheet(list, 0);
  };

  const pickSheet = (list: Sheet[], i: number, k: Kind = kind) => {
    setSheetIdx(i);
    const hr = detectHeaderRow(list[i]?.grid ?? []);
    setHeaderRow(hr);
    const hs = (list[i]?.grid[hr] ?? []).map((h, j) => String(h ?? "").trim() || `عمود ${j + 1}`);
    setMapping(suggestMapping(hs, k === "cases" ? CASE_IMPORT_FIELDS : BENEFIT_IMPORT_FIELDS));
    reset();
  };

  const analyze = async () => {
    setBusy(true);
    try {
      if (kind === "cases") {
        const nidCol = Object.entries(mapping).find(([, k]) => k === "headNid")?.[0];
        const nids = nidCol ? rows.map((r) => String(r[nidCol] ?? "")) : [];
        const existing = new Set(nids.length ? await existingNids(nids) : []);
        setPlan(planCaseImport(rows, mapping, existing, rowNumbers));
      } else {
        setPlan({ creates: rows.map((r, i) => ({ row: rowNumbers[i], values: r })), merges: [], issues: [], skipped: 0 });
      }
    } finally { setBusy(false); }
  };

  const run = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const batchId = await startBatch(kind, fileName, rows.length);
      if (kind === "cases") {
        const all = [...plan.creates, ...plan.merges];
        setProgress({ done: 0, total: all.length });
        for (let i = 0; i < all.length; i += CHUNK) {
          await importCasesChunk(batchId, formType, all.slice(i, i + CHUNK));
          setProgress({ done: Math.min(i + CHUNK, all.length), total: all.length });
        }
      } else {
        const mapped = rows.map((r, i) => ({
          row: rowNumbers[i],
          values: Object.fromEntries(Object.entries(mapping).filter(([, k]) => k).map(([h, k]) => [k!, r[h]])),
        }));
        setProgress({ done: 0, total: mapped.length });
        for (let i = 0; i < mapped.length; i += CHUNK) {
          await importBenefitsChunk(batchId, mapped.slice(i, i + CHUNK));
          setProgress({ done: Math.min(i + CHUNK, mapped.length), total: mapped.length });
        }
      }
      const b = await finishBatch(batchId);
      setResult({ created: b.created, merged: b.merged, skipped: b.skipped + (plan.skipped ?? 0), issues: [...plan.issues, ...b.issues] });
    } catch (e) {
      alert("حصل خطأ أثناء الاستيراد: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const downloadIssues = () => {
    if (!result) return;
    const ws = XLSX.utils.json_to_sheet(result.issues.map((i) => ({ "رقم الصف في الملف": i.row, "الملاحظة": i.message })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ملاحظات");
    XLSX.writeFile(wb, `ملاحظات-استيراد-${fileName}`);
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="section-title">1. نوع البيانات والملف</div>
        <div className="grid gap-3 md:grid-cols-3 mt-3">
          <div>
            <label className="label">نوع البيانات</label>
            <select className="input" value={kind} onChange={(e) => { const k = e.target.value as Kind; setKind(k); if (sheets.length) pickSheet(sheets, sheetIdx, k); }}>
              <option value="cases">كشف حالات (بيانات الأسر)</option>
              <option value="benefits">سجل مساعدات منفذة (مين استلم إيه)</option>
            </select>
          </div>
          {kind === "cases" && (
            <div>
              <label className="label">نوع الاستمارة للحالات الجديدة</label>
              <select className="input" value={formType} onChange={(e) => setFormType(e.target.value)}>
                {FORM_TYPES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">ملف الإكسل</label>
            <input type="file" accept=".xlsx,.xls,.csv" className="input py-1.5" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        </div>
      </div>

      {sheet && (
        <div className="card">
          <div className="section-title">2. ربط الأعمدة</div>
          <div className="section-sub">السستم اقترح الربط من أسماء الأعمدة. راجع وغيّر أي عمود، والأعمدة اللي مش محتاجها سيبها "تجاهل". الصفوف الناقصة هتتسجل عادي.</div>
          <div className="flex flex-wrap gap-3 mb-3">
            {sheets.length > 1 && (
              <div>
                <label className="label">الشيت</label>
                <select className="input" value={sheetIdx} onChange={(e) => pickSheet(sheets, Number(e.target.value))}>
                  {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">صف العناوين</label>
              <input type="number" min={1} className="input w-24" value={headerRow + 1} onChange={(e) => {
                const hr = Math.max(0, Number(e.target.value) - 1); setHeaderRow(hr);
                const hs = (sheet.grid[hr] ?? []).map((h, j) => String(h ?? "").trim() || `عمود ${j + 1}`);
                setMapping(suggestMapping(hs, fields)); reset();
              }} />
            </div>
            <div className="text-sm text-ink-soft self-end pb-2">{rows.length.toLocaleString("ar-EG")} صف · {mappedCount} عمود مربوط</div>
          </div>
          <div className="table-wrap max-h-[420px] overflow-y-auto">
            <table className="table">
              <thead><tr><th>عمود الإكسل</th><th>أمثلة من البيانات</th><th>الحقل في السستم</th></tr></thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h} className={clsx(!mapping[h] && "opacity-60")}>
                    <td className="font-semibold">{h}</td>
                    <td className="text-xs text-ink-soft max-w-[280px] truncate">{rows.slice(0, 3).map((r) => String(r[h] ?? "")).filter(Boolean).join(" · ")}</td>
                    <td>
                      <select className="input py-1" value={mapping[h] ?? ""} onChange={(e) => { setMapping({ ...mapping, [h]: e.target.value || null }); reset(); }}>
                        <option value="">تجاهل</option>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary mt-3" disabled={busy || !mappedCount} onClick={analyze}>{busy && !plan ? "جارٍ التحليل..." : "3. مراجعة قبل الاستيراد"}</button>
        </div>
      )}

      {plan && !result && (
        <div className="card">
          <div className="section-title">مراجعة قبل الحفظ</div>
          <div className="grid gap-3 sm:grid-cols-4 my-3">
            <Stat label={kind === "cases" ? "حالات جديدة" : "مساعدات هتتسجل"} value={plan.creates.length} />
            {kind === "cases" && <Stat label="موجودة قبل كده (هتتكمل بياناتها)" value={plan.merges.length} />}
            <Stat label="صفوف فاضية هتتجاهل" value={plan.skipped} />
            <Stat label="ملاحظات" value={plan.issues.length} tone="accent" />
          </div>
          {plan.issues.length > 0 && (
            <ul className="text-xs text-ink-soft max-h-40 overflow-y-auto mb-3 space-y-1">
              {plan.issues.slice(0, 100).map((i, k) => <li key={k}>صف {i.row}: {i.message}</li>)}
            </ul>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? "جارٍ الاستيراد..." : "تأكيد الاستيراد"}</button>
          {progress && <div className="mt-3 h-2 rounded-full bg-surface-alt overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>}
        </div>
      )}

      {result && (
        <div className="card border-good">
          <div className="section-title text-good">تم الاستيراد</div>
          <div className="grid gap-3 sm:grid-cols-4 my-3">
            <Stat label="اتضاف" value={result.created} />
            {kind === "cases" && <Stat label="اتكمل في حالات موجودة" value={result.merged} />}
            <Stat label="اتجاهل" value={result.skipped} />
            <Stat label="ملاحظات" value={result.issues.length} tone="accent" />
          </div>
          {result.issues.length > 0 && <button className="btn" onClick={downloadIssues}>تنزيل الملاحظات إكسل</button>}
          <a href={kind === "cases" ? "/cases?incomplete=1" : "/benefits"} className="btn btn-primary mr-2">{kind === "cases" ? "عرض الحالات الناقصة" : "عرض سجل المساعدات"}</a>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" }) {
  return (
    <div className="rounded-lg bg-bg border border-line p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={clsx("text-xl font-extrabold", tone === "accent" ? "text-accent" : "text-primary")}>{value.toLocaleString("ar-EG")}</div>
    </div>
  );
}
