'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapVehicle {
  id: string;
  plateNumber: string;
  brandModel: string;
  lat: number;
  lng: number;
  speed: number;
  status: string;
}

interface FleetMapProps {
  vehicles: MapVehicle[];
  onSelect?: (id: string) => void;
}

const PANAMA_CENTER: [number, number] = [8.983, -79.520];

function statusColor(status: string, speed: number): string {
  if (status === 'taller' || status === 'siniestrado') return '#ef4444';
  if (speed < 1) return '#f59e0b';
  return '#10b981';
}

function statusLabel(status: string, speed: number): string {
  if (status === 'taller') return 'En Taller';
  if (status === 'siniestrado') return 'Siniestrado';
  if (speed < 1) return 'Detenido';
  return 'En Ruta';
}

export default function FleetMap({ vehicles, onSelect }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: PANAMA_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map).addAttribution('OpenStreetMap');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: L.LatLngExpression[] = [];

    for (const v of vehicles) {
      const color = statusColor(v.status, v.speed);
      const label = statusLabel(v.status, v.speed);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #0A0E1A;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${color}80;cursor:pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375V4.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v8.25M18.75 14.25l-3-6h-4.5m9 4.5h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.75m0 0v4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0"/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([v.lat, v.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:700;font-size:14px;color:#111;">${v.plateNumber}</div>
            <div style="font-size:12px;color:#555;margin-top:2px;">${v.brandModel}</div>
            <div style="margin-top:8px;display:flex;gap:12px;font-size:12px;">
              <span style="color:${color};font-weight:600;">${label}</span>
              <span style="color:#888;">${v.speed.toFixed(0)} km/h</span>
            </div>
          </div>
        `, { className: 'fleet-popup' });

      marker.on('click', () => onSelect?.(v.id));
      markersRef.current.push(marker);
      bounds.push([v.lat, v.lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
  }, [vehicles, onSelect]);

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}
