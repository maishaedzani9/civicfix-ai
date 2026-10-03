import { Administration } from "@/components/administration";
import { SiteHeader } from "@/components/site-header";
export default function Page() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Administration />
    </main>
  );
}
