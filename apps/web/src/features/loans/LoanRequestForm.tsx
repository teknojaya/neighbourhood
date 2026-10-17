import { useRef, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { LoanSchema } from '@neighbourhood/shared';
import { api } from '../../lib/api';
import { Alert, Button, TextField } from '../../components/ui';
import { createRetryKey } from '../activity/retry-key';

export function LoanRequestForm({ listingId }: { listingId: string }) {
  const availability = useQuery({ queryKey: ['availability', listingId], queryFn: () => api(`/api/v1/listings/${listingId}/availability`, { schema: z.object({ items: z.array(z.object({ startDate: z.string(), endDate: z.string(), checkedOut: z.boolean() })) }) }) });
  const [startDate, setStart] = useState(''); const [endDate, setEnd] = useState(''); const [message, setMessage] = useState('');
  const keys = useRef(createRetryKey()); const navigate = useNavigate(); const qc = useQueryClient();
  const submit = useMutation({ mutationFn: () => { const body = { listingId, startDate, endDate, message }; return api('/api/v1/loans', { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: LoanSchema }); }, onSuccess: loan => { void qc.invalidateQueries({ queryKey: ['loans'] }); navigate(`/activity?loan=${loan.id}`); } });
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
    {availability.data?.items.map((range,i) => <p className="text-sm text-stone-600" key={i}>Reserved: {range.startDate} → {range.endDate}{range.checkedOut ? ' · currently checked out' : ''}</p>)}
    <TextField label="Borrow from" type="date" required value={startDate} onChange={e => setStart(e.target.value)} />
    <TextField label="Return by" type="date" required min={startDate} value={endDate} onChange={e => setEnd(e.target.value)} />
    <TextField label="Message to owner" maxLength={500} value={message} onChange={e => setMessage(e.target.value)} />
    {submit.isError && <Alert tone="error">{submit.error.message}</Alert>}
    <Button disabled={submit.isPending}>Reviewed — request these dates</Button>
  </form>;
}
