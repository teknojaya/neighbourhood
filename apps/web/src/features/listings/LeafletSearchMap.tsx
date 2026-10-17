import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ListingPublic } from '@neighbourhood/shared';
import { Alert, Button } from '../../components/ui';

export default function LeafletSearchMap({ lat, lng, radiusKm, items }: { lat: number; lng: number; radiusKm: number; items: ListingPublic[] }) {
  const container = useRef<HTMLDivElement>(null); const fit = useRef<() => void>(() => undefined);
  const instance = useRef<L.Map | null>(null);
  const [tiles, setTiles] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    setTiles('loading');
    const center: L.LatLngTuple = [lat, lng];
    // Paths need an initialized view before their geographic bounds can be read.
    const map = L.map(container.current, { center, zoom: 13, scrollWheelZoom: false, zoomControl: true, dragging: true, attributionControl: true });
    instance.current = map;
    const circle = L.circle(center, { radius: radiusKm * 1000, color: '#0f766e', weight: 2, fillColor: '#0f766e', fillOpacity: 0.12, interactive: false }).addTo(map);
    L.circleMarker(center, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#0f766e', fillOpacity: 1, interactive: false }).addTo(map);
    fit.current = () => { map.invalidateSize(); map.fitBounds(circle.getBounds(), { padding: [20, 20], maxZoom: 14, animate: false }); };
    fit.current();
    let loaded = 0; let failed = 0; let disposed = false;
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 3, updateWhenIdle: true, keepBuffer: 0,
      // Send the app origin for tile-service identification, never private route/query data.
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    layer.on('tileload', () => { loaded++; });
    layer.on('tileerror', () => { failed++; });
    layer.on('load', () => { if (!disposed) setTiles(loaded > 0 && failed === 0 ? 'ready' : 'failed'); });
    layer.addTo(map);
    const timeout = window.setTimeout(() => { if (!disposed && loaded === 0) setTiles('failed'); }, 12000);
    const observer = new ResizeObserver(() => fit.current()); observer.observe(container.current);
    return () => { disposed = true; window.clearTimeout(timeout); observer.disconnect(); fit.current = () => undefined; instance.current = null; map.remove(); };
  }, [lat, lng, radiusKm, attempt]);
  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const groups = new Map<string, ListingPublic[]>();
    for (const item of items) { const key = `${item.location.approxLat},${item.location.approxLng}`; groups.set(key, [...(groups.get(key) ?? []), item]); }
    groups.forEach(group => {
      const item = group[0]!;
      const label = `${group.length} ${group.length === 1 ? 'item' : 'items'} near ${item.location.areaLabel} · approximate area`;
      const popup = document.createElement('div');
      const description = document.createElement('p'); description.textContent = 'Approximate area, not the pickup address.'; popup.append(description);
      for (const product of group) {
        const link = document.createElement('a'); link.href = '/listings/' + product.id; link.textContent = `${product.title}${product.location.distanceKm !== undefined ? ` · about ${product.location.distanceKm} km` : ''}`; link.className = 'block py-2 font-semibold text-brand-800 underline'; popup.append(link);
      }
      L.marker([item.location.approxLat, item.location.approxLng], { keyboard: true, riseOnHover: true, title: label, alt: label,
        icon: L.divIcon({ className: 'product-map-pin', html: `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 2C10 2 2 10 2 20c0 12 18 26 18 26s18-14 18-26C38 10 30 2 20 2Z" fill="currentColor" stroke="white" stroke-width="2.5"/><circle cx="20" cy="19" r="11" fill="white"/><text x="20" y="23.5" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700">${group.length}</text></svg>`, iconSize: [36, 44], iconAnchor: [18, 42], popupAnchor: [0, -38] }),
      }).addTo(layer).bindPopup(popup, { maxHeight: 180, minWidth: 200 });
    });
    return () => { layer.remove(); };
  }, [items, lat, lng, radiusKm, attempt]);
  return <div>
    {tiles === 'failed' && <div className="px-4 pb-3"><Alert tone="warning">Map tiles couldn’t load. Item search still works. <Button type="button" variant="ghost" onClick={() => setAttempt(attempt + 1)}>Retry map</Button></Alert></div>}
    <div className="relative isolate"><div ref={container} className="search-map h-64 w-full bg-stone-100 sm:h-72" role="region" tabIndex={0} aria-label={`Map of your saved location with a ${radiusKm} kilometre search radius`} />{tiles === 'loading' && <div role="status" aria-label="Loading map tiles" className="pointer-events-none absolute inset-0 z-[1000] flex animate-pulse items-center justify-center bg-stone-100 text-sm text-stone-600">Loading map…</div>}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2"><p className="text-sm text-brand-800">Circle: {radiusKm} km from your saved location</p><Button type="button" variant="ghost" onClick={() => fit.current()}>Fit radius</Button></div>
  </div>;
}
