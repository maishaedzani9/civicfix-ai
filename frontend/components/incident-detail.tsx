"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  apiBase,
  token,
  readable,
  type Category,
  type Incident,
  type Me,
} from "@/lib/api";
type Activity = {
  updates: {
    id: string;
    body: string;
    visibility: string;
    created_at: string;
  }[];
  history: { status: string; created_at: string }[];
  evidence: { id: string; media_type: string; size_bytes: number }[];
};
const transitions: Record<string, string[]> = {
  submitted: ["acknowledged", "rejected"],
  acknowledged: ["assigned", "rejected"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
  rejected: [],
};
export function IncidentDetail({ id }: { id: string }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [personnel, setPersonnel] = useState<
    { id: string; name: string; department_id: string | null }[]
  >([]);
  const [assignee, setAssignee] = useState("");
  const [department, setDepartment] = useState("");
  const [target, setTarget] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const photoUrls = useRef<string[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Incident>(`/incidents/${id}`),
      api<Me>("/me"),
      api<Activity>(`/incidents/${id}/activity`),
      api<Category[]>("/categories", {}, true),
    ])
      .then(async ([report, user, events, categoryRows]) => {
        if (!active) return;
        setIncident(report);
        setMe(user);
        setActivity(events);
        setCategories(categoryRows);
        setDepartment(report.department_id || "");
        if (user.role !== "resident") {
          const depts =
            await api<{ id: string; name: string }[]>("/departments");
          if (active) setDepartments(depts);
          if (["manager", "admin"].includes(user.role)) {
            const people = await api<typeof personnel>("/personnel");
            if (active) setPersonnel(people);
          }
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const urls = photoUrls.current;
    return () => {
      urls.forEach(URL.revokeObjectURL);
    };
  }, []);
  async function refresh() {
    const [report, events] = await Promise.all([
      api<Incident>(`/incidents/${id}`),
      api<Activity>(`/incidents/${id}/activity`),
    ]);
    setIncident(report);
    setActivity(events);
    setTarget("");
  }
  async function mutate(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(`/incidents/${id}${path}`, {
        method,
        body: JSON.stringify(body),
      });
      await refresh();
      setPublicMessage("");
      setInternalNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function showPhoto(evidenceId: string) {
    try {
      const accessToken = await token();
      const response = await fetch(
        `${apiBase}/incidents/${id}/evidence/${evidenceId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error("Photo unavailable.");
      const url = URL.createObjectURL(await response.blob());
      photoUrls.current.push(url);
      setPhotos((previous) => ({ ...previous, [evidenceId]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo unavailable.");
    }
  }
  return (
    <div className="mx-auto max-w-6xl px-5 py-9">
      <Link
        href={me?.role && me.role !== "resident" ? "/operations" : "/dashboard"}
        className="text-primary"
      >
        ← Back to reports
      </Link>
      {error && (
        <p role="alert" className="my-5 rounded-xl bg-red-50 p-4 text-red-800">
          {error}{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      )}
      {!incident && !error && (
        <p role="status" className="mt-6">
          Loading report…
        </p>
      )}
      {incident && (
        <>
          <p className="mt-6 text-sm font-bold text-primary">
            {incident.reference_number}
          </p>
          <h1 className="mt-2 text-3xl font-black">{incident.title}</h1>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 capitalize">
              {readable(incident.status)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 capitalize">
              {incident.urgency} urgency
            </span>
          </div>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <section className="space-y-6">
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="text-lg font-bold">Report details</h2>
                <p className="mt-3 whitespace-pre-wrap leading-7">
                  {incident.description}
                </p>
                <p className="mt-4 text-muted-foreground">
                  {incident.address_text}
                </p>
                {incident.latitude !== null && incident.longitude !== null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${incident.latitude}&mlon=${incident.longitude}#map=16/${incident.latitude}/${incident.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-primary"
                  >
                    View map location ({incident.latitude}, {incident.longitude}
                    )
                  </a>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Submitted {new Date(incident.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="text-lg font-bold">Updates</h2>
                {!activity?.updates.length && (
                  <p className="mt-3 text-muted-foreground">No updates yet.</p>
                )}
                {activity?.updates.map((u) => (
                  <article key={u.id} className="mt-4 border-t pt-4">
                    <p className="text-xs font-bold uppercase text-primary">
                      {u.visibility} · {new Date(u.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{u.body}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="text-lg font-bold">Supporting photos</h2>
                {activity?.evidence.map((e) => (
                  <div key={e.id} className="mt-3">
                    {photos[e.id] ? (
                      <a
                        href={photos[e.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary"
                      >
                        Open photo ({Math.ceil(e.size_bytes / 1024)} KB)
                      </a>
                    ) : (
                      <Button variant="outline" onClick={() => showPhoto(e.id)}>
                        Load photo ({Math.ceil(e.size_bytes / 1024)} KB)
                      </Button>
                    )}
                  </div>
                ))}
                <Label htmlFor="extra-photo" className="mt-5 block">
                  Add photo
                </Label>
                <Input
                  id="extra-photo"
                  className="mt-2"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.set("file", file);
                    setBusy(true);
                    try {
                      await api(`/incidents/${id}/evidence`, {
                        method: "POST",
                        body: form,
                      });
                      await refresh();
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Upload failed.",
                      );
                    } finally {
                      setBusy(false);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </section>
            <aside className="space-y-6">
              <section className="rounded-2xl border bg-card p-6">
                <h2 className="text-lg font-bold">Status history</h2>
                <ol className="mt-4 space-y-4">
                  {activity?.history.map((h, index) => (
                    <li
                      key={index}
                      className="border-l-2 border-primary/30 pl-4"
                    >
                      <p className="font-semibold capitalize">
                        {readable(h.status)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
              {me?.role === "resident" && incident.status === "resolved" && (
                <form
                  className="space-y-3 rounded-2xl border bg-card p-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    mutate("/review-request", {
                      body: form.get("reason"),
                      visibility: "public",
                    });
                  }}
                >
                  <h2 className="font-bold">Issue still unresolved?</h2>
                  <Label htmlFor="review-reason">
                    Explain what needs another look
                  </Label>
                  <Textarea
                    id="review-reason"
                    name="reason"
                    minLength={8}
                    maxLength={1000}
                    required
                  />
                  <Button disabled={busy}>Request staff review</Button>
                </form>
              )}
              {me && me.role !== "resident" && (
                <section className="space-y-4 rounded-2xl border bg-card p-6">
                  <h2 className="text-lg font-bold">Manage report</h2>
                  <Label htmlFor="public-message">Public update</Label>
                  <Textarea
                    id="public-message"
                    maxLength={1000}
                    value={publicMessage}
                    onChange={(e) => setPublicMessage(e.target.value)}
                  />
                  <Label htmlFor="internal-note">
                    Internal note (staff only)
                  </Label>
                  <Textarea
                    id="internal-note"
                    maxLength={1000}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || !publicMessage.trim()}
                      variant="outline"
                      onClick={() =>
                        mutate("/updates", {
                          body: publicMessage,
                          visibility: "public",
                        })
                      }
                    >
                      Post public update
                    </Button>
                    <Button
                      disabled={busy || !internalNote.trim()}
                      variant="outline"
                      onClick={() =>
                        mutate("/updates", {
                          body: internalNote,
                          visibility: "internal",
                        })
                      }
                    >
                      Save internal note
                    </Button>
                  </div>
                  <Label htmlFor="next-status">Next status</Label>
                  <select
                    id="next-status"
                    className="w-full rounded-md border bg-background p-2"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Select next status</option>
                    {(transitions[incident.status] || [])
                      .filter((s) => s !== "assigned")
                      .map((s) => (
                        <option key={s} value={s}>
                          {readable(s)}
                        </option>
                      ))}
                  </select>
                  <Button
                    disabled={busy || !target}
                    onClick={() =>
                      mutate("/status-transitions", {
                        to_status: target,
                        public_message: publicMessage || null,
                        internal_note: internalNote || null,
                      })
                    }
                  >
                    Update status
                  </Button>
                  {["manager", "admin"].includes(me.role) && (
                    <>
                      <Label htmlFor="department">Assign department</Label>
                      <select
                        id="department"
                        className="w-full rounded-md border bg-background p-2"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      >
                        <option value="">Select department</option>
                        {departments
                          .filter(
                            (d) =>
                              me.role === "admin" || d.id === me.department_id,
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                      <Label htmlFor="assignee">Staff member (optional)</Label>
                      <select
                        id="assignee"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        className="w-full rounded-md border bg-background p-2"
                      >
                        <option value="">Department queue</option>
                        {personnel
                          .filter((p) => p.department_id === department)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <Button
                        disabled={
                          busy ||
                          !department ||
                          !["acknowledged", "assigned", "in_progress"].includes(
                            incident.status,
                          )
                        }
                        onClick={() =>
                          mutate("/assignments", {
                            department_id: department,
                            assignee_id: assignee || null,
                          })
                        }
                      >
                        Assign report
                      </Button>
                    </>
                  )}
                  <form
                    className="space-y-3 border-t pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      mutate(
                        "",
                        {
                          category_id: form.get("category"),
                          urgency: form.get("urgency"),
                          reason: form.get("reason"),
                          version: incident.version,
                        },
                        "PATCH",
                      );
                    }}
                  >
                    <h3 className="font-semibold">
                      Correct category or urgency
                    </h3>
                    <Label htmlFor="correct-category">Category</Label>
                    <select
                      key={incident.category_id}
                      id="correct-category"
                      name="category"
                      defaultValue={incident.category_id}
                      className="w-full rounded-md border bg-background p-2"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Label htmlFor="correct-urgency">Urgency</Label>
                    <select
                      key={incident.urgency}
                      id="correct-urgency"
                      name="urgency"
                      defaultValue={incident.urgency}
                      className="w-full rounded-md border bg-background p-2"
                    >
                      {["low", "medium", "high", "critical"].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                    <Label htmlFor="correction-reason">Reason</Label>
                    <Input
                      id="correction-reason"
                      name="reason"
                      required
                      minLength={8}
                      maxLength={1000}
                    />
                    <Button disabled={busy}>Save correction</Button>
                  </form>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
