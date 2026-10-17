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
  return <section className="space-y-3"><h2 className="font-semibold">Borrowing and lending</h2><div className="grid grid-cols-2 gap-2">{(['outgoing', 'incoming'] as const).map(d => <Button variant={direction === d ? 'primary' : 'secondary'} key={d} onClick={() => setDirection(d)}>{d === 'incoming' ? 'Lending out' : 'Borrowing'}</Button>)}</div>
    {list.isPending && <Skeleton />}{list.isError && <Alert tone="error">{list.error.message}</Alert>}{focused.isError && <Alert tone="error">{focused.error.message}</Alert>}
    {focused.data && <LoanCard item={focused.data} />}{list.data?.items.length === 0 && <Card>No loans yet. <Link to="/explore?mode=lend" className="underline">Find something to borrow</Link></Card>}
    {list.data?.items.filter(l => l.id !== focusedId).map(l => <LoanCard key={l.id} item={l} />)}
  </section>;
}
function LoanCard({ item }: { item: Loan }) {
  const [to, setTo] = useState<string | null>(null); const [note, setNote] = useState(''); const keys = useRef(createRetryKey()); const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => { const body = { to, ...(to === 'returned' ? { returnConditionNote: note } : {}) }; return api(`/api/v1/loans/${item.id}/transition`, { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: LoanSchema }); }, onSuccess: () => { keys.current.clear(); setTo(null); void qc.invalidateQueries({ queryKey: ['loans'] }); } });
  return <Card className="space-y-3"><Link className="font-semibold underline" to={'/listings/' + item.listingId}>{item.listingTitle}</Link><p>{item.startDate} → {item.endDate}</p><p className={item.overdue ? 'font-semibold text-red-700' : 'text-sm text-stone-600'}>{item.status.replaceAll('_', ' ')}{item.overdue ? ' · Overdue — arrange return' : ''}</p>
    {item.conversationId && <Link className="block py-2 underline" to={'/messages?conversation=' + item.conversationId}>Message neighbour</Link>}
    <div className="flex flex-wrap gap-2">{item.allowedActions?.map(action => <Button key={action} variant="secondary" disabled={mutation.isPending} onClick={() => setTo(action)}>{action.replaceAll('_', ' ')}</Button>)}</div>
    {to && <form className="space-y-3 rounded-xl bg-stone-50 p-3" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><p>Confirm {to.replaceAll('_', ' ')}{['checked_out', 'returned'].includes(to) ? ' after the in-person handover' : ''}?</p>{to === 'returned' && <TextField label="Returned condition" maxLength={500} value={note} onChange={e => setNote(e.target.value)} />}{mutation.isError && <Alert tone="error">{mutation.error.message}</Alert>}<div className="flex gap-2"><Button disabled={mutation.isPending}>Confirm</Button><Button type="button" variant="ghost" onClick={() => setTo(null)}>Cancel</Button></div></form>}
  </Card>;
}
