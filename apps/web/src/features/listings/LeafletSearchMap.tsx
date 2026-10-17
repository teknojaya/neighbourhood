import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Alert, Button } from '../../components/ui';

export default function LeafletSearchMap({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const container = useRef<HTMLDivElement>(null); const fit = useRef<() => void>(() => undefined);
  const [tiles, setTiles] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    setTiles('loading');
    const center: L.LatLngTuple = [lat, lng];
    // Paths need an initialized view before their geographic bounds can be read.
    const map = L.map(container.current, { center, zoom: 13, scrollWheelZoom: false, zoomControl: true, dragging: true, attributionControl: true });
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
    return () => { disposed = true; window.clearTimeout(timeout); observer.disconnect(); fit.current = () => undefined; map.remove(); };
  }, [lat, lng, radiusKm, attempt]);
  return <div>
    {tiles === 'failed' && <div className="px-4 pb-3"><Alert tone="warning">Map tiles couldn’t load. Item search still works. <Button type="button" variant="ghost" onClick={() => setAttempt(attempt + 1)}>Retry map</Button></Alert></div>}
    <div className="relative isolate"><div ref={container} className="search-map h-64 w-full bg-stone-100 sm:h-72" role="region" tabIndex={0} aria-label={`Map of your saved location with a ${radiusKm} kilometre search radius`} />{tiles === 'loading' && <div role="status" aria-label="Loading map tiles" className="pointer-events-none absolute inset-0 z-[1000] flex animate-pulse items-center justify-center bg-stone-100 text-sm text-stone-600">Loading map…</div>}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2"><p className="text-sm text-brand-800">Circle: {radiusKm} km from your saved location</p><Button type="button" variant="ghost" onClick={() => fit.current()}>Fit radius</Button></div>
  </div>;
}
