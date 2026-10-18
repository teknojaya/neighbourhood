import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ListingPublicSchema, RadiusKmSchema } from '@neighbourhood/shared';
import { useMe } from '../../auth/useMe';
import { api } from '../../lib/api';
import { Alert, Button, Card, LocationRequired, ModeTabs, PageHeading, pillActionClass, Skeleton, TextField } from '../../components/ui';
import { SearchIcon, SparkIcon } from '../../components/icons';
import { SearchAreaMap } from './SearchAreaMap';
import { ListingCard } from './ListingCard';
import { CategoryFilter } from './CategoryFilter';
import { RadiusInput } from './RadiusInput';
export function ExplorePage() {
  const me = useMe(); const [params, setParams] = useSearchParams(); const [query, setQuery] = useState(params.get('query') ?? '');
  const search = params.get('query') ?? ''; const parsedRadius = RadiusKmSchema.safeParse(params.get('radius') ?? me.data?.profile.searchRadiusKm ?? 3); const radius = String(parsedRadius.success ? parsedRadius.data : 3); const mode = ['donate', 'lend'].includes(params.get('mode') ?? '') ? params.get('mode')! : ''; const category = params.get('category') ?? '';
  function filter(key: string, value: string) { setParams(old => { const next = new URLSearchParams(old); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true, preventScrollReset: true }); }
  const location = me.data?.profile.homeLocation;
  const items = useQuery({ queryKey: ['explore', location, search, radius, category, mode], enabled: Boolean(location), queryFn: ({ signal }) => { const q = new URLSearchParams({ lat: String(location!.lat), lng: String(location!.lng), radiusKm: radius, limit: '30' }); if (search) q.set('query', search); if (category) q.set('category', category); if (mode) q.set('mode', mode); return api('/api/v1/listings?' + q, { schema: z.object({ items: z.array(ListingPublicSchema), total: z.number() }), signal }); } });
  return <div className="discovery-page space-y-5"><PageHeading title="Explore">Find something useful in {me.data?.profile.areaLabel || 'your neighbourhood'}.</PageHeading>
    {location ? <SearchAreaMap location={location} radiusKm={Number(radius)} areaLabel={me.data?.profile.areaLabel ?? ''} items={items.data?.items ?? []} /> : me.isPending ? <div role="status" aria-label="Loading search area" className="h-64 animate-pulse rounded-2xl bg-stone-100"><span className="sr-only">Loading search area…</span></div> : me.data ? <LocationRequired /> : null}
    {me.isError && <Alert tone="error">Couldn’t load your profile. <Button variant="ghost" onClick={() => void me.refetch()}>Try again</Button></Alert>}
    <RadiusInput value={Number(radius)} onApply={value => filter('radius', String(value))} />
    <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); filter('query', query.trim()); }}><div className="min-w-0 flex-1"><TextField label="Find an item" placeholder="Books, a drill, a rice cooker…" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} /></div><Button className="gap-2"><SearchIcon />Search</Button></form>
    <div className="space-y-3"><div className="max-w-lg"><ModeTabs value={mode} onChange={value => filter('mode', value)} /></div><div className="flex flex-wrap items-center gap-2"><CategoryFilter value={category} onChange={value => filter('category', value)} /></div></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="text-stone-600">{items.data ? `${items.data.total} ${items.data.total === 1 ? 'item' : 'items'} nearby` : 'Nearby items'}</p><Link to="/needs" className={pillActionClass}><SparkIcon />Ask</Link></div>
    {location && items.isPending && <Skeleton grid cards={6} />}{items.isError && <Alert tone="error">{items.error.message} <Button variant="ghost" onClick={() => void items.refetch()}>Try again</Button></Alert>}{items.data?.items.length === 0 && <Card className="space-y-2"><h2 className="font-semibold">No items match yet</h2><p className="text-sm text-stone-600">Try another search or a wider radius. You can also save what you need in Ask.</p><Link className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline" to="/needs">Ask for help</Link></Card>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{items.data?.items.map(item => <ListingCard key={item.id} item={item} />)}</div><p className="text-sm text-stone-600">You arrange pickup and transport with the neighbour after approval.</p>
  </div>;
}
