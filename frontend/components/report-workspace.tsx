"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPicker } from "@/components/map-picker";
import { api, demoMode, type Category, type Incident } from "@/lib/api";

type Draft = {
  category: string;
  urgency: string;
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
};
const empty: Draft = {
  category: "",
  urgency: "medium",
  title: "",
  description: "",
  location: "",
  latitude: null,
  longitude: null,
};
const draftKey = "civicfix-report-draft";
export function ReportWorkspace() {
  const storageKey = useRef(draftKey);
  const submissionKey = useRef<string | null>(null);
  const triageSession = useRef<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState<Incident | null>(null);
  const [photoError, setPhotoError] = useState("");
  useEffect(() => {
    api<Category[]>("/categories", {}, true)
      .then(setCategories)
      .catch((err) => setError(err.message));
    api<{ id: string }>("/me")
      .then((user) => {
        storageKey.current = draftKey + "-" + user.id;
        const saved = sessionStorage.getItem(storageKey.current);
        if (saved) {
          try {
            setDraft({ ...empty, ...JSON.parse(saved) });
          } catch {
            sessionStorage.removeItem(storageKey.current);
          }
        }
      })
      .catch((err) => setError(err.message));
  }, []);
  function change(next: Partial<Draft>) {
    submissionKey.current = null;
    setDraft((previous) => {
      const value = { ...previous, ...next };
      sessionStorage.setItem(storageKey.current, JSON.stringify(value));
      return value;
    });
    setConfirmed(false);
  }
  async function suggest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!triageSession.current) {
        const session = await api<{ id: string }>("/triage/sessions", {
          method: "POST",
        });
        triageSession.current = session.id;
      }
      const result = await api<{
        draft: {
          category: string;
          suggested_urgency: string;
          title: string;
          description: string;
          address_text: string | null;
          follow_up: string;
          immediate_danger: boolean;
          urgency_reason: string;
          confidence: number;
        };
        notice: string;
      }>(`/triage/sessions/${triageSession.current}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      change({
        category: result.draft.category,
        urgency: result.draft.suggested_urgency,
        title: result.draft.title,
        description: result.draft.description,
        location: result.draft.address_text || draft.location,
      });
      setNotice(
        result.notice +
          " " +
          result.draft.urgency_reason +
          " " +
          result.draft.follow_up,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed.");
    } finally {
      setBusy(false);
    }
  }
  async function uploadPhoto(incident: Incident) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    await api(`/incidents/${incident.id}/evidence`, {
      method: "POST",
      body: form,
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const category = categories.find((c) => c.slug === draft.category);
      if (!category) throw new Error("Select a category.");
      if (triageSession.current)
        await api(`/triage/sessions/${triageSession.current}/confirm`, {
          method: "POST",
        });
      submissionKey.current ??= crypto.randomUUID();
      const incident = await api<Incident>("/incidents", {
        method: "POST",
        headers: { "Idempotency-Key": submissionKey.current },
        body: JSON.stringify({
          ai_triage_id: triageSession.current,
          category_id: category.id,
          title: draft.title,
          description: draft.description,
          urgency: draft.urgency,
          address_text: draft.location || null,
          latitude: draft.latitude,
          longitude: draft.longitude,
        }),
      });
      setSubmitted(incident);
      sessionStorage.removeItem(storageKey.current);
      try {
        await uploadPhoto(incident);
      } catch (err) {
        setPhotoError(
          err instanceof Error ? err.message : "Photo upload failed.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  if (submitted)
    return (
      <section className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-4 text-3xl font-black">Report saved</h1>
        <p className="mt-3">
          Reference <strong>{submitted.reference_number}</strong>
        </p>
        <p className="mt-3 text-muted-foreground">
          {demoMode
            ? "Saved in the local demo. No municipal report was sent."
            : "Your report is saved in CivicFix. Track updates below."}
        </p>
        {photoError && (
          <div role="alert" className="mt-4 text-red-700">
            <p>{photoError}</p>
            <Button
              disabled={busy}
              className="mt-2"
              onClick={async () => {
                setBusy(true);
                try {
                  await uploadPhoto(submitted);
                  setPhotoError("");
                } catch (err) {
                  setPhotoError(
                    err instanceof Error ? err.message : "Upload failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry photo upload
            </Button>
          </div>
        )}
        <Button asChild className="mt-6">
          <Link href={`/incidents/${submitted.id}`}>Track this report</Link>
        </Button>
      </section>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-3xl bg-[#071827] p-6 text-white">
        <Bot className="size-8 text-cyan-300" />
        <h2 className="mt-3 text-xl font-bold">CivicFix Assistant</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Describe the infrastructure problem. Suggestions stay editable until
          you confirm.
        </p>
        <form onSubmit={suggest} className="mt-5 space-y-3">
          <Label htmlFor="chat-message">What happened?</Label>
          <Textarea
            id="chat-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={20}
            maxLength={4000}
            className="min-h-40 bg-white text-slate-900"
            placeholder="Water is leaking into the road near…"
          />
          <Button
            disabled={busy}
            className="bg-cyan-300 text-slate-900 hover:bg-cyan-200"
          >
            <Send />
            {busy ? "Please wait…" : "Prepare draft"}
          </Button>
        </form>
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-white/10 p-4 text-sm leading-6"
          >
            {notice}
          </p>
        )}
        <p className="mt-6 text-sm text-slate-300">
          CivicFix is a portfolio reporting platform, not an emergency
          dispatcher. Contact the relevant emergency service if anyone is in
          immediate danger.
        </p>
      </section>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border bg-card p-6"
      >
        <h2 className="text-2xl font-black">Review your report</h2>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
            {error}{" "}
            <Link className="underline" href="/login">
              Sign in
            </Link>
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            required
            value={draft.category}
            onChange={(e) => change({ category: e.target.value })}
            className="h-11 w-full rounded-md border bg-background px-3"
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Short title</Label>
          <Input
            id="title"
            required
            minLength={8}
            maxLength={140}
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            required
            minLength={20}
            maxLength={4000}
            value={draft.description}
            onChange={(e) => change({ description: e.target.value })}
            className="min-h-28"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="urgency">Suggested urgency</Label>
          <select
            id="urgency"
            className="h-11 w-full rounded-md border bg-background px-3"
            value={draft.urgency}
            onChange={(e) => change({ urgency: e.target.value })}
          >
            {["low", "medium", "high", "critical"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Address or landmark</Label>
          <Input
            id="location"
            maxLength={500}
            required={draft.latitude === null}
            value={draft.location}
            onChange={(e) => change({ location: e.target.value })}
          />
        </div>
        <MapPicker
          latitude={draft.latitude}
          longitude={draft.longitude}
          onChange={(latitude, longitude) => change({ latitude, longitude })}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              value={draft.latitude ?? ""}
              onChange={(e) =>
                change({
                  latitude:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              value={draft.longitude ?? ""}
              onChange={(e) =>
                change({
                  longitude:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="photo">Supporting photo (optional)</Label>
          <Input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const selected = e.target.files?.[0] || null;
              if (selected && selected.size > 10485760) {
                setError("Photo must be under 10 MB.");
                e.target.value = "";
                setFile(null);
              } else {
                setFile(selected);
                setError("");
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP, maximum 10 MB / 20 megapixels. Avoid faces and
            private information. Embedded location metadata is removed.
          </p>
          {file && <p className="text-sm">Selected: {file.name}</p>}
        </div>
        <Label className="flex items-start gap-3 leading-6">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            required
            className="mt-1"
          />
          I have reviewed the category, urgency, description and location and
          confirm this report is accurate.
        </Label>
        <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <Button asChild variant="ghost">
            <Link href="/dashboard">Save draft and exit</Link>
          </Button>
          <Button disabled={busy || !confirmed}>Confirm and submit</Button>
        </div>
      </form>
    </div>
  );
}
