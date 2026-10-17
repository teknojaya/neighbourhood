import { type ApiErrorCode, ApiErrorBodySchema } from '@neighbourhood/shared';
import type { z } from 'zod';
import { getFirebaseAuth } from './firebase';

export type ClientErrorCode = ApiErrorCode | 'OFFLINE' | 'NETWORK' | 'BAD_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions<T extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Private image upload; kept out of JSON and chat history payloads. */
  binaryBody?: Blob;
  /** Validates the response against the shared contract. */
  schema: T;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * Shared API client. Attaches the Firebase ID token as a bearer token,
 * validates responses with shared Zod schemas and normalises errors.
 * Mutations fail fast offline — nothing is queued.
 */
export async function api<T extends z.ZodType>(path: string, opts: RequestOptions<T>): Promise<z.infer<T>> {
  const method = opts.method ?? 'GET';
  if (method !== 'GET' && !navigator.onLine) {
    throw new ApiError('OFFLINE', 'You are offline. Connect to the internet and try again.', 0);
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const user = getFirebaseAuth()?.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.binaryBody) headers['Content-Type'] = opts.binaryBody.type;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.binaryBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      signal: opts.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw navigator.onLine
      ? new ApiError('NETWORK', 'Could not reach NeighbourHood. Please try again.', 0)
      : new ApiError('OFFLINE', 'You are offline. Connect to the internet and try again.', 0);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(json);
    if (parsed.success) {
      const e = parsed.data.error;
      throw new ApiError(e.code, e.message, res.status, e.details);
    }
    throw new ApiError('BAD_RESPONSE', `Unexpected server response (${res.status})`, res.status);
  }
  const data = opts.schema.safeParse(json);
  if (!data.success) throw new ApiError('BAD_RESPONSE', 'Unexpected server response', res.status);
  return data.data;
}

export const newIdempotencyKey = () => crypto.randomUUID().replaceAll('-', '');

/** Authenticated image reads use blobs so no bearer token appears in an image URL. */
export async function privateImage(path: string, signal: AbortSignal): Promise<Blob> {
  const user = getFirebaseAuth()?.currentUser;
  const headers: Record<string, string> = {};
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const response = await fetch(path, { headers, signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new ApiError('BAD_RESPONSE', 'Photo is unavailable', response.status);
  return response.blob();
}
