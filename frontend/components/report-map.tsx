"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Incident } from "@/lib/api";
import "leaflet/dist/leaflet.css";
export function ReportMap({ reports }: { reports: Incident[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<LayerGroup | null>(null);
  useEffect(() => {
    let active = true;
    import("leaflet").then((L) => {
      if (!active || !container.current) return;
      if (!map.current) {
        map.current = L.map(container.current).setView([-28.48, 24.67], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map.current);
        layers.current = L.layerGroup().addTo(map.current);
      }
      layers.current?.clearLayers();
      const points: [number, number][] = [];
      for (const r of reports) {
        if (r.latitude === null || r.longitude === null) continue;
        points.push([r.latitude, r.longitude]);
        const content = document.createElement("a");
        content.textContent = r.reference_number + " · " + r.title;
        content.href = "/incidents/" + r.id;
        L.circleMarker([r.latitude, r.longitude], {
          radius: 8,
          color: r.urgency === "critical" ? "#dc2626" : "#0891b2",
        })
          .bindPopup(content)
          .addTo(layers.current!);
      }
      if (points.length)
        map.current.fitBounds(points, { padding: [25, 25], maxZoom: 15 });
    });
    return () => {
      active = false;
    };
  }, [reports]);
  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );
  return (
    <section className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="font-bold">Report locations</h2>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        Only reports with confirmed coordinates appear here. The report list
        includes every loaded report.
      </p>
      <div
        ref={container}
        className="relative z-0 h-80 rounded-xl"
        aria-label="Map of report locations"
      />
    </section>
  );
}
