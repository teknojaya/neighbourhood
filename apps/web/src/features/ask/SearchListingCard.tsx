import { Link } from 'react-router';
import { MAX_RADIUS_KM, type AskPart, type ListingPublic } from '@neighbourhood/shared';
import { ActionPill, Card } from '../../components/ui';

type SearchPart = Extract<AskPart, { kind: 'listings' }>;
export function SearchListingCard({ part, onReply }: { part: SearchPart; onReply(text: string): void }) {
  const scope = part.search;
  const checked = scope?.broaderRadiusKm ?? scope?.radiusKm;
  return <Card className="space-y-3"><h3 className="font-semibold">{scope ? `Items within ${scope.radiusKm} km` : 'Items'}</h3>
    {part.items.length === 0 && <p className="text-sm">{scope ? `No eligible matching listings within ${scope.radiusKm} km at this time.` : 'No matching items found.'}</p>}
    {part.items.map(item => <SearchItem key={item.id} item={item} />)}
    {scope && scope.fartherItems.length > 0 && <div className="space-y-2 border-t border-stone-200 pt-3"><h4 className="font-semibold">Farther away · outside {scope.radiusKm} km</h4><p className="text-sm text-stone-600">These matches were found in a wider check up to {scope.broaderRadiusKm} km. Would you travel farther?</p>{scope.fartherItems.map(item => <SearchItem key={item.id} item={item} />)}</div>}
    {scope && scope.broaderRadiusKm && scope.fartherItems.length === 0 && <p className="text-sm text-stone-600">The wider check also found no eligible matching listings within {checked} km. Changing the distance may still return nothing. You can try another item name or save this need.</p>}
    {scope && <div className="space-y-2 border-t border-stone-200 pt-3"><p className="text-sm font-semibold">How far would you like to search?</p><p className="text-xs text-stone-600">Choose a distance to draft a reply, or type your own (1–50 km).</p><div className="flex flex-wrap gap-2">{[3,5,10,25,MAX_RADIUS_KM].filter(radius => radius !== scope.radiusKm).map(radius => <ActionPill key={radius} type="button" onClick={() => onReply(`Search within ${radius} km${scope.query ? ` for ${scope.query}` : ''}${scope.category ? `, category ${scope.category}` : ''}${scope.mode ? `, ${scope.mode === 'donate' ? 'free donations' : 'borrowing'}` : ''}.`)}>{radius} km</ActionPill>)}</div></div>}
  </Card>;
}
function SearchItem({ item }: { item: ListingPublic }) {
  return <Link to={'/listings/' + item.id} className="flex min-h-16 gap-3 border-b border-stone-100 py-3">{item.photos[0]?.url && <img className="h-16 w-16 rounded-xl object-cover" src={item.photos[0].url} alt="" />}<div className="min-w-0"><strong className="break-words">{item.title}</strong><p className="text-sm">{item.mode === 'donate' ? `Free to keep · ${item.stock.total - item.stock.reserved - item.stock.collected} available` : 'Borrow & return · choose dates'}</p><p className="text-sm text-stone-600">{item.location.areaLabel}{item.location.distanceKm !== undefined ? ` · about ${item.location.distanceKm} km` : ''}</p></div></Link>;
}
