import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>
);
export const PriorityBadge = ({ level }: { level: string }) => (
  <span className={`badge badge-${level}`}>{PRIORITY_LABELS[level] ?? level}</span>
);
export function CompletenessBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "bg-good" : percent >= 60 ? "bg-accent" : "bg-danger";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 flex-1 rounded-full bg-surface-alt overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${percent}%` }} /></div>
      <span className="text-[11px] text-ink-soft tabular-nums">{percent}%</span>
    </div>
  );
}
