"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, demoMode, supabase } from "@/lib/api";

export function AuthForm({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || ""),
      password = String(form.get("password") || "");
    try {
      const auth = supabase().auth;
      if (mode === "forgot") {
        const result = await auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (result.error) throw result.error;
        setNotice(
          "If an account matches this email, a reset link will be sent.",
        );
      } else if (mode === "reset") {
        const result = await auth.updateUser({ password });
        if (result.error) throw result.error;
        setNotice("Password updated. You can sign in now.");
      } else if (mode === "register") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(form.get("name")) },
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        if (data.session) router.push("/dashboard");
        else
          setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const result = await auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function demoLogin(persona: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ access_token: string }>(
        `/demo/login?persona=${persona}`,
        { method: "POST" },
        true,
      );
      localStorage.setItem("civicfix-demo-token", result.access_token);
      router.push(persona === "resident" ? "/dashboard" : "/operations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Welcome back",
    register: "Create your account",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[mode];
  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-black">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-800"
          >
            {notice}
          </p>
        )}
        {demoMode ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Local demonstration. Reports stay in this demo database and are
              not sent to a municipality.
            </p>
            {["resident", "staff", "manager", "admin"].map((p) => (
              <Button
                disabled={busy}
                key={p}
                className="w-full capitalize"
                onClick={() => demoLogin(p)}
              >
                Continue as {p}
              </Button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                />
              </div>
            )}
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>
            )}
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
            )}
            <Button disabled={busy} className="w-full" type="submit">
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
            </Button>
          </form>
        )}
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="font-bold text-primary"
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </Link>
          {mode === "login" && !demoMode && (
            <Link href="/forgot-password" className="text-primary">
              Forgot password?
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
