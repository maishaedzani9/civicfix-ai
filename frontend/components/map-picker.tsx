"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
export function MapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  const coordinates = useRef({ latitude, longitude });
  const map = useRef<LeafletMap | null>(null);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      const m = L.map(container.current).setView([-28.48, 24.67], 5);
      map.current = m;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);
      const marker = L.circleMarker([0, 0], { radius: 9, color: "#0891b2" });
      const initial = coordinates.current;
      if (initial.latitude !== null && initial.longitude !== null) {
        marker.setLatLng([initial.latitude, initial.longitude]).addTo(m);
        m.setView([initial.latitude, initial.longitude], 14);
      }
      m.on("click", (event) => {
        marker.setLatLng(event.latlng).addTo(m);
        callback.current(event.latlng.lat, event.latlng.lng);
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        Click the map to select the issue location. You can also enter
        coordinates below.
      </p>
      <div
        ref={container}
        className="relative z-0 h-64 rounded-xl border"
        aria-label="Select report location on map"
      />
    </div>
  );
}
