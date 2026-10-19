import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type * as ApiModule from '../../lib/api';

// Only the transport is faked; listingApi/loansApi and React Query run for real.
const apiMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../../lib/api');
  return { ...actual, api: apiMock };
});
vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: () => null }));

const { fetchListingDetail } = await import('./listingApi');
const { fetchBookedDates } = await import('../loans/loansApi');
const { ApiError, isAbortError } = await import('../../lib/api');

const abortError = () => new DOMException('signal is aborted without reason', 'AbortError');
/** Resolves after `ms` unless the signal aborts first, like fetch(). */
const delayed = <T,>(value: T, ms: number, signal?: AbortSignal) => new Promise<T>((resolve, reject) => {
  const timer = setTimeout(() => resolve(value), ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()); }, { once: true });
});
const detail = (id: string) => ({ listing: { id } });

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => { apiMock.mockReset(); errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => errorLog.mockRestore());

describe('isAbortError', () => {
  it('recognises fetch/AbortController cancellation only', () => {
    expect(isAbortError(abortError())).toBe(true);
    expect(isAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    expect(isAbortError(new ApiError('NETWORK', 'Could not reach NeighbourHood', 0))).toBe(false);
    expect(isAbortError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe('fetchListingDetail', () => {
  it('does not log an expected cancellation, but still rejects so callers stop', async () => {
    apiMock.mockRejectedValueOnce(abortError());
    await expect(fetchListingDetail('a')).rejects.toMatchObject({ name: 'AbortError' });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('still reports and rethrows genuine network/server failures', async () => {
    const failure = new ApiError('NETWORK', 'NeighbourHood is temporarily unavailable. Please try again.', 503);
    apiMock.mockRejectedValueOnce(failure);
    await expect(fetchListingDetail('a')).rejects.toBe(failure);
    expect(errorLog).toHaveBeenCalledWith('[listingApi] fetchListingDetail failed:', failure);
  });
});

describe('fetchBookedDates', () => {
  it('rejects on cancellation instead of reporting "no bookings"', async () => {
    apiMock.mockRejectedValueOnce(abortError());
    await expect(fetchBookedDates('a')).rejects.toMatchObject({ name: 'AbortError' });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('rejects and reports a genuine failure instead of returning an empty schedule', async () => {
    const failure = new ApiError('NETWORK', 'NeighbourHood is temporarily unavailable. Please try again.', 503);
    apiMock.mockRejectedValueOnce(failure);
    await expect(fetchBookedDates('a')).rejects.toBe(failure);
    expect(errorLog).toHaveBeenCalledWith('[loansApi] fetchBookedDates failed:', failure);
  });
});

describe('listing detail query with React Query cancellation', () => {
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = (id: string) => ({ queryKey: ['listing-detail', id], queryFn: ({ signal }: { signal: AbortSignal }) => fetchListingDetail(id, signal) });

  it('navigating away aborts the request without an error state, and reopening loads again', async () => {
    const qc = client(); const signals: AbortSignal[] = [];
    apiMock.mockImplementation((_path: string, opts: { signal: AbortSignal }) => { signals.push(opts.signal); return delayed(detail('a'), 50, opts.signal); });
    const observer = new QueryObserver(qc, options('a'));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    unsubscribe(); // leave the page before the response arrives
    await vi.waitFor(() => expect(signals[0]!.aborted).toBe(true));
    const state = qc.getQueryState(['listing-detail', 'a'])!;
    expect(state.status).toBe('pending');
    expect(state.error).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();

    const again = new QueryObserver(qc, options('a')); // open the listing again
    const stop = again.subscribe(() => undefined);
    await vi.waitFor(() => expect(again.getCurrentResult().data).toEqual(detail('a')));
    expect(signals).toHaveLength(2);
    expect(signals[1]).not.toBe(signals[0]); // fresh AbortController per execution
    stop();
  });

  it('switching listings cancels the old request; its late result cannot replace the new listing', async () => {
    const qc = client();
    apiMock.mockImplementation((path: string, opts: { signal: AbortSignal }) => path.endsWith('/a') ? delayed(detail('a'), 80, opts.signal) : delayed(detail('b'), 10, opts.signal));
    const observer = new QueryObserver(qc, options('a'));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    observer.setOptions(options('b')); // same page component, new :id
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(detail('b')));
    await new Promise(resolve => setTimeout(resolve, 120)); // after A would have resolved
    expect(observer.getCurrentResult().data).toEqual(detail('b'));
    expect(qc.getQueryData(['listing-detail', 'a'])).toBeUndefined();
    expect(qc.getQueryState(['listing-detail', 'a'])!.error).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('a genuine failure still produces an error state, and Try again recovers', async () => {
    const qc = client();
    apiMock.mockRejectedValueOnce(new ApiError('NETWORK', 'Could not reach NeighbourHood. Please try again.', 0));
    const observer = new QueryObserver(qc, options('a'));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    expect(errorLog).toHaveBeenCalledTimes(1);
    apiMock.mockResolvedValueOnce(detail('a'));
    await observer.refetch();
    expect(observer.getCurrentResult()).toMatchObject({ isError: false, data: detail('a') });
    unsubscribe();
  });
});
