import { ReportDashboard } from "@/components/report-dashboard";
import { SiteHeader } from "@/components/site-header";
export default function Page() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <ReportDashboard operations />
    </main>
  );
}
