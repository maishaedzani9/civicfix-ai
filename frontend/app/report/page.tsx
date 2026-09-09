import { ReportWorkspace } from "@/components/report-workspace";
import { SiteHeader } from "@/components/site-header";

export default function ReportPage() { return <main className="min-h-screen"><SiteHeader compact /><div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><div className="mb-7"><p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">New community report</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Tell us what needs attention</h1></div><ReportWorkspace /></div></main>; }
