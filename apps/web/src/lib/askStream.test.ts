import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamAsk } from './askStream';

vi.mock('./firebase', () => ({ getFirebaseAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }) }));
const body = { clientMessageId: '11111111-1111-4111-8111-111111111111', text: 'Find books', attachmentIds: [] };
const run = { id: '22222222-2222-4222-8222-222222222222', clientMessageId: body.clientMessageId, status: 'running', progress: 'answering', partialText: '附近的书', errorCode: null, createdAt: new Date().toISOString() };
afterEach(() => vi.unstubAllGlobals());
describe('authenticated Ask response stream', () => {
  it('decodes fragmented Unicode records and delivers partial text before the final run', async () => {
    vi.stubGlobal('navigator', { onLine: true }); const data = new TextEncoder().encode(JSON.stringify({ type: 'run', run }) + '\n' + JSON.stringify({ type: 'done', run: { ...run, status: 'completed' } }) + '\n');
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(controller) { for (let offset = 0; offset < data.length; offset += 7) controller.enqueue(data.slice(offset, offset + 7)); controller.close(); } }), { headers: { 'Content-Type': 'application/x-ndjson' } })); vi.stubGlobal('fetch', fetcher);
    const events: unknown[] = []; expect((await streamAsk('/api/v1/ask/sessions/chat/messages', body, event => events.push(event))).status).toBe('completed');
    expect(events).toMatchObject([{ status: 'running', partialText: '附近的书' }, { status: 'completed' }]); expect(fetcher).toHaveBeenCalledWith('/api/v1/ask/sessions/chat/messages', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token', Accept: 'application/x-ndjson' }), credentials: 'omit', cache: 'no-store' }));
  });
  it('reports an interrupted stream without silently resending the message', async () => {
    vi.stubGlobal('navigator', { onLine: true }); const fetcher = vi.fn(async () => new Response(JSON.stringify({ type: 'run', run }) + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } })); vi.stubGlobal('fetch', fetcher);
    await expect(streamAsk('/api/v1/ask/sessions/chat/messages', body, () => undefined)).rejects.toMatchObject({ code: 'NETWORK' }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
