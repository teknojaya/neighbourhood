import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Rendering only: no request may be sent from these states.
vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: () => null }));
vi.mock('../../lib/api', async importOriginal => ({ ...await importOriginal<object>(), api: vi.fn(() => { throw new Error('unexpected request'); }) }));

const { LoanRequestForm } = await import('./LoanRequestForm');
const { bookedDatesQueryKey } = await import('./loansApi');
const { ApiError } = await import('../../lib/api');

const listingId = '00000000-0000-4000-8000-000000000001';
function render(seed?: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  seed?.(qc);
  const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={qc}><LoanRequestForm listingId={listingId} /></QueryClientProvider></MemoryRouter>);
  const submit = /<button[^>]*>Reviewed — request these dates<\/button>/.exec(html)?.[0] ?? '';
  return { html, submitDisabled: /\sdisabled(=""|\s|>)/.test(submit) };
}

describe('LoanRequestForm availability gate', () => {
  it('disables the request while booked dates are loading', () => {
    const { html, submitDisabled } = render();
    expect(html).toContain('Checking which dates are already booked');
    expect(submitDisabled).toBe(true);
  });

  it('shows an error with Try again and keeps the request disabled when availability fails', () => {
    const { html, submitDisabled } = render(qc => {
      qc.getQueryCache().build(qc, { queryKey: bookedDatesQueryKey(listingId) }).setState({ status: 'error', fetchStatus: 'idle', error: new ApiError('NETWORK', 'temporarily unavailable', 503), errorUpdatedAt: Date.now() });
    });
    expect(html).toContain('Couldn’t check which dates are already booked');
    expect(html).toContain('Try again');
    expect(submitDisabled).toBe(true);
  });

  it('enables the request and lists reservations once availability has loaded', () => {
    const { html, submitDisabled } = render(qc => qc.setQueryData(bookedDatesQueryKey(listingId), [{ startDate: '2026-11-02', endDate: '2026-11-04', status: 'approved', checkedOut: false }]));
    expect(html).toContain('Reserved: 2026-11-02 → 2026-11-04');
    expect(html).not.toContain('Couldn’t check');
    expect(submitDisabled).toBe(false);
  });

  it('an empty schedule is only shown as free after a successful load', () => {
    const { html, submitDisabled } = render(qc => qc.setQueryData(bookedDatesQueryKey(listingId), []));
    expect(html).not.toContain('Reserved:');
    expect(submitDisabled).toBe(false);
  });
});
