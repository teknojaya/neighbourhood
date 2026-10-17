import { ApiRoutes, NotificationPageSchema, NotificationSchema } from '@neighbourhood/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert, Button, Card } from '../../components/ui';
import { t } from '../../i18n';
import { api } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';

export function NotificationsPage() {
  const online = useOnline();
  const qc = useQueryClient();
  const inbox = useInfiniteQuery({
    queryKey: ['notifications'], initialPageParam: null as string | null, refetchInterval: 15_000,
    queryFn: ({ signal, pageParam }) => api(`${ApiRoutes.notifications}?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: NotificationPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const read = useMutation({
    mutationFn: (id: string) => api(`${ApiRoutes.notifications}/${id}/read`, { method: 'POST', schema: NotificationSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = inbox.data?.pages.flatMap((p) => p.items) ?? [];
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">{t('module.notifications.title')}</h1>
    <p className="text-sm text-stone-600">{t('module.notifications.body')}</p>
    {inbox.isPending && <p role="status">{t('common.loading')}</p>}
    {inbox.isError && <Alert tone="error">{featureError(inbox.error)} <Button variant="ghost" onClick={() => void inbox.refetch()}>{t('common.retry')}</Button></Alert>}
    {read.isError && <Alert tone="error">{featureError(read.error)}</Alert>}
    {inbox.isSuccess && items.length === 0 && <Card>{t('notifications.empty')}</Card>}
    {items.map((item) => <Card key={item.id} className={item.readAt ? 'space-y-2' : 'space-y-2 border-l-4 border-brand-700'}>
      <h2 className="font-semibold">{item.title}</h2>
      <p className="text-sm text-stone-600">{item.body}</p>
      <time dateTime={item.createdAt} className="block text-xs text-stone-500">{new Date(item.createdAt).toLocaleString()}</time>
      <div className="flex flex-wrap items-center gap-3">
        {item.link && item.link.startsWith('/') && !item.link.startsWith('//') && <Link to={item.link} className="min-h-11 py-3 text-sm font-semibold text-brand-800 underline">{t('notifications.open')}</Link>}
        {!item.readAt && <Button variant="ghost" disabled={!online || read.isPending} onClick={() => read.mutate(item.id)}>{t('notifications.markRead')}</Button>}
      </div>
    </Card>)}
    {inbox.hasNextPage && <Button variant="secondary" className="w-full" disabled={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>{t('common.loadMore')}</Button>}
  </div>;
}
