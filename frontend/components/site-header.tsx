import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8"><Link href="/" className="flex items-center gap-2.5 font-black tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 className="size-5" /></span><span className="text-lg">CivicFix <span className="text-primary">AI</span></span></Link><nav aria-label="Main navigation" className="flex items-center gap-2">{!compact && <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground sm:block">My reports</Link>}<Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button><Button asChild className="rounded-xl"><Link href="/report">Report an issue</Link></Button></nav></div></header>;
}
