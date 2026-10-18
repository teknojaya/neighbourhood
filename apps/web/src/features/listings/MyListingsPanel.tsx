import { ActivityItem, ActivityStatus } from '../activity/ActivityItem';
import { GiftIcon, PlusIcon } from '../../components/icons';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Skeleton } from '../../components/ui';
import { fetchMyListings } from './listingApi';

export function MyListingsPanel() {
  const location = useLocation();
  const listings = useQuery({ queryKey: ['my-listings'], queryFn: ({ signal }) => fetchMyListings(signal) });
  return <section className="space-y-3">
    <aside className="relative flex items-start gap-3 rounded-2xl rounded-bl-sm bg-brand-50 p-4 text-brand-800" aria-label="Share with a neighbour"><span className="mt-1 shrink-0"><GiftIcon /></span><div className="min-w-0 flex-1"><p className="font-semibold">Wanna share?</p><p className="mt-1 text-sm">Give something a new home, or lend it for a little while.</p><Link to="/share" state={{ from: location.pathname + location.search }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 [&_svg]:h-5 [&_svg]:w-5"><PlusIcon />Share an item</Link></div></aside>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold [&_svg]:h-5 [&_svg]:w-5"><GiftIcon />My shared items</h2></div>
    <p className="text-sm text-stone-600">Manage the items you give away or lend. Private drafts are visible only to you.</p>
    {listings.isPending && <Skeleton />}
    {listings.isError && <Alert tone="error">{listings.error.message}</Alert>}
    {listings.data?.length === 0 && <Card>Give something useful a new home, or lend it to a neighbour.</Card>}
    <div className="grid gap-3 sm:grid-cols-2">{listings.data?.map(item => <Card key={item.id} className="space-y-3">
      <ActivityItem id={item.id} title={item.title} photo={item.photos[0]?.url} />
      <div className="flex flex-wrap items-center gap-2"><ActivityStatus status={item.status} /><span className="text-sm text-stone-600">{item.mode === 'donate' ? 'Free to keep' : 'Borrow & return'}</span></div>
      <p className="text-sm text-stone-600">{item.mode === 'donate' ? (item.stock.total - item.stock.reserved - item.stock.collected) + ' of ' + item.stock.total + ' available' : 'Availability depends on dates'}</p>
    </Card>)}</div>
  </section>;
}
