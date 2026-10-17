import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  AI_LIMITS, ASK_LIMITS, ApiRoutes, AskAttachmentSchema, AskRunSchema, AskSessionSchema,
  AskSessionDetailSchema, AskSessionPageSchema, AskStatusSchema, type AskMessage, type AskSendBody,
} from '@neighbourhood/shared';
import { Alert, Button, Card } from '../../components/ui';
import { t } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';
import { AskCard, PrivatePhoto } from './AskCards';
import { createRetryKey } from '../activity/retry-key';

export function AskPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('chat');
  const online = useOnline();
  const queryClient = useQueryClient();
  const clientId = useRef(crypto.randomUUID());
  const [prompt, setPrompt] = useState('');
  const status = useQuery({ queryKey: ['ask-status'], queryFn: ({ signal }) => api(`${ApiRoutes.ask}/status`, { schema: AskStatusSchema, signal }) });
  const sessions = useInfiniteQuery({
    queryKey: ['ask-sessions'], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api(`${ApiRoutes.ask}/sessions${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: AskSessionPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: () => api(`${ApiRoutes.ask}/sessions`, { method: 'POST', body: { clientId: clientId.current }, schema: AskSessionSchema }),
    onSuccess: (session) => { clientId.current = crypto.randomUUID(); setParams({ chat: session.id }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); },
  });
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{t('ask.title')}</h1>
      <Link to="/needs/saved" className="text-sm font-semibold text-brand-800 underline">{t('needs.savedTitle')}</Link>
    </div>
    <div className="flex items-start gap-2">
      <details className="min-w-0 flex-1 rounded-xl bg-white p-3 ring-1 ring-stone-200">
        <summary className="cursor-pointer text-sm font-semibold">{t('ask.history')}</summary>
        <div className="mt-2 max-h-56 space-y-1 overflow-auto">
          {sessions.isPending && <p>{t('common.loading')}</p>}
          {sessions.isError && <Alert tone="error">{featureError(sessions.error)}</Alert>}
          {sessions.data?.pages.flatMap((p) => p.items).map((session) => <button type="button" key={session.id} className={`block min-h-11 w-full rounded-xl px-2 text-left text-sm ${sessionId === session.id ? 'bg-brand-50 font-semibold' : ''}`} onClick={() => { setPrompt(''); setParams({ chat: session.id }); }}>{session.title}</button>)}
          {sessions.hasNextPage && <Button type="button" variant="ghost" disabled={sessions.isFetchingNextPage} onClick={() => void sessions.fetchNextPage()}>{t('common.loadMore')}</Button>}
        </div>
      </details>
      <Button type="button" variant="secondary" disabled={create.isPending || !online} onClick={() => { setPrompt(''); create.mutate(); }}>{t('ask.newChat')}</Button>
    </div>
    {create.isError && <Alert tone="error">{featureError(create.error)}</Alert>}
    {status.isError && <Alert tone="error">{featureError(status.error)}</Alert>}
    {status.data && !status.data.available && <Alert tone="warning">{t('ask.unavailable')}</Alert>}
    {sessionId && z.uuid().safeParse(sessionId).success
      ? <AskChat key={sessionId} sessionId={sessionId} available={status.data?.available ?? false} imagesAvailable={status.data?.imagesAvailable ?? false} initialPrompt={prompt} onDelete={() => { setParams({}); }} />
      : <Card className="space-y-4">
        <p>{t('ask.intro')}</p>
        <p className="text-sm text-stone-600">{t('ask.capabilities')}</p>
        <div className="flex flex-wrap gap-2">{(['donate', 'remember', 'requests'] as const).map((kind) => <Button type="button" variant="secondary" key={kind} disabled={create.isPending || !online} onClick={() => { setPrompt(t(`ask.prompt.${kind}`)); create.mutate(); }}>{t(`ask.starter.${kind}`)}</Button>)}</div>
      </Card>}
  </div>;
}

function AskChat({ sessionId, available, imagesAvailable, initialPrompt, onDelete }: { sessionId: string; available: boolean; imagesAvailable: boolean; initialPrompt: string; onDelete(): void }) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [text, setText] = useState(initialPrompt);
  const retry = useRef<{ signature: string; body: AskSendBody } | null>(null);
  const [older, setOlder] = useState<{ items: AskMessage[]; before: number | null } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoRetry = useRef(createRetryKey());
  const send = useMutation({
    mutationFn: (body: AskSendBody) => api(`${ApiRoutes.ask}/sessions/${sessionId}/messages`, { method: 'POST', body, schema: AskRunSchema }),
    onMutate: () => { void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }); },
    onSuccess: (run) => {
      if (run.status !== 'failed') { setText(''); retry.current = null; }
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); },
  });
  const detail = useQuery({
    queryKey: ['ask-detail', sessionId],
    queryFn: ({ signal }) => api(`${ApiRoutes.ask}/sessions/${sessionId}`, { schema: AskSessionDetailSchema, signal }),
    refetchInterval: (query) => send.isPending || query.state.data?.latestRun?.status === 'running' || query.state.data?.messages.items.some((m) => m.parts.some((p) => p.kind === 'action' && p.action.status === 'executing')) ? 2000 : false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) || file.size > AI_LIMITS.imageMaxBytes) throw new ApiError('VALIDATION_FAILED', 'Use a JPEG, PNG or WebP under 4 MB', 400);
      return api(`${ApiRoutes.ask}/sessions/${sessionId}/attachments`, { method: 'POST', binaryBody: file, schema: AskAttachmentSchema,
        idempotencyKey: photoRetry.current.forPayload({ name: file.name, size: file.size, type: file.type, modified: file.lastModified }) });
    },
    onSuccess: () => photoRetry.current.clear(),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }),
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
  const completedClientId = detail.data?.latestRun?.status === 'completed' ? detail.data.latestRun.clientMessageId : null;
  const resetSend = send.reset;
  useEffect(() => {
    if (!completedClientId || retry.current?.body.clientMessageId !== completedClientId) return;
    const completedText = retry.current.body.text;
    retry.current = null;
    setText((current) => current.trim() === completedText ? '' : current);
    resetSend();
  }, [completedClientId, resetSend]);

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

  return <div className="flex min-h-[calc(100dvh-17rem)] flex-col gap-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="min-w-0 break-words font-semibold">{detail.data?.session.title ?? t('ask.newChat')}</h2>
      <Button type="button" variant="ghost" disabled={isRunning || removeChat.isPending || !online} onClick={() => { if (window.confirm(t('ask.deleteConfirm'))) removeChat.mutate(); }}>{t('ask.delete')}</Button>
    </div>
    {detail.isPending && <Alert>{t('common.loading')}</Alert>}
    {detail.isError && <Alert tone="error">{featureError(detail.error)}</Alert>}
    {removeChat.isError && <Alert tone="error">{featureError(removeChat.error)}</Alert>}
    <div className="flex-1 space-y-4" aria-label={t('ask.history')}>
      {(older ? older.before !== null : detail.data?.messages.beforeSequence != null) && <Button type="button" variant="secondary" disabled={loadOlder.isPending} onClick={() => loadOlder.mutate()}>{t('ask.older')}</Button>}
      {loadOlder.isError && <Alert tone="error">{featureError(loadOlder.error)}</Alert>}
      {messages.length === 0 && <p className="text-sm text-stone-600">{t('ask.capabilities')}</p>}
      {messages.map((message) => <article key={message.id} className={`space-y-3 ${message.role === 'user' ? 'ml-6 rounded-2xl bg-brand-50 p-3' : 'mr-2'}`}>
        <p className="text-xs font-semibold text-stone-500">{message.role === 'user' ? t('ask.you') : t('ask.assistant')}</p>
        {message.attachments.length > 0 && <div className="flex flex-wrap gap-2">{message.attachments.map((attachment) => <PrivatePhoto key={attachment.id} sessionId={sessionId} attachment={attachment} />)}</div>}
        {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>}
        {message.parts.map((part, index) => <AskCard key={index} part={part} sessionId={sessionId} onEditDraft={() => { setText(t('ask.editDraftPrompt')); inputRef.current?.focus(); }} />)}
      </article>)}
      {isRunning && <Alert>{t('ask.thinking')}</Alert>}
      {failedRun && <Alert tone="error"><p>{featureError(new ApiError(failedRun.errorCode ?? 'INTERNAL', '', 0))}</p><Button type="button" variant="secondary" disabled={isRunning || !online || !available} onClick={retryTurn}>{t('common.retry')}</Button></Alert>}
      {send.isError && <Alert tone="error">{featureError(send.error)}</Alert>}
      {stop.isError && <Alert tone="error">{featureError(stop.error)}</Alert>}
    </div>
    <form onSubmit={submit} className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] space-y-2 rounded-2xl bg-stone-50/95 p-3 shadow-sm ring-1 ring-stone-200 backdrop-blur">
      {photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((attachment) => <div key={attachment.id} className="space-y-1"><PrivatePhoto sessionId={sessionId} attachment={attachment} /><Button type="button" variant="ghost" disabled={isRunning || removePhoto.isPending || !online} onClick={() => removePhoto.mutate(attachment.id)}>{t('ask.removePhoto')}</Button></div>)}</div>}
      {upload.isError && <Alert tone="error">{featureError(upload.error)}</Alert>}
      {removePhoto.isError && <Alert tone="error">{featureError(removePhoto.error)}</Alert>}
      <label className="sr-only" htmlFor="ask-message">{t('ask.message')}</label>
      <textarea ref={inputRef} id="ask-message" value={text} onChange={(event) => setText(event.target.value)} maxLength={ASK_LIMITS.textChars} rows={2} placeholder={t('ask.placeholder')} disabled={isRunning} className="block w-full resize-none rounded-xl border border-stone-300 bg-white p-3 text-base disabled:bg-stone-100" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {imagesAvailable && <label className="cursor-pointer rounded-xl px-2 py-2 text-sm font-semibold text-brand-800">{upload.isPending ? t('ask.uploading') : t('ask.attach')}
          <input aria-label={t('ask.attach')} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!online || isRunning || upload.isPending || photos.length >= ASK_LIMITS.attachmentsPerMessage} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} />
        </label>}
        {isRunning ? <Button type="button" variant="secondary" disabled={!online || stop.isPending} onClick={() => stop.mutate()}>{t('ask.stop')}</Button>
          : <Button type="submit" disabled={!available || !online || upload.isPending || removePhoto.isPending || (!text.trim() && photos.length === 0)}>{t('ask.send')}</Button>}
      </div>
      <details className="text-xs text-stone-500"><summary className="cursor-pointer">{t('ask.privacySummary')}</summary><p className="pt-1">{t('ask.privacy')}</p></details>
    </form>
  </div>;
}
