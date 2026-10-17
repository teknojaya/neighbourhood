import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { MAX_RADIUS_KM, type AskPart, type ListingPublic } from '@neighbourhood/shared';
import { ActionPill } from '../../components/ui';
import { SaveItemButton } from '../listings/SaveItemButton';

type SearchPart = Extract<AskPart, { kind: 'listings' }>;
export function SearchListingCard({ part, onReply, active = true, radiusAnswered = false }: { part: SearchPart; onReply(text: string): void; active?: boolean; radiusAnswered?: boolean }) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => { if (!active) setExpanded(false); }, [active]);
  const scope = part.search;
  const checked = scope?.broaderRadiusKm ?? scope?.radiusKm;
  const count = part.items.length + (scope?.fartherItems.length ?? 0);
  return <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="rounded-2xl border border-stone-200 bg-white p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{scope ? `Items within ${scope.radiusKm} km` : 'Items'} · {count} {count === 1 ? 'result' : 'results'}</summary><div className="space-y-3 pt-2">
    {part.items.length === 0 && <p className="text-sm">{scope ? `No eligible matching listings within ${scope.radiusKm} km at this time.` : 'No matching items found.'}</p>}
    {part.items.map(item => <SearchItem key={item.id} item={item} />)}
    {scope && scope.fartherItems.length > 0 && <div className="space-y-2 border-t border-stone-200 pt-3"><h4 className="font-semibold">Farther away · outside {scope.radiusKm} km</h4><p className="text-sm text-stone-600">These matches were found in a wider check up to {scope.broaderRadiusKm} km. Would you travel farther?</p>{scope.fartherItems.map(item => <SearchItem key={item.id} item={item} />)}</div>}
    {scope && scope.broaderRadiusKm && scope.fartherItems.length === 0 && <p className="text-sm text-stone-600">The wider check also found no eligible matching listings within {checked} km. Changing the distance may still return nothing. You can try another item name or save this need.</p>}
    {scope && active && !radiusAnswered && <div className="space-y-2 border-t border-stone-200 pt-3"><p className="text-sm font-semibold">How far would you like to search?</p><div className="flex flex-wrap gap-2">{[3,5,10,25,MAX_RADIUS_KM].filter(radius => radius !== scope.radiusKm).map(radius => <ActionPill key={radius} type="button" onClick={() => onReply(`Search within ${radius} km${scope.query ? ` for ${scope.query}` : ''}${scope.category ? `, category ${scope.category}` : ''}${scope.mode ? `, ${scope.mode === 'donate' ? 'free donations' : 'borrowing'}` : ''}.`)}>{radius} km</ActionPill>)}</div></div>}
  </div></details>;
}
function SearchItem({ item }: { item: ListingPublic }) {
  const [broken, setBroken] = useState<string | null>(null); const photo = item.photos[0]?.url;
  return <div className="flex items-start gap-2 border-b border-stone-100 py-3"><Link to={'/listings/' + item.id} className="flex min-h-16 min-w-0 flex-1 gap-3">{photo && photo !== broken && <img className="h-16 w-16 shrink-0 rounded-xl object-cover" src={photo} alt="" onError={() => setBroken(photo)} />}<div className="min-w-0"><strong className="break-words">{item.title}</strong><p className="text-sm">{item.mode === 'donate' ? `Free to keep · ${item.stock.total - item.stock.reserved - item.stock.collected} available` : 'Borrow & return · choose dates'}</p><p className="text-sm text-stone-600">{item.location.areaLabel}{item.location.distanceKm !== undefined ? ` · about ${item.location.distanceKm} km` : ''}</p></div></Link><SaveItemButton id={item.id} title={item.title} compact /></div>;
}
