import { AskStreamEventSchema, AskRunSchema, ApiErrorBodySchema, type AskRun, type AskSendBody } from '@neighbourhood/shared';
import { getFirebaseAuth } from './firebase';
import { ApiError } from './api';

/** Authenticated POST stream. No tokens in URLs and no implicit retries of a write. */
export async function streamAsk(path: string, body: AskSendBody, onRun: (run: AskRun) => void, signal?: AbortSignal): Promise<AskRun> {
  if (!navigator.onLine) throw new ApiError('OFFLINE', 'Connect to send your message.', 0);
  const user = getFirebaseAuth()?.currentUser;
  let response: Response;
  try { response = await fetch(path, { method: 'POST', headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', signal }); }
  catch (error) { if (signal?.aborted) throw error; throw new ApiError(navigator.onLine ? 'NETWORK' : 'OFFLINE', 'Could not connect. Reopen your chat to check its status.', 0); }
  if (!response.ok) { const parsed = ApiErrorBodySchema.safeParse(await response.json().catch(() => null)); throw new ApiError(parsed.success ? parsed.data.error.code : 'BAD_RESPONSE', parsed.success ? parsed.data.error.message : 'Could not start the reply.', response.status); }
  if (!response.headers.get('Content-Type')?.includes('application/x-ndjson')) { const run = AskRunSchema.parse(await response.json()); onRun(run); return run; }
  if (!response.body) throw new ApiError('BAD_RESPONSE', 'Reply stream is unavailable.', response.status);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let done: AskRun | null = null;
  const receive = (line: string) => { if (!line.trim()) return; let json: unknown; try { json = JSON.parse(line); } catch { throw new ApiError('BAD_RESPONSE', 'Invalid reply stream.', 0); } const parsed = AskStreamEventSchema.safeParse(json); if (!parsed.success) throw new ApiError('BAD_RESPONSE', 'Invalid reply stream.', 0); const event = parsed.data; onRun(event.run); if (event.type === 'done') done = event.run; };
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; pending += decoder.decode(chunk.value, { stream: true }); let newline; while ((newline = pending.indexOf('\n')) >= 0) { receive(pending.slice(0, newline)); pending = pending.slice(newline + 1); } if (pending.length > 100_000) throw new ApiError('BAD_RESPONSE', 'Invalid reply stream.', 0); }
    pending += decoder.decode(); if (pending.trim()) receive(pending);
  } catch (error) { if (error instanceof ApiError || signal?.aborted) throw error; throw new ApiError('NETWORK', 'Reply connection ended. Reopen your chat to check its status.', 0); }
  finally { reader.releaseLock(); }
  if (!done) throw new ApiError('NETWORK', 'The connection ended. Your chat will recover the reply; check its status before retrying.', 0);
  return done;
}
