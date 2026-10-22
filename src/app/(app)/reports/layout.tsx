import { requireUser } from "@/lib/server/auth";
import { ReportTabs } from "./tabs";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireUser("dashboard");
  return <><ReportTabs />{children}</>;
}
