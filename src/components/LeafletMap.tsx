import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

const customPinIcon = L.divIcon({
  className: 'rio-gastro-pin',
  html: `<div style="width:28px;height:28px;border-radius:9999px;background:#E05A47;border:3px solid #FFFFFF;box-shadow:0 4px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;border-radius:9999px;background:#FFFFFF;"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function LeafletMap({ latitude, longitude, name, address }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { icon: customPinIcon }).addTo(map);
    marker.bindPopup(`<strong>${name}</strong><br/><span style="font-size:12px;">${address}</span>`).openPopup();

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, name, address]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-2xl border border-[var(--border-hairline)]"
    />
  );
}
