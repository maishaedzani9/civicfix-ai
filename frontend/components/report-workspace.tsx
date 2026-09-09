"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, Camera, CheckCircle2, MapPin, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Draft = { category: string; urgency: string; title: string; description: string; location: string };
const initialDraft: Draft = { category: "", urgency: "medium", title: "", description: "", location: "" };

export function ReportWorkspace() {
  const [draft, setDraft] = useState(initialDraft);
  const [message, setMessage] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function suggestFromMessage(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 12) return;
    const lower = message.toLowerCase();
    const category = lower.includes("water") || lower.includes("leak") ? "water_leak" : lower.includes("pothole") || lower.includes("road") ? "pothole" : lower.includes("light") ? "broken_streetlight" : "other";
    setDraft({ category, urgency: lower.includes("danger") || lower.includes("road") ? "high" : "medium", title: category === "water_leak" ? "Water leak requiring attention" : category === "pothole" ? "Road damage requiring attention" : "Infrastructure issue requiring attention", description: message.trim(), location: "" });
    setAiReady(true);
  }

  if (submitted) return <div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center shadow-xl"><span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-9" /></span><p className="mt-6 text-sm font-bold uppercase tracking-[0.15em] text-primary">Demonstration submitted</p><h1 className="mt-2 text-3xl font-black">Your report is ready to track</h1><p className="mt-3 leading-7 text-muted-foreground">Reference <strong className="text-foreground">CF-DEMO-2609</strong> shows how the completed experience will respond. No real municipal report was sent.</p><Button asChild className="mt-7"><Link href="/dashboard">View my reports</Link></Button></div>;

  return <div className="grid gap-6 lg:grid-cols-[.92fr_1.08fr]">
    <section className="overflow-hidden rounded-3xl border border-slate-700 bg-[#071827] text-white shadow-xl">
      <div className="border-b border-white/10 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-cyan-300 text-slate-950"><Bot /></span><div><p className="font-bold">CivicFix Assistant</p><p className="text-sm text-slate-300">Describe the problem naturally</p></div></div></div>
      <div className="space-y-4 p-5 sm:p-6"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/10 p-4 text-sm leading-6 text-slate-100">What happened? Include what you can see and where the problem is. I’ll help organise the report.</div>{message && <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-cyan-300 p-4 text-sm leading-6 text-slate-950">{message}</div>}{aiReady && <div className="rounded-2xl rounded-tl-sm bg-white p-4 text-sm text-slate-800"><div className="flex items-center gap-2 font-bold text-primary"><Sparkles className="size-4" />Draft prepared</div><p className="mt-2 leading-6">I suggested a category and urgency. Please complete the location and confirm every field before submission.</p></div>}</div>
      <form onSubmit={suggestFromMessage} className="border-t border-white/10 p-4 sm:p-5"><Label htmlFor="chat-message" className="sr-only">Describe the infrastructure problem</Label><div className="flex gap-2"><Textarea id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: Water is leaking into the road near..." className="min-h-20 resize-none border-white/15 bg-white/10 text-white placeholder:text-slate-400" /><Button type="submit" size="icon-lg" aria-label="Prepare report draft" className="self-end bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Send /></Button></div></form>
    </section>

    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="mb-6"><p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Report details</p><h2 className="mt-2 text-2xl font-black">Review before submitting</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">AI suggestions remain editable and are never submitted without your confirmation.</p></div>
      <Tabs defaultValue="details"><TabsList className="mb-6 grid w-full grid-cols-2"><TabsTrigger value="details">Issue details</TabsTrigger><TabsTrigger value="evidence">Location & evidence</TabsTrigger></TabsList>
        <TabsContent value="details" className="space-y-5"><div className="space-y-2"><Label>Category</Label><Select value={draft.category} onValueChange={(category) => setDraft({ ...draft, category })}><SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent><SelectItem value="water_leak">Water leak</SelectItem><SelectItem value="pothole">Pothole or road damage</SelectItem><SelectItem value="electricity_fault">Electricity fault</SelectItem><SelectItem value="broken_streetlight">Broken streetlight</SelectItem><SelectItem value="illegal_dumping">Illegal dumping</SelectItem><SelectItem value="other">Other issue</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="title">Short title</Label><Input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What needs attention?" /></div><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Describe what happened and any immediate risks." className="min-h-32" /></div><div className="space-y-2"><Label>Suggested urgency</Label><Select value={draft.urgency} onValueChange={(urgency) => setDraft({ ...draft, urgency })}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical — immediate review</SelectItem></SelectContent></Select></div></TabsContent>
        <TabsContent value="evidence" className="space-y-5"><div className="space-y-2"><Label htmlFor="location">Address or landmark</Label><div className="relative"><MapPin className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Street, landmark or nearby building" className="pl-9" /></div></div><button type="button" className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-center hover:border-primary/50"><Camera className="size-7 text-primary" /><span className="mt-3 font-bold">Add a supporting photo</span><span className="mt-1 text-sm text-muted-foreground">JPEG, PNG or WebP · maximum 10 MB</span></button><div className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Privacy:</strong> Avoid including faces, number plates or private information unless essential to the report.</div></TabsContent>
      </Tabs>
      <div className="mt-7 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between"><Button asChild variant="ghost"><Link href="/dashboard"><ArrowLeft />Save and exit</Link></Button><Button onClick={() => setSubmitted(true)} disabled={!draft.category || draft.title.length < 8 || draft.description.length < 20 || !draft.location} className="h-11 rounded-xl">Confirm and submit <ArrowRight /></Button></div>
    </section>
  </div>;
}
