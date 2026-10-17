import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NeedMatches } from './NeedMatches';
import { Link } from 'react-router';
import { z } from 'zod';
import { ApiRoutes, SavedNeedPageSchema } from '@neighbourhood/shared';
import { Alert, Button, Card } from '../../components/ui';
import { t } from '../../i18n';
import { api } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';

export function SavedNeedsPage() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const saved = useInfiniteQuery({
    queryKey: ['saved-needs', 'pages'], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api(`${ApiRoutes.needs}${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: SavedNeedPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${ApiRoutes.needs}/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-needs'] }),
  });
  const items = saved.data?.pages.flatMap((page) => page.items) ?? [];
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">{t('needs.savedTitle')}</h1>
    <p className="text-sm text-stone-600">{t('ask.savedIndependent')}</p>
    <Link to="/needs" className="text-sm font-semibold text-brand-800 underline">{t('ask.back')}</Link>
    {saved.isPending && <Alert>{t('common.loading')}</Alert>}
    {saved.isError && <Alert tone="error">{featureError(saved.error)}</Alert>}
    {remove.isError && <Alert tone="error">{featureError(remove.error)}</Alert>}
    {saved.isSuccess && items.length === 0 && <p>{t('needs.savedEmpty')}</p>}
    {items.map((need) => <Card key={need.id} className="space-y-3">
      {need.extraction.items.map((item, index) => <div key={index} className="space-y-1">
        <p className="font-semibold">{item.name}</p>
        <p className="text-sm text-stone-600">{item.category.replaceAll('_', ' ')} · {t(`needs.preference.${item.preference}`)}</p>
        {item.quantity !== null && <p className="text-sm">{t('needs.quantity', { value: item.quantity })}</p>}
        {item.attributes.map((attribute, i) => <p key={i} className="text-sm">{attribute.name}: {attribute.value}</p>)}
      </div>)}
      {need.extraction.timing.neededBy && <p className="text-sm">{t('needs.neededBy', { date: need.extraction.timing.neededBy })}</p>}
      {need.extraction.timing.loanDurationDays && <p className="text-sm">{t('needs.duration', { days: need.extraction.timing.loanDurationDays })}</p>}
      <NeedMatches id={need.id} />
      <Button type="button" variant="secondary" disabled={!online || remove.isPending} onClick={() => { if (window.confirm(t('needs.deleteConfirm'))) remove.mutate(need.id); }}>{t('needs.delete')}</Button>
    </Card>)}
    {saved.hasNextPage && <Button type="button" disabled={saved.isFetchingNextPage} onClick={() => void saved.fetchNextPage()}>{t('common.loadMore')}</Button>}
  </div>;
}
