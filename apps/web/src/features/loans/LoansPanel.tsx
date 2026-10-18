import { ActivityItem, ActivityStatus } from '../activity/ActivityItem';
import { CalendarIcon, ChatIcon } from '../../components/icons';
import { useOnline } from '../../lib/useOnline';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoanPageSchema, LoanSchema, type Loan } from '@neighbourhood/shared';
import { api } from '../../lib/api';
import { Alert, Button, Card, Skeleton, TextField } from '../../components/ui';
import { createRetryKey } from '../activity/retry-key';

export function LoansPanel() {
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing'); const [params] = useSearchParams();
  const focusedId = params.get('loan');
  const focused = useQuery({ queryKey: ['loans', focusedId], queryFn: () => api('/api/v1/loans/' + focusedId, { schema: LoanSchema }), enabled: Boolean(focusedId) });
  const list = useQuery({ queryKey: ['loans', direction], queryFn: () => api('/api/v1/loans?direction=' + direction, { schema: LoanPageSchema }), refetchInterval: 15_000 });
  return <section className="space-y-3"><div><h2 className="font-semibold">{direction === 'outgoing' ? 'Items you’re borrowing' : 'Items you’re lending'}</h2><p className="mt-1 text-sm text-stone-600">Track agreed dates, collection and returns.</p></div><div className="grid grid-cols-2 gap-2">{(['outgoing', 'incoming'] as const).map(d => <Button aria-pressed={direction === d} variant={direction === d ? 'primary' : 'secondary'} key={d} onClick={() => setDirection(d)}>{d === 'incoming' ? 'Lending out' : 'Borrowing'}</Button>)}</div>
    {list.isPending && <Skeleton />}{list.isError && <Alert tone="error">{list.error.message}</Alert>}{focused.isError && <Alert tone="error">{focused.error.message}</Alert>}
    {focused.data && <LoanCard item={focused.data} />}{list.data?.items.length === 0 && <Card>No loans yet. <Link to="/explore?mode=lend" className="underline">Find something to borrow</Link></Card>}
    {list.data?.items.filter(l => l.id !== focusedId).map(l => <LoanCard key={l.id} item={l} />)}
  </section>;
}
function LoanCard({ item }: { item: Loan }) {
  const online = useOnline();
  const actionLabels: Record<string, string> = { approved: 'Approve loan', rejected: 'Decline loan', cancelled: 'Cancel loan', checked_out: 'Confirm collection', returned: 'Confirm return' };
  const date = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const [to, setTo] = useState<string | null>(null); const [note, setNote] = useState(''); const keys = useRef(createRetryKey()); const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => { const body = { to, ...(to === 'returned' ? { returnConditionNote: note } : {}) }; return api(`/api/v1/loans/${item.id}/transition`, { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: LoanSchema }); }, onSuccess: () => { keys.current.clear(); setTo(null); void qc.invalidateQueries({ queryKey: ['loans'] }); void qc.invalidateQueries({ queryKey: ['notifications'] }); } });
  return <Card className="space-y-3"><ActivityItem id={item.listingId} title={item.listingTitle ?? 'Borrowed item'} photo={item.listingPhotoUrl} /><ActivityStatus status={item.status} overdue={item.overdue} /><p className="flex items-start gap-2 text-sm text-stone-600 [&_svg]:h-5 [&_svg]:w-5"><CalendarIcon /><span>{date(item.startDate)} – {date(item.endDate)}</span></p>
    {item.conversationId && <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-800 underline [&_svg]:h-5 [&_svg]:w-5" to={'/messages?conversation=' + item.conversationId}><ChatIcon />Message neighbour</Link>}
    <div className="flex flex-wrap gap-2">{item.allowedActions?.map(action => <Button key={action} variant="secondary" disabled={mutation.isPending || !online} onClick={() => setTo(action)}>{actionLabels[action]}</Button>)}</div>
    {to && <form className="space-y-3 rounded-xl bg-stone-50 p-3" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><p>{actionLabels[to]}{['checked_out', 'returned'].includes(to) ? ' after the in-person handover' : ''}?</p>{to === 'returned' && <TextField label="Returned condition" maxLength={500} value={note} onChange={e => setNote(e.target.value)} />}{mutation.isError && <Alert tone="error">{mutation.error.message}</Alert>}<div className="flex gap-2"><Button disabled={mutation.isPending || !online}>Confirm</Button><Button type="button" variant="ghost" onClick={() => setTo(null)}>Cancel</Button></div></form>}
  </Card>;
}
