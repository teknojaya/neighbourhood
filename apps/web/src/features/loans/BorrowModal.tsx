import { useState, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ListingPublic } from '@neighbourhood/shared';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { AvailabilityStatus } from './AvailabilityStatus';
import { bookedDatesQueryKey, createLoan, useBookedDates } from './loansApi';

interface BorrowModalProps {
  listing: ListingPublic;
  onClose: () => void;
  onSuccess: () => void;
}

export function BorrowModal({ listing, onClose, onSuccess }: BorrowModalProps) {
  const maxDays = listing.lending?.maxLoanDays ?? 14;
  const todayIso = new Date().toISOString().slice(0, 10);
  const messageInputId = useId();

  // Tomorrow as default start date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  const defaultEnd = new Date(tomorrow);
  defaultEnd.setDate(defaultEnd.getDate() + Math.min(3, maxDays));
  const defaultEndIso = defaultEnd.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(tomorrowIso);
  const [endDate, setEndDate] = useState(defaultEndIso);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Booked intervals; confirmation stays disabled until they load successfully.
  const qc = useQueryClient();
  const availability = useBookedDates(listing.id);
  const bookedDates = availability.data ?? [];

  // Calculate duration
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const durationDays = !isNaN(startMs) && !isNaN(endMs) ? Math.round((endMs - startMs) / 86400000) + 1 : 0;

  // Overlap check
  const conflictingRange = bookedDates.find((b) => {
    const bStart = Date.parse(`${b.startDate}T00:00:00Z`);
    const bEnd = Date.parse(`${b.endDate}T00:00:00Z`);
    return startMs <= bEnd && bStart <= endMs;
  });

  // Validation rules
  let validationError: string | null = null;
  if (startDate < todayIso) {
    validationError = 'Start date cannot be in the past.';
  } else if (endDate < startDate) {
    validationError = 'End date cannot be earlier than start date.';
  } else if (durationDays > maxDays) {
    validationError = `Loan duration cannot exceed ${maxDays} days for this item.`;
  } else if (conflictingRange) {
    validationError = `Schedule conflict: Already booked from ${conflictingRange.startDate} to ${conflictingRange.endDate}.`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || !availability.isSuccess) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await createLoan({
        listingId: listing.id,
        startDate,
        endDate,
        message: message.trim(),
      });

      onSuccess();
    } catch (err) {
      console.error('[BorrowModal] createLoan failed:', err);
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        void qc.invalidateQueries({ queryKey: bookedDatesQueryKey(listing.id) });
        setErrorMessage('This item is already booked for these dates. Please choose another date range.');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to submit loan request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔄</span>
            <h2 className="text-lg font-bold text-stone-900">Request to Borrow</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✕
          </button>
        </div>

        {/* Item preview summary */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-200">
            {listing.photos[0]?.url ? (
              <img src={listing.photos[0].url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl">🔌</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-900 text-sm">{listing.title}</p>
            <p className="text-xs text-stone-500">
              Lender: {listing.ownerDisplayName} • Max {maxDays} days
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}

        <div className="mt-3"><AvailabilityStatus query={availability} /></div>

        {/* Booked dates notice if any */}
        {bookedDates.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900">
            <span className="font-semibold">⚠️ Already Booked Dates:</span>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {bookedDates.map((b, i) => (
                <li key={i}>
                  {b.startDate} to {b.endDate} ({b.status ? b.status.replace('_', ' ') : 'booked'})
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <TextField
                label="Start Date"
                type="date"
                min={todayIso}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <TextField
                label="End Date"
                type="date"
                min={startDate || todayIso}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600 flex items-center justify-between">
            <span>Loan Duration:</span>
            <span className="font-bold text-stone-900">
              {durationDays > 0 ? `${durationDays} day(s)` : '-'}
            </span>
          </div>

          {validationError && (
            <Alert tone="warning">{validationError}</Alert>
          )}

          <div>
            <label htmlFor={messageInputId} className="block text-xs font-semibold text-stone-700">
              Message to Lender <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              id={messageInputId}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I need this item to fix something at home. I will return it in pristine condition."
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || Boolean(validationError) || !availability.isSuccess}
            >
              {isSubmitting ? 'Sending Request...' : 'Send Loan Request'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
