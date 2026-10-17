import { type DonationRequest } from '@neighbourhood/shared';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { t } from '../../i18n';
import { useOnline } from '../../lib/useOnline';
import { featureError } from './feature-errors';
import { createRetryKey } from './retry-key';
import { useRequest, useRequests, useRequestTransition } from './useRequests';

export function ActivityPage() {
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing');
  const [params] = useSearchParams();
  const focused = useRequest(params.get('request'));
  const list = useRequests(direction);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('activity.title')}</h1>
      <p className="text-sm text-stone-600">{t('activity.intro')}</p>
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-brand-800">
        <Link to="/messages" className="min-h-11 py-3 underline">{t('module.messages.title')}</Link>
        <Link to="/notifications" className="min-h-11 py-3 underline">{t('module.notifications.title')}</Link>
      </div>
      {focused.isLoading && <p role="status">{t('common.loading')}</p>}
      {focused.isError && <Alert tone="error">{featureError(focused.error)}</Alert>}
      {focused.data && <RequestCard key={`focused-${focused.data.id}`} item={focused.data} />}
      <div className="grid grid-cols-2 gap-2" aria-label={t('activity.direction')}>
        {(['outgoing', 'incoming'] as const).map((value) => (
          <Button key={value} variant={direction === value ? 'primary' : 'secondary'} aria-pressed={direction === value} onClick={() => setDirection(value)}>{t(`activity.${value}`)}</Button>
        ))}
      </div>
      {list.isPending && <p role="status">{t('common.loading')}</p>}
      {list.isError && <Alert tone="error">{featureError(list.error)} <Button variant="ghost" onClick={() => void list.refetch()}>{t('common.retry')}</Button></Alert>}
      {list.isSuccess && items.length === 0 && <Card><p className="text-stone-600">{t(`activity.empty.${direction}`)}</p><Link to="/explore" className="mt-3 inline-block py-2 font-semibold text-brand-800 underline">{t('nav.explore')}</Link></Card>}
      {items.filter((item) => item.id !== focused.data?.id).map((item) => <RequestCard key={item.id} item={item} />)}
      {list.hasNextPage && <Button variant="secondary" className="w-full" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('common.loadMore')}</Button>}
    </div>
  );
}

function RequestCard({ item }: { item: DonationRequest }) {
  const online = useOnline();
  const transition = useRequestTransition(item.id);
  const keys = useRef(createRetryKey());
  const [action, setAction] = useState<'approved' | 'rejected' | 'cancelled' | 'collected' | null>(null);
  const [deadline, setDeadline] = useState('');
  const allowed = item.allowedActions ?? [];
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words font-semibold">{item.listingTitle ?? t('activity.item')}</h2>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">{t(`request.status.${item.status}`)}</span>
      </div>
      <p className="text-sm text-stone-600">{t('needs.quantity', { value: item.quantity })}</p>
      {item.message && <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>}
      {item.pickupBy && <p className="text-sm font-medium">{t('activity.pickupBy', { date: new Date(item.pickupBy).toLocaleString() })}</p>}
      {item.conversationId && <Link className="inline-block min-h-11 py-3 text-sm font-semibold text-brand-800 underline" to={`/messages?conversation=${item.conversationId}`}>{t('activity.openChat')}</Link>}
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => <Button key={to} variant="secondary" disabled={!online || transition.isPending} onClick={() => { setAction(to); transition.reset(); }}>{t(`request.action.${to}`)}</Button>)}
      </div>
      {action && allowed.includes(action) && (
        <form className="space-y-3 rounded-xl bg-stone-50 p-3" onSubmit={(e) => {
          e.preventDefault();
          const payload = { to: action, ...(action === 'approved' && deadline ? { pickupBy: new Date(deadline).toISOString() } : {}) };
          transition.mutate({ ...payload, key: keys.current.forPayload(payload) }, { onSuccess: () => { keys.current.clear(); setAction(null); } });
        }}>
          <p className="text-sm font-medium">{t(`request.confirm.${action}`)}</p>
          {action === 'approved' && <TextField type="datetime-local" label={t('activity.deadline')} hint={t('activity.deadlineHint')} value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          {transition.isError && <Alert tone="error">{featureError(transition.error)}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" disabled={!online || transition.isPending}>{transition.isPending ? t('common.saving') : t('common.confirm')}</Button>
            <Button type="button" variant="ghost" disabled={transition.isPending} onClick={() => setAction(null)}>{t('common.back')}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
