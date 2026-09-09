import Link from "next/link";
import { ArrowRight, Bot, Camera, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

const steps = [
  { icon: Bot, title: "Describe the problem", body: "Tell CivicFix what happened in your own words. The assistant asks only for details that are missing." },
  { icon: MapPin, title: "Confirm the location", body: "Add an address or map point so the right operational team can find the issue." },
  { icon: CheckCircle2, title: "Track the response", body: "Receive a reference number and follow every acknowledged, assigned and resolved update." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative overflow-hidden border-b border-border/80">
        <div className="civic-grid absolute inset-0 opacity-55" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary"><ShieldCheck className="size-4" /> Community reports, responsibly handled</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-6xl">Report local infrastructure problems without the runaround.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">CivicFix AI helps residents submit complete, trackable reports for potholes, water leaks, electricity faults, broken streetlights and illegal dumping.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base shadow-lg shadow-primary/15"><Link href="/report">Report an issue <ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-6 text-base"><Link href="/dashboard">Track my reports</Link></Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">Not an emergency service. Call the relevant emergency number when life or property is in immediate danger.</p>
          </div>
          <div className="relative rounded-[2rem] border border-slate-700 bg-[#071827] p-4 shadow-2xl shadow-slate-950/20 sm:p-6">
            <div className="mb-5 flex items-center justify-between text-white"><div><p className="text-sm font-semibold text-cyan-300">CIVICFIX ASSISTANT</p><p className="mt-1 text-lg font-bold">Let’s make your report complete</p></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">Ready</span></div>
            <div className="space-y-4 rounded-2xl bg-white p-4 sm:p-5">
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-slate-100 p-4 text-sm leading-6 text-slate-700">What infrastructure problem would you like to report?</div>
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-primary p-4 text-sm leading-6 text-white">There is a large water leak near the university entrance. Water is flowing into the road.</div>
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-cyan-100 bg-cyan-50 p-4 text-sm text-slate-700"><p className="font-bold text-slate-900">Suggested report</p><div className="mt-3 grid grid-cols-2 gap-3"><div><span className="block text-xs font-semibold text-slate-500">CATEGORY</span>Water leak</div><div><span className="block text-xs font-semibold text-slate-500">URGENCY</span><span className="font-bold text-orange-700">High</span></div></div><p className="mt-3 text-xs text-slate-500">You’ll confirm every detail before anything is submitted.</p></div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border bg-white p-4 shadow-xl sm:block"><div className="flex items-center gap-3"><Camera className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Evidence</p><p className="text-sm font-bold">Photo attached</p></div></div></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">A clearer reporting path</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Three steps from problem to reference number</h2></div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map(({ icon: Icon, title, body }, index) => <article key={title} className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon /></span><span className="text-sm font-black text-slate-300">0{index + 1}</span></div><h3 className="mt-6 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{body}</p></article>)}</div>
      </section>
    </main>
  );
}
