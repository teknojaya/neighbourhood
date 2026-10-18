import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { SavedItemPageSchema, SavedItemStateSchema } from '@neighbourhood/shared';
import { Alert, Button, Card, PageHeading, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { featureError } from '../activity/feature-errors';
import { ListingCard } from './ListingCard';
import { useOnline } from '../../lib/useOnline';
export function SavedItemsPage() {
  const qc = useQueryClient(), online = useOnline();
  const saved = useInfiniteQuery({ queryKey: ['saved-items'], initialPageParam: null as string | null, queryFn: ({ signal, pageParam }) => api('/api/v1/saved-items' + (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''), { schema: SavedItemPageSchema, signal }), getNextPageParam: page => page.nextCursor ?? undefined });
  const remove = useMutation({ mutationFn: (id: string) => api('/api/v1/saved-items/' + id, { method: 'DELETE', schema: SavedItemStateSchema }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['saved-items'] }); void qc.invalidateQueries({ queryKey: ['saved-item-ids'] }); } });
  const items = saved.data?.pages.flatMap(page => page.items) ?? [];
  return <div className="space-y-4"><PageHeading title="Saved items">Products you want to come back to. Saving an item does not reserve it.</PageHeading><div className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline" to="/explore">Explore items</Link><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline" to="/needs/saved">Saved needs</Link></div>{saved.isPending && <Skeleton />}{saved.isError && <Alert tone="error">{featureError(saved.error)} <Button variant="ghost" onClick={() => void saved.refetch()}>Try again</Button></Alert>}{remove.isError && <Alert tone="error">{featureError(remove.error)}</Alert>}{saved.isSuccess && !items.length && <Card><h2 className="font-semibold">Nothing saved yet</h2><p className="mt-2 text-sm text-stone-600">Use the bookmark on an item to keep it here.</p></Card>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(item => item.listing ? <ListingCard key={item.id} item={item.listing} /> : <Card key={item.id}><h2 className="break-words font-semibold">{item.title}</h2><p className="my-2 text-sm text-stone-600">This item is no longer available to view.</p><Button variant="ghost" disabled={!online || remove.isPending} onClick={() => remove.mutate(item.listingId)}>Remove saved item</Button></Card>)}</div>{saved.hasNextPage && <Button disabled={saved.isFetchingNextPage} onClick={() => void saved.fetchNextPage()}>Load more</Button>}</div>;
}
