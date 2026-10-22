"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkOldBenefits } from "./actions";

/** بيربط المساعدات اللي ملهاش ملف بسجل الحالات على دفعات لحد ما تخلص. */
export function LinkBenefitsButton({ unlinked }: { unlinked: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const run = () => start(async () => {
    let total = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const { linked, remaining } = await linkOldBenefits();
        total += linked;
        setMsg(`اتربط ${total.toLocaleString("ar-EG")}… فاضل ${remaining.toLocaleString("ar-EG")}`);
        if (!remaining || !linked) break;
      }
      // الكارت ده بيختفي لما كله يترتبط، فالنتيجة بتظهر في الصفحة من الرابط
      router.push(`/benefits?linked=${total}`);
    } catch (e) {
      setMsg(`حصلت مشكلة: ${(e as Error).message}`);
      router.refresh();
    }
  });
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 border-accent/40 bg-accent/5">
      <div className="flex-1 min-w-[220px] text-sm">
        <b>{unlinked.toLocaleString("ar-EG")}</b> مساعدة مسجلة لأشخاص ملهمش ملف في سجل الحالات.
        <div className="text-ink-soft text-xs mt-1">الزرار بيدور على كل شخص بالرقم القومي أو الاسم + التليفون، ولو ملقاهوش بيفتح له ملف جديد حالته "تم التنفيذ".</div>
      </div>
      <button className="btn btn-primary" disabled={pending} onClick={run}>{pending ? "جاري الربط…" : "ضيفهم لسجل الحالات"}</button>
      {msg && <p className="w-full text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
