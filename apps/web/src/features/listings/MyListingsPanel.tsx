import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card } from '../../components/ui';
import { fetchMyListings } from './listingApi';
import { ListingFormModal } from './ListingFormModal';

export function MyListingsPanel() {
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const listings = useQuery({ queryKey: ['my-listings'], queryFn: ({ signal }) => fetchMyListings(signal) });
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">My shared items</h2><Button onClick={() => setCreating(true)}>Share an item</Button></div>
    {listings.isPending && <p role="status">Loading items…</p>}
    {listings.isError && <Alert tone="error">{listings.error.message}</Alert>}
    {listings.data?.length === 0 && <Card>Give something useful a new home, or lend it to a neighbour.</Card>}
    <div className="grid gap-3 sm:grid-cols-2">{listings.data?.map(item => <Link key={item.id} to={`/listings/${item.id}`}><Card className="flex gap-3">
      {item.photos[0]?.url && <img className="h-16 w-16 rounded-xl object-cover" src={item.photos[0].url} alt="" />}
      <div className="min-w-0"><p className="break-words font-semibold">{item.title}</p><p className="text-sm text-stone-600">{item.mode} · {item.status}</p><p className="text-sm">{item.stock.total - item.stock.reserved - item.stock.collected} available</p></div>
    </Card></Link>)}</div>
    {creating && <ListingFormModal onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); void qc.invalidateQueries({ queryKey: ['my-listings'] }); }} />}
  </section>;
}
