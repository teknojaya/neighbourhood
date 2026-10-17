import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Skeleton } from '../../components/ui';
import { fetchMyListings } from './listingApi';

export function MyListingsPanel() {
  const location = useLocation();
  const listings = useQuery({ queryKey: ['my-listings'], queryFn: ({ signal }) => fetchMyListings(signal) });
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">My shared items</h2><Link to="/share" state={{ from: location.pathname + location.search }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Donate / Share</Link></div>
    {listings.isPending && <Skeleton />}
    {listings.isError && <Alert tone="error">{listings.error.message}</Alert>}
    {listings.data?.length === 0 && <Card>Give something useful a new home, or lend it to a neighbour.</Card>}
    <div className="grid gap-3 sm:grid-cols-2">{listings.data?.map(item => <Link key={item.id} to={`/listings/${item.id}`}><Card className="flex gap-3">
      {item.photos[0]?.url && <img className="h-16 w-16 rounded-xl object-cover" src={item.photos[0].url} alt="" />}
      <div className="min-w-0"><p className="break-words font-semibold">{item.title}</p><p className="text-sm text-stone-600">{item.mode === 'donate' ? 'Free to keep' : 'Borrow & return'} · {item.status}</p><p className="text-sm">{item.mode === 'donate' ? `${item.stock.total - item.stock.reserved - item.stock.collected} available` : 'Availability depends on dates'}</p></div>
    </Card></Link>)}</div>
  </section>;
}
