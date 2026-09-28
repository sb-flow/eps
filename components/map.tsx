"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Project } from "@/lib/types";
let initialized = false;
export function ProjectMap({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (!key || !ref.current) return;
    let disposed = false;
    let cluster: MarkerClusterer | undefined;
    let markers: google.maps.Marker[] = [];
    if (!initialized) {
      setOptions({ key, v: "quarterly" });
      initialized = true;
    }
    (async () => {
      const { MarkerClusterer } = await import("@googlemaps/markerclusterer");
      await importLibrary("maps");
      if (disposed || !ref.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat: 41.25, lng: 64.6 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
      });
      const bounds = new google.maps.LatLngBounds();
      markers = projects
        .filter((p) => p.lat !== null && p.lng !== null)
        .map((p) => {
          const position = { lat: p.lat!, lng: p.lng! };
          bounds.extend(position);
          const marker = new google.maps.Marker({ position, title: p.name });
          marker.addListener("click", () => {
            router.push(`/projects/${encodeURIComponent(p.id)}`);
          });
          return marker;
        });
      cluster = new MarkerClusterer({ map, markers });
      if (markers.length) map.fitBounds(bounds);
    })().catch(() =>
      setError("Карта не загрузилась. Проверьте ключ и ограничения домена."),
    );
    return () => {
      disposed = true;
      cluster?.clearMarkers();
      markers.forEach((m) => google.maps.event.clearInstanceListeners(m));
    };
  }, [projects, key, router]);
  if (!key)
    return (
      <div className="panel empty">
        Для карты настройте NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        <p>
          {projects.filter((p) => p.lat !== null && p.lng !== null).length}{" "}
          объектов с сохранёнными координатами.
        </p>
      </div>
    );
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div ref={ref} className="map" aria-label="Карта объектов" />
    </>
  );
}
