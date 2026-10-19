import type { UseQueryResult } from '@tanstack/react-query';
import { Alert, Button } from '../../components/ui';
import type { BookedDateRange } from './loansApi';

/** Loading/error state for booked dates. Renders nothing once availability has loaded. */
export function AvailabilityStatus({ query }: { query: UseQueryResult<BookedDateRange[]> }) {
  if (query.isPending) return <p role="status" className="text-sm text-stone-600">Checking which dates are already booked…</p>;
  if (query.isError) {
    return (
      <Alert tone="error">
        Couldn’t check which dates are already booked, so borrowing is paused.{' '}
        <Button variant="ghost" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {query.isFetching ? 'Checking…' : 'Try again'}
        </Button>
      </Alert>
    );
  }
  return null;
}
