"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [submitted, setSubmitted] = useState(false);
  const registering = mode === "register";
  if (submitted) return <Card className="w-full max-w-md rounded-2xl"><CardContent className="p-8 text-center"><CheckCircle2 className="mx-auto size-12 text-primary" /><h1 className="mt-5 text-2xl font-black">Prototype form complete</h1><p className="mt-3 leading-7 text-muted-foreground">Authentication will connect to Supabase in the next integration step.</p><Button asChild className="mt-6 w-full"><Link href="/dashboard">Open demonstration dashboard</Link></Button></CardContent></Card>;
  return <Card className="w-full max-w-md rounded-2xl shadow-xl shadow-slate-900/5"><CardHeader className="space-y-2 p-7 pb-3"><CardTitle className="text-2xl font-black">{registering ? "Create your account" : "Welcome back"}</CardTitle><CardDescription>{registering ? "Create an account to submit and track reports." : "Sign in to track your reports and updates."}</CardDescription></CardHeader><CardContent className="p-7 pt-4"><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>{registering && <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" required autoComplete="name" placeholder="Edzani Maisha" className="h-11" /></div>}<div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" required autoComplete="email" placeholder="name@example.com" className="h-11" /></div><div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">Password</Label>{!registering && <Link href="#" className="text-sm font-semibold text-primary">Forgot password?</Link>}</div><Input id="password" type="password" required minLength={8} autoComplete={registering ? "new-password" : "current-password"} className="h-11" /></div><Button type="submit" className="h-11 w-full rounded-xl">{registering ? "Create account" : "Sign in"}<ArrowRight /></Button></form><p className="mt-6 text-center text-sm text-muted-foreground">{registering ? "Already have an account?" : "New to CivicFix?"} <Link href={registering ? "/login" : "/register"} className="font-bold text-primary">{registering ? "Sign in" : "Create account"}</Link></p></CardContent></Card>;
}
