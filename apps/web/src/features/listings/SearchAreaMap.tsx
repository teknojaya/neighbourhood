import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import type { LatLng } from '@neighbourhood/shared';
import { ActionPill } from '../../components/ui';
import { CloseIcon, MapIcon, PinIcon } from '../../components/icons';

const LeafletSearchMap = lazy(() => import('./LeafletSearchMap'));

export function SearchAreaMap({ location, radiusKm, areaLabel }: { location: LatLng; radiusKm: number; areaLabel: string }) {
  const [open, setOpen] = useState(false);
  return <section aria-label="Search area map" className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><h2 className="flex items-center gap-2 font-semibold"><MapIcon />Your search area</h2><p className="mt-1 break-words text-sm text-stone-600">{areaLabel || 'Your saved location'} · within {radiusKm} km</p></div><ActionPill type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <CloseIcon /> : <MapIcon />}{open ? 'Hide map' : 'Show map'}</ActionPill></div>
    {open ? <><Suspense fallback={<div role="status" aria-label="Loading map" className="flex h-64 animate-pulse items-center justify-center bg-stone-100 text-sm text-stone-600">Loading map…</div>}><LeafletSearchMap lat={location.lat} lng={location.lng} radiusKm={radiusKm} /></Suspense><div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 text-sm"><p className="flex items-center gap-2 text-stone-600"><PinIcon />Your saved search location</p><Link to="/profile" className="font-semibold text-brand-800 underline">Change location</Link></div></> : <p className="px-4 pb-4 text-xs leading-relaxed text-stone-600">Show your location and radius on OpenStreetMap. Loading the map shares the viewed area with its tile service; your exact location is drawn only on this device.</p>}
  </section>;
}
