"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportMap } from "@/components/report-map";
import { Input } from "@/components/ui/input";
import {
  api,
  apiBase,
  token,
  readable,
  type Incident,
  type IncidentPage,
  type Me,
} from "@/lib/api";
export function ReportDashboard({
  operations = false,
}: {
  operations?: boolean;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [reports, setReports] = useState<Incident[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    overdue: number;
    by_status: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const user = await api<Me>("/me");
        if (!active) return;
        setMe(user);
        if (operations && user.role === "resident")
          throw new Error("Staff access required.");
        const page = await api<IncidentPage>("/incidents?limit=100");
        if (!active) return;
        setReports(page.items);
        setCursor(page.next_cursor);
        if (operations) {
          const counts = await api<typeof summary>("/analytics/summary");
          if (active) setSummary(counts);
        }
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Reports unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [operations]);
  async function more() {
    setLoading(true);
    try {
      const page = await api<IncidentPage>(
        `/incidents?limit=100&cursor=${encodeURIComponent(cursor || "")}`,
      );
      setReports((previous) => [...previous, ...page.items]);
      setCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loading failed.");
    } finally {
      setLoading(false);
    }
  }
  async function exportCSV() {
    try {
      const accessToken = await token();
      const response = await fetch(apiBase + "/exports/incidents.csv", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Export failed.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "civicfix-reports.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }
  const filtered = reports.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.title} ${r.reference_number} ${r.address_text}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-7xl px-5 py-9">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">
            {operations ? "Operations dashboard" : "Resident dashboard"}
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {operations
              ? "Community report queue"
              : `Welcome${me ? ", " + me.display_name : ""}`}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {operations
              ? "Triage, assign and resolve reports in your authorised scope."
              : "Track your submitted reports and updates."}
          </p>
        </div>
        <div className="flex gap-3">
          {operations && me?.role !== "resident" && (
            <Button variant="outline" onClick={exportCSV}>
              Export CSV
            </Button>
          )}
          {me && me.role !== "resident" && (
            <Button asChild variant="outline">
              <Link href={operations ? "/dashboard" : "/operations"}>
                {operations ? "Reports" : "Operations"}
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/report">New report</Link>
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">
          {error}{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      )}
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          ["Reports", summary?.total ?? reports.length],
          [
            "Active",
            reports.filter(
              (r) => !["resolved", "closed", "rejected"].includes(r.status),
            ).length,
          ],
          [
            operations ? "Overdue target" : "Resolved",
            operations
              ? (summary?.overdue ?? 0)
              : reports.filter((r) => ["resolved", "closed"].includes(r.status))
                  .length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card p-5">
            <p className="text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>
      {operations && me && me.role !== "resident" && (
        <ReportMap reports={filtered} />
      )}
      <section className="mt-7 rounded-2xl border bg-card">
        <div className="flex flex-wrap gap-3 border-b p-5">
          <Input
            aria-label="Search reports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, issue or location"
            className="max-w-md"
          />
          <select
            aria-label="Filter by status"
            className="rounded-md border bg-background px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "submitted",
              "acknowledged",
              "assigned",
              "in_progress",
              "resolved",
              "closed",
              "rejected",
            ].map((s) => (
              <option key={s} value={s}>
                {readable(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="divide-y">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/incidents/${r.id}`}
              className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted"
            >
              <div>
                <p className="text-xs font-semibold text-primary">
                  {r.reference_number}
                </p>
                <h2 className="mt-1 font-bold">{r.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.address_text || "Map location"} ·{" "}
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm capitalize text-primary">
                  {readable(r.status)}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-sm capitalize">
                  {r.urgency}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {loading && (
          <p role="status" className="p-5">
            Loading reports…
          </p>
        )}
        {!loading && !filtered.length && !error && (
          <p className="p-6 text-muted-foreground">
            {reports.length
              ? "No reports match this filter."
              : "No reports yet. Create a report to get started."}
          </p>
        )}
        {cursor && (
          <Button onClick={more} disabled={loading} className="m-5">
            Load more reports
          </Button>
        )}
      </section>
      <p className="mt-4 text-xs text-muted-foreground">
        {cursor
          ? "Counts and filters cover loaded reports; load more to include older entries. "
          : ""}
        {operations
          ? "Response targets: 24 hours for high/critical urgency, 72 hours otherwise. These are portfolio targets, not municipal commitments."
          : ""}
      </p>
    </div>
  );
}
