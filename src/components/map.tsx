"use client";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

export type MapPoint = { lat: number; lng: number; label: string; order?: number };

const icon = (order?: number) =>
  L.divIcon({
    className: "",
    html: `<div style="background:#0e7490;color:#fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font:600 12px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px #0006">${order ?? "•"}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 11);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30] });
  }, [map, points]);
  return null;
}

export default function Map({ points, line = false, height = 360 }: { points: MapPoint[]; line?: boolean; height?: number }) {
  return (
    <MapContainer center={[16, 106]} zoom={5} style={{ height, width: "100%" }} className="rounded-xl border">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={icon(p.order)}>
          <Popup>{p.label}</Popup>
        </Marker>
      ))}
      {line && points.length > 1 && <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#0891b2", weight: 3, dashArray: "6" }} />}
      <Fit points={points} />
    </MapContainer>
  );
}
