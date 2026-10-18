import { ApiRoutes, NotificationPageSchema, NotificationSchema, UnreadSummarySchema, type Notification } from '@neighbourhood/shared';
import { PushPreferences } from './PushPreferences';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert, Button, Card, PageHeading, Skeleton } from '../../components/ui';
import { t } from '../../i18n';
import { api } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';
import { BellIcon, ChatIcon, CheckIcon, ClockIcon, CloseIcon, ExchangeIcon, GiftIcon, MapIcon, ArrowIcon } from '../../components/icons';

export function NotificationsPage() {
  const online = useOnline();
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['notifications', 'unread'], queryFn: ({ signal }) => api('/api/v1/notifications/unread', { schema: UnreadSummarySchema, signal }), refetchInterval: online ? 15_000 : false, staleTime: 10_000 });
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
  const groups = [{ title: 'Unread', items: items.filter(item => !item.readAt) }, { title: 'Read updates', items: items.filter(item => item.readAt) }];
  return <div className="space-y-4">
    <PageHeading title="Notifications">Requests, loans and community news.</PageHeading>
    {summary.data && <p className="flex items-center gap-2 text-sm font-medium text-brand-800 [&_svg]:h-5 [&_svg]:w-5">{summary.data.updates ? <BellIcon /> : <CheckIcon />}{summary.data.updates ? `${summary.data.updates} unread ${summary.data.updates === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}</p>}
    {inbox.isPending && <Skeleton />}
    {inbox.isError && <Alert tone="error">{featureError(inbox.error)} <Button variant="ghost" onClick={() => void inbox.refetch()}>{t('common.retry')}</Button></Alert>}
    {read.isError && <Alert tone="error">{featureError(read.error)}</Alert>}
    {inbox.isSuccess && items.length === 0 && <Card className="space-y-2"><BellIcon /><h2 className="font-semibold">Nothing here yet</h2><p className="text-sm text-stone-600">Updates about your items, requests and communities will appear here.</p><Link className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline" to="/activity">View your activity</Link></Card>}
    {groups.filter(group => group.items.length).map(group => <section key={group.title} aria-label={group.title} className="space-y-2"><h2 className="pt-2 text-sm font-semibold text-stone-600">{group.title}</h2><ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">{group.items.map(item => <NotificationRow key={item.id} item={item} busy={read.isPending} online={online} onRead={() => read.mutate(item.id)} />)}</ul></section>)}
    {inbox.hasNextPage && <Button variant="secondary" className="w-full" disabled={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>{t('common.loadMore')}</Button>}
    <details className="border-t border-stone-200 pt-3"><summary className="cursor-pointer py-3 text-sm font-semibold">Device notification settings</summary><PushPreferences /></details>
  </div>;
}

function notificationKind(item: Notification) {
  if (item.type.startsWith('request_')) return { label: 'Request', Icon: /approved|collected/.test(item.type) ? CheckIcon : /rejected|cancelled/.test(item.type) ? CloseIcon : ClockIcon, tone: /approved|collected/.test(item.type) ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-900' };
  if (item.type.startsWith('loan')) return { label: 'Loan', Icon: ExchangeIcon, tone: 'bg-sky-50 text-sky-900' };
  if (item.type.startsWith('deposit')) return { label: 'Community', Icon: GiftIcon, tone: 'bg-brand-50 text-brand-800' };
  if (item.type.startsWith('message')) return { label: 'Message', Icon: ChatIcon, tone: 'bg-sky-50 text-sky-900' };
  return { label: 'Update', Icon: MapIcon, tone: 'bg-stone-100 text-stone-700' };
}
function NotificationRow({ item, busy, online, onRead }: { item: Notification; busy: boolean; online: boolean; onRead(): void }) {
  const { label, Icon, tone } = notificationKind(item);
  const link = item.link?.startsWith('/') && !item.link.startsWith('//') ? item.link : null;
  const openLabel = link?.startsWith('/activity?request=') ? 'View request' : link?.startsWith('/activity?loan=') ? 'View loan' : link?.startsWith('/messages') ? 'Open conversation' : link?.startsWith('/communities') ? 'View community' : 'View update';
  const date = new Date(item.createdAt);
  const today = date.toDateString() === new Date().toDateString();
  const title = item.title.replaceAll('checked_out', 'collected').replaceAll('_', ' ');
  return <li className={`flex items-start gap-3 p-4 ${item.readAt ? '' : 'bg-brand-50/40'}`}>
    <span className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5 ${tone}`}><Icon /></span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600"><span>{label}</span>{!item.readAt && <span className="inline-flex items-center gap-1.5 font-semibold text-brand-800"><span className="h-1.5 w-1.5 rounded-full bg-brand-700" />Unread</span>}<time className="ml-auto" dateTime={item.createdAt} title={date.toLocaleString()}>{today ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</time></div>
      <h3 className="mt-1 break-words font-semibold">{title}</h3><p className="mt-1 break-words text-sm text-stone-600">{item.body}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">{link && <Link to={link} onClick={() => { if (!item.readAt && online && !busy) onRead(); }} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-800 underline [&_svg]:h-4 [&_svg]:w-4">{openLabel}<ArrowIcon /></Link>}{!item.readAt && <Button variant="ghost" className="gap-1 px-0 text-xs [&_svg]:h-4 [&_svg]:w-4" disabled={!online || busy} onClick={onRead}><CheckIcon />{t('notifications.markRead')}</Button>}</div>
    </div>
  </li>;
}
