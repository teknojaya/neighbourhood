import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ItemCategorySchema, ListingPublicSchema } from '@neighbourhood/shared';
import { useMe } from '../../auth/useMe';
import { api } from '../../lib/api';
import { Alert, Button, Card, TextField } from '../../components/ui';

export function ExplorePage() {
  const me = useMe(); const [params] = useSearchParams();
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [radius, setRadius] = useState(String(me.data?.profile.searchRadiusKm ?? 3));
  const [mode, setMode] = useState(params.get('mode') ?? ''); const [category, setCategory] = useState(params.get('category') ?? '');
  const location = me.data?.profile.homeLocation;
  const items = useQuery({ queryKey: ['explore', location, search, radius, category, mode], enabled: Boolean(location), queryFn: ({ signal }) => {
    const q = new URLSearchParams({ lat: String(location!.lat), lng: String(location!.lng), radiusKm: radius, limit: '30' });
    if (search) q.set('query', search); if (category) q.set('category', category); if (mode) q.set('mode', mode);
    return api('/api/v1/listings?' + q, { schema: z.object({ items: z.array(ListingPublicSchema), total: z.number() }), signal });
  } });
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Around your neighbourhood</h1><p className="text-sm text-stone-600">Useful things, shared nearby. Pickup transport is arranged by the recipient.</p>
    <Link to="/needs" className="block rounded-2xl bg-brand-700 p-4 font-semibold text-white">Describe what you need to Ask AI</Link>
    {!location && <Alert><Link className="underline" to="/profile">Set your location in Profile to discover nearby items.</Link></Alert>}
    <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); setSearch(query); }}><TextField label="Find an item" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} /><Button>Search</Button></form>
    <div className="grid grid-cols-3 gap-2 text-sm"><label>Radius<select className="mt-1 min-h-11 w-full rounded-xl border p-2" value={radius} onChange={e => setRadius(e.target.value)}>{[1,3,5,10].map(n => <option key={n} value={n}>{n} km</option>)}</select></label><label>Offering<select className="mt-1 min-h-11 w-full rounded-xl border p-2" value={mode} onChange={e => setMode(e.target.value)}><option value="">All</option><option value="donate">Donation</option><option value="lend">Lending</option></select></label><label>Category<select className="mt-1 min-h-11 w-full rounded-xl border p-2" value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{ItemCategorySchema.options.map(c => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</select></label></div>
    {items.isFetching && <p role="status">Looking nearby…</p>}{items.isError && <Alert tone="error">{items.error.message}</Alert>}{items.data?.items.length === 0 && <Card>No matching items in this area. Try a wider radius, or save your need in Ask.</Card>}
    <div className="grid grid-cols-2 gap-3">{items.data?.items.map(item => <Link key={item.id} to={'/listings/' + item.id}><Card className="h-full min-w-0 space-y-2 p-3">{item.photos[0]?.url ? <img className="aspect-square w-full rounded-xl object-cover" src={item.photos[0].url} alt="" /> : <div className="flex aspect-square items-center justify-center rounded-xl bg-brand-50 text-brand-800">{item.category.replaceAll('_', ' ')}</div>}<p className="break-words font-semibold">{item.title}</p><p className="text-xs">{item.mode === 'donate' ? 'Free to keep' : 'Borrow & return'} · {item.location.distanceKm} km</p><p className="text-xs text-stone-600">{item.location.areaLabel}</p></Card></Link>)}</div>
  </div>;
}
