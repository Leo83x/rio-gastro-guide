import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Restaurant } from '../types/restaurant';

interface MultiPinMapProps {
  experiences: Restaurant[];
  onSelectExperience: (item: Restaurant) => void;
}

const pinIcon = L.divIcon({
  className: 'borario-pin',
  html: `<div style="width:24px;height:24px;border-radius:9999px;background:#FF765E;border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(16,47,70,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;border-radius:9999px;background:#FFFFFF;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export function MultiPinMap({ experiences, onSelectExperience }: MultiPinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const valid = experiences.filter(
      (e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude) && e.latitude !== 0
    );

    const center: [number, number] =
      valid.length > 0 ? [valid[0].latitude, valid[0].longitude] : [-22.9519, -43.2105];

    const map = L.map(containerRef.current, {
      center,
      zoom: 12,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    valid.slice(0, 80).forEach((item) => {
      const marker = L.marker([item.latitude, item.longitude], { icon: pinIcon }).addTo(map);
      const container = document.createElement('div');
      container.style.minWidth = '160px';
      container.innerHTML = `
        <strong style="font-size:13px;color:#102F46;">${item.name}</strong><br/>
        <span style="font-size:11px;color:#5B6B76;">${item.category} · ${item.neighborhood}</span><br/>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Ver detalhes →';
      btn.style.marginTop = '6px';
      btn.style.padding = '4px 8px';
      btn.style.borderRadius = '8px';
      btn.style.background = '#FF765E';
      btn.style.color = '#FFFFFF';
      btn.style.fontSize = '11px';
      btn.style.fontWeight = '700';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.onclick = () => onSelectExperience(item);
      container.appendChild(btn);
      marker.bindPopup(container);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [experiences, onSelectExperience]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-2xl border border-[var(--border-hairline)] sm:h-96"
    />
  );
}
