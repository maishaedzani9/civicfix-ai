import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";

const reports = [
  { reference: "CF-2026-7FA21C9D", title: "Large water leak near university entrance", category: "Water leak", status: "Assigned", date: "8 Sep 2026", urgency: "High" },
  { reference: "CF-2026-12BD640A", title: "Streetlight not working on University Drive", category: "Streetlight", status: "In progress", date: "5 Sep 2026", urgency: "Medium" },
  { reference: "CF-2026-98C51E30", title: "Pothole near pedestrian crossing", category: "Road damage", status: "Resolved", date: "28 Aug 2026", urgency: "Medium" },
];

export default function DashboardPage() {
  return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-7xl px-5 py-9 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Resident dashboard</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Good evening, Edzani</h1><p className="mt-2 text-muted-foreground">Track your reports and see what changed.</p></div><Button asChild size="lg" className="rounded-xl"><Link href="/report"><Plus />New report</Link></Button></div><section className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={FileText} label="Total reports" value="3" /><Metric icon={Clock3} label="Active" value="2" /><Metric icon={CheckCircle2} label="Resolved" value="1" /></section><section className="mt-8 rounded-2xl border bg-card"><div className="flex flex-col justify-between gap-4 border-b p-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">My reports</h2><p className="mt-1 text-sm text-muted-foreground">Demonstration data for the resident experience.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search reports" placeholder="Search reference or issue" className="pl-9" /></div></div><div className="divide-y">{reports.map((report) => <article key={report.reference} className="grid gap-4 p-5 transition-colors hover:bg-muted/50 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{report.category}</Badge>{report.urgency === "High" && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100"><AlertTriangle />High urgency</Badge>}</div><h3 className="mt-3 font-bold">{report.title}</h3><p className="mt-1 text-sm text-muted-foreground">{report.reference} · Submitted {report.date}</p></div><div className="flex items-center justify-between gap-5 md:justify-end"><StatusBadge status={report.status} /><Button variant="ghost" size="icon" aria-label={`Open ${report.reference}`}><ArrowUpRight /></Button></div></article>)}</div></section></div></main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) { return <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon /></span><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-black">{value}</p></div></CardContent></Card>; }
function StatusBadge({ status }: { status: string }) { const colour = status === "Resolved" ? "bg-emerald-100 text-emerald-800" : status === "Assigned" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${colour}`}>{status}</span>; }
