import clsx from "clsx";

export const n = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("ar-EG");
const pct = (v: number, total: number) => (total ? `${Math.round((v / total) * 100).toLocaleString("ar-EG")}%` : "—");

/** رقم كبير مع شرح تحته. */
export function Kpi({ label, value, foot, tone = "primary", big }: { label: string; value: number | string; foot?: string; tone?: "primary" | "accent"; big?: boolean }) {
  return (
    <div className={clsx("card p-4 h-full break-inside-avoid", big && "p-5")}>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={clsx("font-extrabold mt-1 tabular-nums", big ? "text-3xl" : "text-2xl", tone === "accent" ? "text-accent" : "text-primary")}>
        {typeof value === "number" ? n(value) : value}
      </div>
      {foot && <div className="text-[11px] text-ink-soft mt-1">{foot}</div>}
    </div>
  );
}

export function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("card break-inside-avoid", className)}>
      <h3 className="section-title">{title}</h3>
      {sub && <p className="section-sub">{sub}</p>}
      {children}
    </section>
  );
}

/**
 * أعمدة أفقية: البند، الشريط، العدد، والنسبة من الإجمالي.
 * `extra` عمود اختياري تاني (زي عدد الأسر) بيظهر جنب العدد.
 */
export function BarList({ rows, extra, unit, max: limit, empty = "لا توجد بيانات بعد" }: {
  rows: [string, number][]; extra?: { label: string; values: number[] }; unit?: string; max?: number; empty?: string;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const total = rows.reduce((s, r) => s + r[1], 0);
  const top = Math.max(1, ...shown.map((r) => r[1]));
  if (!rows.length || !total) return <p className="text-sm text-ink-soft mt-3">{empty}</p>;
  return (
    <div className="mt-3">
      {extra && (
        <div className="grid grid-cols-[minmax(90px,140px)_1fr_64px_64px_44px] gap-2 text-[10.5px] text-ink-soft mb-1">
          <span /><span /><span className="text-left">{unit ?? "العدد"}</span><span className="text-left">{extra.label}</span><span className="text-left">النسبة</span>
        </div>
      )}
      <div className="space-y-1.5">
        {shown.map(([k, v], i) => (
          <div key={k} title={`${k}: ${n(v)}${unit ? ` ${unit}` : ""} (${pct(v, total)})`}
            className={clsx("grid items-center gap-2 text-xs rounded hover:bg-surface-alt",
              extra ? "grid-cols-[minmax(90px,140px)_1fr_64px_64px_44px]" : "grid-cols-[minmax(90px,140px)_1fr_64px_44px]")}>
            <span className="truncate text-ink" title={k}>{k}</span>
            <div className="h-2.5 rounded-full bg-surface-alt overflow-hidden">
              <div className="h-full rounded-full bg-primary print:bg-primary" style={{ width: `${Math.max(1.5, (v / top) * 100)}%` }} />
            </div>
            <span className="tabular-nums font-bold text-left">{n(v)}</span>
            {extra && <span className="tabular-nums text-ink-soft text-left">{n(extra.values[i])}</span>}
            <span className="tabular-nums text-ink-soft text-left">{pct(v, total)}</span>
          </div>
        ))}
      </div>
      {limit && rows.length > limit && <p className="text-[11px] text-ink-soft mt-2">و{n(rows.length - limit)} بند تاني (موجودين في ملف الإكسل)</p>}
    </div>
  );
}

/** أعمدة رأسية للتسلسل الزمني (شهور/سنين). القيمة بتظهر عند الوقوف على العمود، وعلى أعلى عمود وآخر عمود. */
export function Columns({ rows, label = (k: string) => k, unit }: { rows: [string, number][]; label?: (k: string) => string; unit?: string }) {
  const top = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.some((r) => r[1])) return <p className="text-sm text-ink-soft mt-3">لا توجد بيانات بعد</p>;
  const topIdx = rows.findIndex((r) => r[1] === top);
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1.5 h-40 border-b border-line">
        {rows.map(([k, v], i) => (
          <div key={k} className="group relative flex-1 h-full flex flex-col justify-end items-center" title={`${label(k)}: ${n(v)}${unit ? ` ${unit}` : ""}`}>
            <span className={clsx("text-[10px] font-bold tabular-nums mb-0.5", i === topIdx || i === rows.length - 1 ? "text-ink" : "opacity-0 group-hover:opacity-100")}>{n(v)}</span>
            <div className="w-full max-w-[34px] rounded-t bg-primary group-hover:bg-primary-dark" style={{ height: `${(v / top) * 85}%`, minHeight: v ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {rows.map(([k]) => <div key={k} className="flex-1 min-w-0 text-center text-[10px] leading-tight text-ink-soft break-words">{label(k)}</div>)}
      </div>
    </div>
  );
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
/** "2026-03" → "مارس 26" */
export const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : k;
};

/** جدول بسيط للأرقام. */
export function NumTable({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="table-wrap mt-3"><table className="table">
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "tabular-nums font-semibold" : ""}>{typeof v === "number" ? n(v) : v ?? "—"}</td>)}</tr>
        ))}
        {!rows.length && <tr><td colSpan={head.length} className="text-center text-ink-soft py-6">لا توجد بيانات بعد</td></tr>}
      </tbody>
    </table></div>
  );
}
