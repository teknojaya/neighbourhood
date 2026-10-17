import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  AI_LIMITS, ASK_LIMITS, ApiRoutes, AskAttachmentSchema, AskRunSchema, AskSessionSchema,
  AskSessionDetailSchema, AskSessionPageSchema, AskStatusSchema, type AskMessage, type AskSendBody,
} from '@neighbourhood/shared';
import { Alert, Button, Dialog, Skeleton } from '../../components/ui';
import { CloseIcon, SparkIcon } from '../../components/icons';
import { useTextDraft } from '../../lib/textDrafts';
import { t } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';
import { AskCard, PrivatePhoto } from './AskCards';
import { createRetryKey } from '../activity/retry-key';

export function AskPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('chat');
  const queryClient = useQueryClient();
  const clientId = useRef(crypto.randomUUID());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [newChatKey, setNewChatKey] = useState(() => crypto.randomUUID());
  const status = useQuery({ queryKey: ['ask-status'], queryFn: ({ signal }) => api(`${ApiRoutes.ask}/status`, { schema: AskStatusSchema, signal }) });
  const sessions = useInfiniteQuery({
    queryKey: ['ask-sessions'], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api(`${ApiRoutes.ask}/sessions${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: AskSessionPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: () => api(`${ApiRoutes.ask}/sessions`, { method: 'POST', body: { clientId: clientId.current }, schema: AskSessionSchema }),
    onSuccess: (session) => { clientId.current = crypto.randomUUID(); setCreatedSessionId(session.id); setParams({ chat: session.id }, { replace: true }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); },
  });
  return <div className="conversation-page mx-auto w-full max-w-3xl">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-bold">Ask NeighbourHood</h1>
      <Button type="button" variant="ghost" onClick={() => setHistoryOpen(true)}>History</Button>
    </div>
    <div className="flex shrink-0 items-center justify-between gap-2 text-sm">
      <Link to="/needs/saved" className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline">Saved needs</Link>
      <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => { setCreatedSessionId(null); setNewChatKey(crypto.randomUUID()); setParams({}); }}>New chat</Button>
    </div>
    {historyOpen && <Dialog label="Chat history" onClose={() => setHistoryOpen(false)}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Chat history</h2><Button variant="ghost" aria-label="Close history" onClick={() => setHistoryOpen(false)}><CloseIcon /></Button></div>
        <div className="mt-2 max-h-56 space-y-1 overflow-auto">
          {sessions.isPending && <Skeleton cards={2} />}
          {sessions.isError && <Alert tone="error">{featureError(sessions.error)}</Alert>}
          {sessions.data?.pages.every(page => page.items.length === 0) && <p className="py-4 text-sm text-stone-600">Your chats will appear here after you send a message or add a photo.</p>}
          {sessions.data?.pages.flatMap((p) => p.items).map((session) => <button type="button" key={session.id} className={`block min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm ${sessionId === session.id ? 'bg-brand-50 font-semibold' : 'hover:bg-stone-100'}`} onClick={() => { setCreatedSessionId(null); setParams({ chat: session.id }); setHistoryOpen(false); }}>{session.title}</button>)}
          {sessions.hasNextPage && <Button type="button" variant="ghost" disabled={sessions.isFetchingNextPage} onClick={() => void sessions.fetchNextPage()}>{t('common.loadMore')}</Button>}
        </div>
    </Dialog>}
    {create.isError && <Alert tone="error">{featureError(create.error)}</Alert>}
    {status.isError && <Alert tone="error">{featureError(status.error)}</Alert>}
    {status.data && !status.data.available && <Alert tone="warning">{t('ask.unavailable')}</Alert>}
    {sessionId && !z.uuid().safeParse(sessionId).success ? <Alert tone="error">This chat link is invalid. Start a new chat.</Alert> : <AskChat key={sessionId && sessionId !== createdSessionId ? sessionId : newChatKey} sessionId={sessionId} ensureSession={async () => sessionId ?? (await create.mutateAsync()).id} available={status.data?.available ?? false} imagesAvailable={status.data?.imagesAvailable ?? false} onDelete={() => { setCreatedSessionId(null); setNewChatKey(crypto.randomUUID()); setParams({}); }} />}
  </div>;
}

function AskChat({ sessionId, ensureSession, available, imagesAvailable, onDelete }: { sessionId: string | null; ensureSession(): Promise<string>; available: boolean; imagesAvailable: boolean; onDelete(): void }) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [text, setText] = useTextDraft(`ask:${sessionId ?? 'new'}`);
  const retry = useRef<{ signature: string; body: AskSendBody } | null>(null);
  const [older, setOlder] = useState<{ items: AskMessage[]; before: number | null } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const firstHistory = useRef(false);
  const photoRetry = useRef(createRetryKey());
  const send = useMutation({
    mutationFn: async (body: AskSendBody) => { const id = await ensureSession(); return api(`${ApiRoutes.ask}/sessions/${id}/messages`, { method: 'POST', body, schema: AskRunSchema }); },
    onMutate: () => { void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }); },
    onSuccess: (run) => {
      if (run.status !== 'failed') { setText(''); retry.current = null; }
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['ask-detail'] }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); },
  });
  const detail = useQuery({
    queryKey: ['ask-detail', sessionId],
    enabled: Boolean(sessionId),
    queryFn: ({ signal }) => api(`${ApiRoutes.ask}/sessions/${sessionId}`, { schema: AskSessionDetailSchema, signal }),
    refetchInterval: (query) => send.isPending || query.state.data?.latestRun?.status === 'running' || query.state.data?.messages.items.some((m) => m.parts.some((p) => p.kind === 'action' && p.action.status === 'executing')) ? 2000 : false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) || file.size > AI_LIMITS.imageMaxBytes) throw new ApiError('VALIDATION_FAILED', 'Use a JPEG, PNG or WebP under 4 MB', 400);
      const id = await ensureSession();
      return api(`${ApiRoutes.ask}/sessions/${id}/attachments`, { method: 'POST', binaryBody: file, schema: AskAttachmentSchema,
        idempotencyKey: photoRetry.current.forPayload({ name: file.name, size: file.size, type: file.type, modified: file.lastModified }) });
    },
    onSuccess: () => photoRetry.current.clear(),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ask-detail'] }),
  });
  const removePhoto = useMutation({
    mutationFn: (id: string) => api(`${ApiRoutes.ask}/sessions/${sessionId}/attachments/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }),
  });
  const removeChat = useMutation({
    mutationFn: () => api(`${ApiRoutes.ask}/sessions/${sessionId}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => { queryClient.removeQueries({ queryKey: ['ask-detail', sessionId] }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); onDelete(); },
  });
  const stop = useMutation({
    mutationFn: () => api(`${ApiRoutes.ask}/sessions/${sessionId}/stop`, { method: 'POST', schema: z.null() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }),
  });
  const loadOlder = useMutation({
    mutationFn: () => api(`${ApiRoutes.ask}/sessions/${sessionId}?before=${older?.before ?? detail.data?.messages.beforeSequence}`, { schema: AskSessionDetailSchema }),
    onSuccess: (page) => setOlder((old) => ({ items: [...page.messages.items, ...(old?.items ?? [])], before: page.messages.beforeSequence })),
  });
  const isRunning = send.isPending || detail.data?.latestRun?.status === 'running';
  const photos = detail.data?.pendingAttachments ?? [];
  const failedRun = detail.data?.latestRun?.status === 'failed' ? detail.data.latestRun : null;
  const messages = [...new Map([...(older?.items ?? []), ...(detail.data?.messages.items ?? [])].map((m) => [m.id, m])).values()].sort((a, b) => a.sequence - b.sequence);
  useEffect(() => {
    const box = historyRef.current;
    if (!box || !detail.data) return;
    if (!firstHistory.current || box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
    firstHistory.current = true;
  }, [messages.length, detail.data?.latestRun?.partialText, detail.data]);
  const completedClientId = detail.data?.latestRun?.status === 'completed' ? detail.data.latestRun.clientMessageId : null;
  const resetSend = send.reset;
  useEffect(() => {
    if (!completedClientId || retry.current?.body.clientMessageId !== completedClientId) return;
    const completedText = retry.current.body.text;
    retry.current = null;
    setText((current) => current.trim() === completedText ? '' : current);
    resetSend();
  }, [completedClientId, resetSend, setText]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!online || !available || isRunning || upload.isPending || removePhoto.isPending || (!text.trim() && !photos.length)) return;
    const payload = { text: text.trim(), attachmentIds: photos.slice(0, ASK_LIMITS.attachmentsPerMessage).map((a) => a.id) };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature) retry.current = { signature, body: { ...payload, clientMessageId: crypto.randomUUID() } };
    send.mutate(retry.current.body);
  }

  function retryTurn() {
    const message = [...messages].reverse().find((m) => m.role === 'user');
    if (!failedRun || !message) return;
    send.mutate({ clientMessageId: failedRun.clientMessageId, text: message.text, attachmentIds: message.attachments.map((a) => a.id) });
  }

  return <div className="conversation-page">
    {sessionId && <div className="flex shrink-0 items-center justify-between gap-2">
      <h2 className="min-w-0 break-words font-semibold">{detail.data?.session.title ?? t('ask.newChat')}</h2>
      <Button type="button" variant="ghost" disabled={isRunning || removeChat.isPending || !online} onClick={() => { if (window.confirm(t('ask.deleteConfirm'))) removeChat.mutate(); }}>{t('ask.delete')}</Button>
    </div>}
    {sessionId && detail.isPending && <Skeleton cards={1} />}
    {detail.isError && <Alert tone="error">{featureError(detail.error)}</Alert>}
    {removeChat.isError && <Alert tone="error">{featureError(removeChat.error)}</Alert>}
    <div ref={historyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1" aria-label={t('ask.history')}>
      {(older ? older.before !== null : detail.data?.messages.beforeSequence != null) && <Button type="button" variant="secondary" disabled={loadOlder.isPending} onClick={() => loadOlder.mutate()}>{t('ask.older')}</Button>}
      {loadOlder.isError && <Alert tone="error">{featureError(loadOlder.error)}</Alert>}
      {messages.length === 0 && <div className="mx-auto max-w-md space-y-4 py-5 sm:py-10"><div className="text-brand-700"><SparkIcon /></div><h2 className="text-2xl font-bold tracking-tight">A little help from your neighbourhood.</h2><p className="text-sm leading-relaxed text-stone-600">Find something you need, give an item a new home, or arrange a loan. You review every change before it happens.</p><div className="flex flex-wrap gap-2">{(['find', 'donate', 'borrow'] as const).map(kind => <Button key={kind} variant="secondary" type="button" onClick={() => { setText(t(`ask.prompt.${kind}`)); inputRef.current?.focus(); }}>{t(`ask.starter.${kind}`)}</Button>)}</div></div>}
      {messages.map((message) => <article key={message.id} className={`space-y-3 ${message.role === 'user' ? 'ml-6 rounded-2xl bg-brand-50 p-3' : 'mr-2'}`}>
        <p className="text-xs font-semibold text-stone-500">{message.role === 'user' ? t('ask.you') : t('ask.assistant')}</p>
        {sessionId && message.attachments.length > 0 && <div className="flex flex-wrap gap-2">{message.attachments.map((attachment) => <PrivatePhoto key={attachment.id} sessionId={sessionId} attachment={attachment} />)}</div>}
        {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>}
        {sessionId && message.parts.map((part, index) => <AskCard key={index} part={part} sessionId={sessionId} onEditDraft={() => { setText(t('ask.editDraftPrompt')); inputRef.current?.focus(); }} />)}
      </article>)}
      {isRunning && <Alert><p role="status">{({ thinking: 'Thinking…', searching: 'Looking nearby…', reading: 'Checking your activity…', preparing: 'Preparing a review card…', answering: 'Writing a reply…' } as const)[detail.data?.latestRun?.progress ?? 'thinking']}</p>{detail.data?.latestRun?.partialText && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{detail.data.latestRun.partialText}</p>}</Alert>}
      {failedRun && <Alert tone="error"><p>{featureError(new ApiError(failedRun.errorCode ?? 'INTERNAL', '', 0))}</p><Button type="button" variant="secondary" disabled={isRunning || !online || !available} onClick={retryTurn}>{t('common.retry')}</Button></Alert>}
      {send.isError && <Alert tone="error">{featureError(send.error)}</Alert>}
      {stop.isError && <Alert tone="error">{featureError(stop.error)}</Alert>}
    </div>
    <form onSubmit={submit} className="composer space-y-2">
      {sessionId && photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((attachment) => <div key={attachment.id} className="space-y-1"><PrivatePhoto sessionId={sessionId} attachment={attachment} /><Button type="button" variant="ghost" disabled={isRunning || removePhoto.isPending || !online} onClick={() => removePhoto.mutate(attachment.id)}>{t('ask.removePhoto')}</Button></div>)}</div>}
      {upload.isError && <Alert tone="error">{featureError(upload.error)}</Alert>}
      {removePhoto.isError && <Alert tone="error">{featureError(removePhoto.error)}</Alert>}
      <label className="sr-only" htmlFor="ask-message">{t('ask.message')}</label>
      <textarea ref={inputRef} id="ask-message" value={text} onChange={(event) => setText(event.target.value)} maxLength={ASK_LIMITS.textChars} rows={2} placeholder={t('ask.placeholder')} disabled={isRunning} className="block w-full resize-none rounded-xl border border-stone-300 bg-white p-3 text-base disabled:bg-stone-100" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {imagesAvailable && <label className="inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-semibold text-brand-800">Camera<input aria-label="Take photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={!online || isRunning || upload.isPending || photos.length >= ASK_LIMITS.attachmentsPerMessage} onChange={event => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} /></label>}
        {imagesAvailable && <label className="cursor-pointer rounded-xl px-2 py-2 text-sm font-semibold text-brand-800">{upload.isPending ? t('ask.uploading') : t('ask.attach')}
          <input aria-label={t('ask.attach')} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!online || isRunning || upload.isPending || photos.length >= ASK_LIMITS.attachmentsPerMessage} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} />
        </label>}
        {isRunning ? <Button type="button" variant="secondary" disabled={!online || stop.isPending} onClick={() => stop.mutate()}>{t('ask.stop')}</Button>
          : <Button type="submit" disabled={!available || !online || upload.isPending || removePhoto.isPending || (!text.trim() && photos.length === 0)}>{t('ask.send')}</Button>}
      </div>
      <details className="text-xs text-stone-600"><summary className="cursor-pointer">{t('ask.privacySummary')}</summary><p className="pt-1">{t('ask.privacy')}</p></details>
    </form>
  </div>;
}
