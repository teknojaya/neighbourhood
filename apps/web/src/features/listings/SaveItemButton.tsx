import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SavedItemIdsSchema, SavedItemStateSchema } from '@neighbourhood/shared';
import { BookmarkIcon } from '../../components/icons';
import { api } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
export function SaveItemButton({ id, title, compact = false }: { id: string; title: string; compact?: boolean }) {
  const qc = useQueryClient(), online = useOnline();
  const saved = useQuery({ queryKey: ['saved-item-ids'], queryFn: ({ signal }) => api('/api/v1/saved-items/ids', { schema: SavedItemIdsSchema, signal }) });
  const selected = saved.data?.ids.includes(id) ?? false;
  const update = useMutation({ mutationFn: () => api('/api/v1/saved-items/' + id, { method: selected ? 'DELETE' : 'PUT', schema: SavedItemStateSchema }), onSuccess: result => { qc.setQueryData(['saved-item-ids'], (old: { ids: string[] } | undefined) => ({ ids: result.saved ? [...new Set([...(old?.ids ?? []), id])] : (old?.ids ?? []).filter(value => value !== id) })); void qc.invalidateQueries({ queryKey: ['saved-items'] }); } });
  return <span className="inline-flex flex-col"><button type="button" aria-label={`${selected ? 'Remove from saved items' : 'Save item'}: ${title}`} aria-pressed={selected} title={saved.isError ? 'Could not load saved items. Click to retry.' : selected ? 'Remove from saved items' : 'Save item'} disabled={!online || saved.isPending || update.isPending} onClick={() => saved.isError ? void saved.refetch() : update.mutate()} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white text-sm font-semibold text-brand-800 hover:border-brand-700 disabled:text-stone-500 aria-pressed:bg-brand-50 ${compact ? 'h-11 w-11' : 'px-3 py-2'}`}><BookmarkIcon />{!compact && (selected ? 'Saved' : 'Save item')}</button>{update.isError && <span role="alert" className="max-w-40 text-xs text-red-900">Could not save. Try again.</span>}</span>;
}
