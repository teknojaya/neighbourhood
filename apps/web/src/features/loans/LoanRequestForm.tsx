import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { LoanSchema } from '@neighbourhood/shared';
import { api, ApiError } from '../../lib/api';
import { Alert, Button, TextField } from '../../components/ui';
import { createRetryKey } from '../activity/retry-key';
import { AvailabilityStatus } from './AvailabilityStatus';
import { bookedDatesQueryKey, useBookedDates } from './loansApi';

export function LoanRequestForm({ listingId }: { listingId: string }) {
  const availability = useBookedDates(listingId);
  const [startDate, setStart] = useState(''); const [endDate, setEnd] = useState(''); const [message, setMessage] = useState('');
  const keys = useRef(createRetryKey()); const navigate = useNavigate(); const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: () => { const body = { listingId, startDate, endDate, message }; return api('/api/v1/loans', { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: LoanSchema }); },
    onSuccess: loan => { void qc.invalidateQueries({ queryKey: ['loans'] }); navigate(`/activity?loan=${loan.id}`); },
    // The server is authoritative for overlaps; refresh the shown schedule after a conflict.
    onError: err => { if (err instanceof ApiError && err.code === 'CONFLICT') void qc.invalidateQueries({ queryKey: bookedDatesQueryKey(listingId) }); },
  });
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (availability.isSuccess) submit.mutate(); }}>
    <AvailabilityStatus query={availability} />
    {availability.data?.map((range, i) => <p className="text-sm text-stone-600" key={i}>Reserved: {range.startDate} → {range.endDate}{range.checkedOut ? ' · currently checked out' : ''}</p>)}
    <TextField label="Borrow from" type="date" required value={startDate} onChange={e => setStart(e.target.value)} />
    <TextField label="Return by" type="date" required min={startDate} value={endDate} onChange={e => setEnd(e.target.value)} />
    <TextField label="Message to owner" maxLength={500} value={message} onChange={e => setMessage(e.target.value)} />
    {submit.isError && <Alert tone="error">{submit.error.message}</Alert>}
    <Button disabled={submit.isPending || !availability.isSuccess}>Reviewed — request these dates</Button>
  </form>;
}
