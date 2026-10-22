"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/constants";
import { deleteCase, setCaseStatus, toggleNomination } from "../actions";

export function StatusControl({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setErr(null);
    try { await setCaseStatus(id, value, reason); } catch (e) { setErr((e as Error).message); }
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">حالة الملف</label>
        <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
          {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {value === "excluded" && (
        <div className="flex-1 min-w-[180px]">
          <label className="label">سبب الاستبعاد</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      <button className="btn" onClick={save} disabled={pending || (value === status && value !== "excluded")}>حفظ</button>
      {err && <span className="text-danger text-xs">{err}</span>}
    </div>
  );
}

export function NominateToggle({ caseId, projectId, on, disabled }: { caseId: string; projectId: string; on: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={on ? "btn btn-sm btn-primary" : "btn btn-sm"} disabled={pending || disabled}
      onClick={() => start(() => toggleNomination(caseId, projectId, !on))}>
      {on ? "مرشحة ✓" : "ترشيح"}
    </button>
  );
}

export function DeleteCase({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-danger" disabled={pending} onClick={() => {
      if (!confirm("متأكد إنك عايز تحذف الحالة دي نهائياً؟")) return;
      start(async () => { await deleteCase(id); router.push("/cases"); });
    }}>حذف</button>
  );
}
