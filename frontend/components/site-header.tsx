"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, demoMode, signOut, type Me } from "@/lib/api";
export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/me")
      .then(setMe)
      .catch(() => {});
  }, []);
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-black">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </span>
            CivicFix AI
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center gap-2"
          >
            {!compact && (
              <Link href="/dashboard" className="px-2 text-sm font-semibold">
                My reports
              </Link>
            )}
            {me && me.role !== "resident" && (
              <Link href="/operations" className="px-2 text-sm font-semibold">
                Operations
              </Link>
            )}
            {me?.role === "admin" && (
              <Link href="/admin" className="px-2 text-sm font-semibold">
                Admin
              </Link>
            )}
            {me ? (
              <Button variant="ghost" onClick={async () => { await signOut(); setMe(null); router.replace("/login"); router.refresh(); }}>
                Sign out
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/report">Report an issue</Link>
            </Button>
          </nav>
        </div>
      </header>
      {demoMode && (
        <p className="bg-amber-50 px-5 py-2 text-center text-xs text-amber-900">
          Local demonstration · Reports are not sent to a municipality.
        </p>
      )}
    </>
  );
}
