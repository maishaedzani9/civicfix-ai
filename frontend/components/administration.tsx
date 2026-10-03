"use client";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function Administration() {
  const [me, setMe] = useState<Me | null>(null);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [audit, setAudit] = useState<
    { action: string; entity_id: string; created_at: string }[]
  >([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Me>("/me")
      .then(async (user) => {
        setMe(user);
        if (user.role !== "admin")
          throw new Error("Administrator access required.");
        const [rows, events] = await Promise.all([
          api<typeof departments>("/departments"),
          api<typeof audit>("/audit"),
        ]);
        setDepartments(rows);
        setAudit(events);
      })
      .catch((err) => setError(err.message));
  }, []);
  async function save(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setNotice("Change saved.");
      const [rows, events] = await Promise.all([
        api<typeof departments>("/departments"),
        api<typeof audit>("/audit"),
      ]);
      setDepartments(rows);
      setAudit(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  function departmentOptions() {
    return (
      <>
        <option value="">No department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-5 py-9">
      <h1 className="text-3xl font-black">Administration</h1>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-emerald-700">
          {notice}
        </p>
      )}
      {me?.role === "admin" && (
        <>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <form
              className="space-y-3 rounded-2xl border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save("/admin/departments", {
                  name: f.get("name"),
                  slug: f.get("slug"),
                });
              }}
            >
              <h2 className="font-bold">Add department</h2>
              <Label htmlFor="department-name">Name</Label>
              <Input
                id="department-name"
                name="name"
                minLength={2}
                maxLength={120}
                required
              />
              <Label htmlFor="department-slug">Slug (hyphens)</Label>
              <Input
                id="department-slug"
                name="slug"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
              <Button disabled={busy}>Add department</Button>
            </form>
            <form
              className="space-y-3 rounded-2xl border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save("/admin/categories", {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  department_id: f.get("department") || null,
                });
              }}
            >
              <h2 className="font-bold">Add reporting category</h2>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                name="name"
                minLength={2}
                maxLength={100}
                required
              />
              <Label htmlFor="category-slug">Slug (underscores)</Label>
              <Input
                id="category-slug"
                name="slug"
                pattern="[a-z0-9]+(_[a-z0-9]+)*"
                required
              />
              <Label htmlFor="category-department">Route to department</Label>
              <select
                id="category-department"
                name="department"
                className="w-full rounded-md border bg-background p-2"
              >
                {departmentOptions()}
              </select>
              <Button disabled={busy}>Add category</Button>
            </form>
            <form
              className="space-y-3 rounded-2xl border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save(
                  "/admin/profiles/" + f.get("id"),
                  {
                    role: f.get("role"),
                    department_id: f.get("department") || null,
                  },
                  "PATCH",
                );
              }}
            >
              <h2 className="font-bold">Set account privileges</h2>
              <Label htmlFor="profile-id">Registered user UUID</Label>
              <Input id="profile-id" name="id" required />
              <Label htmlFor="profile-role">Role</Label>
              <select
                id="profile-role"
                name="role"
                className="w-full rounded-md border bg-background p-2"
              >
                {["resident", "staff", "manager", "admin"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Label htmlFor="profile-department">Department</Label>
              <select
                id="profile-department"
                name="department"
                className="w-full rounded-md border bg-background p-2"
              >
                {departmentOptions()}
              </select>
              <Button disabled={busy}>Update privileges</Button>
            </form>
          </div>
          <section className="mt-6 rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Latest audit events</h2>
            <div className="mt-4 divide-y">
              {audit.map((event, index) => (
                <article className="py-3" key={index}>
                  <p className="font-semibold">{event.action}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {event.entity_id} ·{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </article>
              ))}
              {!audit.length && <p>No events yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
