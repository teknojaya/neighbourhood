import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  AI_LIMITS, ASK_LIMITS, ApiRoutes, AskAttachmentSchema, AskSessionSchema,
  AskSessionDetailSchema, AskSessionPageSchema, AskStatusSchema, type AskAttachment, type AskRun, type AskMessage, type AskSendBody,
} from '@neighbourhood/shared';
import { ActionPill, Alert, Button, Dialog, pillActionClass, Skeleton } from '../../components/ui';
import { BookmarkIcon, BoxIcon, CloseIcon, HistoryIcon, PlusIcon, SearchIcon, SendIcon, SparkIcon, TrashIcon } from '../../components/icons';
import { AttachmentButton } from './AttachmentButton';
import { useTextDraft } from '../../lib/textDrafts';
import { t } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';
import { AskCard, PrivatePhoto } from './AskCards';
import { createRetryKey } from '../activity/retry-key';
import { streamAsk } from '../../lib/askStream';

function answeredSearchRadius(messages: AskMessage[], before: number) {
  const history = messages.filter(message => message.sequence < before);
  return history.some((message, index) => message.role === 'user' && (
    /\b\d{1,2}\s*(?:km|kilomet(?:er|re)s?)\b/i.test(message.text)
    || /^\s*\d{1,2}\s*$/.test(message.text) && /radius|distance|how far|jarak|seberapa jauh/i.test(history[index - 1]?.text ?? '')
  ));
}

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
      <ActionPill type="button" onClick={() => setHistoryOpen(true)}><HistoryIcon />History</ActionPill>
    </div>
    <div className="flex shrink-0 items-center justify-between gap-2 text-sm">
      <Link to="/needs/saved" className={pillActionClass}><BookmarkIcon />Saved needs</Link>
      <ActionPill type="button" disabled={create.isPending} onClick={() => { setCreatedSessionId(null); setNewChatKey(crypto.randomUUID()); setParams({}); }}><PlusIcon />New chat</ActionPill>
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
  const followReply = useRef(false);
  const photoRetry = useRef(createRetryKey());
  const streamController = useRef<AbortController | null>(null);
  const [liveRun, setLiveRun] = useState<AskRun | null>(null);
  const [connected, setConnected] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<AskAttachment[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<{ body: AskSendBody; attachments: AskAttachment[] } | null>(null);
  useEffect(() => { const url = uploadFile ? URL.createObjectURL(uploadFile) : null; setPreviewUrl(url); return () => { if (url) URL.revokeObjectURL(url); }; }, [uploadFile]);
  useEffect(() => () => streamController.current?.abort(), []);
  const send = useMutation({
    mutationFn: async (body: AskSendBody) => {
      const id = await ensureSession(); const controller = new AbortController(); streamController.current = controller; setConnected(true);
      let first = true;
      try { return await streamAsk(`${ApiRoutes.ask}/sessions/${id}/messages`, body, run => { setLiveRun(run); if (first) { first = false; void queryClient.invalidateQueries({ queryKey: ['ask-detail', id] }); } }, controller.signal); }
      finally { setConnected(false); }
    },
    onMutate: body => { followReply.current = true; setLiveRun(null); setOptimistic({ body, attachments: photos.filter(photo => body.attachmentIds.includes(photo.id)) }); },
    onSuccess: async (run, body) => {
      await queryClient.invalidateQueries({ queryKey: ['ask-detail'] });
      if (run.status !== 'failed') { setText(''); retry.current = null; }
      setLocalPhotos(old => old.filter(photo => !body.attachmentIds.includes(photo.id))); setOptimistic(null); setLiveRun(null);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['ask-detail'] }); void queryClient.invalidateQueries({ queryKey: ['ask-sessions'] }); },
  });
  const detail = useQuery({
    queryKey: ['ask-detail', sessionId],
    enabled: Boolean(sessionId),
    queryFn: ({ signal }) => api(`${ApiRoutes.ask}/sessions/${sessionId}`, { schema: AskSessionDetailSchema, signal }),
    refetchInterval: (query) => (!connected && (send.isPending || query.state.data?.latestRun?.status === 'running')) || query.state.data?.messages.items.some((m) => m.parts.some((p) => p.kind === 'action' && p.action.status === 'executing')) ? 2000 : false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) || file.size > AI_LIMITS.imageMaxBytes) throw new ApiError('VALIDATION_FAILED', 'Use a JPEG, PNG or WebP under 4 MB', 400);
      const id = await ensureSession();
      return api(`${ApiRoutes.ask}/sessions/${id}/attachments`, { method: 'POST', binaryBody: file, schema: AskAttachmentSchema,
        idempotencyKey: photoRetry.current.forPayload({ name: file.name, size: file.size, type: file.type, modified: file.lastModified }) });
    },
    onSuccess: photo => { photoRetry.current.clear(); setLocalPhotos(old => [...old.filter(item => item.id !== photo.id), photo]); setUploadFile(null); },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ask-detail'] }),
  });
  const removePhoto = useMutation({
    mutationFn: (id: string) => api(`${ApiRoutes.ask}/sessions/${sessionId}/attachments/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: (_result, id) => { setLocalPhotos(old => old.filter(photo => photo.id !== id)); void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] }); },
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
  const activeRun = connected ? liveRun ?? detail.data?.latestRun : detail.data?.latestRun ?? liveRun;
  const isRunning = send.isPending || activeRun?.status === 'running';
  const usedPhotos = new Set(detail.data?.messages.items.flatMap(message => message.attachments.map(photo => photo.id)) ?? []);
  if (send.isPending) send.variables?.attachmentIds.forEach(id => usedPhotos.add(id));
  const photos = [...new Map([...(detail.data?.pendingAttachments ?? []), ...localPhotos].filter(photo => !usedPhotos.has(photo.id)).map(photo => [photo.id, photo])).values()];
  const failedRun = detail.data?.latestRun?.status === 'failed' ? detail.data.latestRun : null;
  const messages = [...new Map([...(older?.items ?? []), ...(detail.data?.messages.items ?? [])].map((m) => [m.id, m])).values()].sort((a, b) => a.sequence - b.sequence);
  useEffect(() => {
    const box = historyRef.current;
    if (!box || !detail.data) return;
    if (followReply.current || !firstHistory.current || box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
    if (!isRunning) followReply.current = false;
    firstHistory.current = true;
  }, [messages.length, activeRun?.partialText, detail.data, optimistic, isRunning]);
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
    if (!online || !available || isRunning || upload.isPending || uploadFile || removePhoto.isPending || (!text.trim() && !photos.length)) return;
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
      <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 disabled:text-stone-400" title={t('ask.delete')} aria-label={t('ask.delete')} disabled={isRunning || removeChat.isPending || !online} onClick={() => { if (window.confirm(t('ask.deleteConfirm'))) removeChat.mutate(); }}><TrashIcon /></button>
    </div>}
    {sessionId && detail.isPending && <Skeleton cards={1} />}
    {detail.isError && <Alert tone="error">{featureError(detail.error)}</Alert>}
    {removeChat.isError && <Alert tone="error">{featureError(removeChat.error)}</Alert>}
    <div ref={historyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1" aria-label={t('ask.history')}>
      {(older ? older.before !== null : detail.data?.messages.beforeSequence != null) && <Button type="button" variant="secondary" disabled={loadOlder.isPending} onClick={() => loadOlder.mutate()}>{t('ask.older')}</Button>}
      {loadOlder.isError && <Alert tone="error">{featureError(loadOlder.error)}</Alert>}
      {messages.length === 0 && !optimistic && <div className="mx-auto max-w-md space-y-4 py-5 sm:py-10"><div className="text-brand-700"><SparkIcon /></div><h2 className="text-2xl font-bold tracking-tight">A little help from your neighbourhood.</h2><p className="text-sm leading-relaxed text-stone-600">Find something you need, give an item a new home, or arrange a loan. You review every change before it happens.</p><div className="flex flex-wrap gap-2">{(['find', 'donate', 'borrow'] as const).map(kind => <ActionPill key={kind} type="button" onClick={() => { setText(t(`ask.prompt.${kind}`)); inputRef.current?.focus(); }}>{kind === 'find' ? <SearchIcon /> : kind === 'donate' ? <PlusIcon /> : <BoxIcon />}{t(`ask.starter.${kind}`)}</ActionPill>)}</div></div>}
      {messages.map((message) => <article key={message.id} className={`space-y-3 ${message.role === 'user' ? 'ml-6 rounded-2xl bg-brand-50 p-3' : 'mr-2'}`}>
        <p className="text-xs font-semibold text-stone-500">{message.role === 'user' ? t('ask.you') : t('ask.assistant')}</p>
        {sessionId && message.attachments.length > 0 && <div className="flex flex-wrap gap-2">{message.attachments.map((attachment) => <PrivatePhoto key={attachment.id} sessionId={sessionId} attachment={attachment} />)}</div>}
        {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text === 'Before I continue:' ? message.parts.flatMap(part => part.kind === 'questions' ? part.questions.map(question => question.question) : []).join('\n\n') || message.text : message.text}</p>}
        {sessionId && message.parts.filter(part => !message.parts.some(item => item.kind === 'questions') || !['listing_draft', 'action'].includes(part.kind)).map((part, index) => <AskCard key={index} part={part} sessionId={sessionId} disabled={isRunning} active={!messages.some(next => next.role === 'user' && next.sequence > message.sequence) && !optimistic} radiusAnswered={answeredSearchRadius(messages, message.sequence)} onReply={reply => { setText(reply); inputRef.current?.focus(); }} onEditDraft={() => { setText(t('ask.editDraftPrompt')); inputRef.current?.focus(); }} />)}
      </article>)}
      {optimistic && detail.data?.latestRun?.clientMessageId !== optimistic.body.clientMessageId && <article className="ml-6 space-y-3 rounded-2xl bg-brand-50 p-3"><p className="text-xs font-semibold text-stone-500">{t('ask.you')}</p>{sessionId && <div className="flex flex-wrap gap-2">{optimistic.attachments.map(photo => <PrivatePhoto key={photo.id} sessionId={sessionId} attachment={photo} />)}</div>}<p className="whitespace-pre-wrap break-words text-sm">{optimistic.body.text}</p></article>}
      {isRunning && <div className="mr-2 space-y-2" aria-label="Assistant response"><p role="status" className="text-sm text-brand-800">{({ thinking: 'Thinking…', searching: 'Looking nearby…', reading: 'Checking your activity…', preparing: 'Preparing your next step…', answering: 'Writing a reply…' } as const)[activeRun?.progress ?? 'thinking']}</p>{activeRun?.partialText && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{activeRun.partialText}</p>}</div>}
      {failedRun && <Alert tone="error"><p>{featureError(new ApiError(failedRun.errorCode ?? 'INTERNAL', '', 0))}</p><Button type="button" variant="secondary" disabled={isRunning || !online || !available} onClick={retryTurn}>{t('common.retry')}</Button></Alert>}
      {send.isError && <Alert tone="error">{featureError(send.error)}</Alert>}
      {stop.isError && <Alert tone="error">{featureError(stop.error)}</Alert>}
    </div>
    <form onSubmit={submit} className="composer space-y-2">
      {previewUrl && <img src={previewUrl} alt="Selected photo preview" className="h-28 w-28 rounded-xl object-cover" />}
      {sessionId && photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((attachment) => <div key={attachment.id} className="space-y-1"><PrivatePhoto sessionId={sessionId} attachment={attachment} /><Button type="button" variant="ghost" disabled={isRunning || removePhoto.isPending || !online} onClick={() => removePhoto.mutate(attachment.id)}>{t('ask.removePhoto')}</Button></div>)}</div>}
      {upload.isError && <Alert tone="error">{featureError(upload.error)}</Alert>}
      {upload.isError && uploadFile && <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={!online || upload.isPending} onClick={() => upload.mutate(uploadFile)}>Retry photo upload</Button><Button type="button" variant="ghost" onClick={() => { setUploadFile(null); upload.reset(); photoRetry.current.clear(); }}>Remove selected photo</Button></div>}
      {removePhoto.isError && <Alert tone="error">{featureError(removePhoto.error)}</Alert>}
      <label className="sr-only" htmlFor="ask-message">{t('ask.message')}</label>
      <div className="flex items-end gap-2">
        {imagesAvailable && <AttachmentButton uploading={upload.isPending} disabled={!online || isRunning || upload.isPending || photos.length >= ASK_LIMITS.attachmentsPerMessage} onFile={file => { if ((AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) && file.size <= AI_LIMITS.imageMaxBytes) setUploadFile(file); upload.mutate(file); }} />}
        <textarea ref={inputRef} id="ask-message" value={text} onChange={(event) => setText(event.target.value)} maxLength={ASK_LIMITS.textChars} rows={2} placeholder={t('ask.placeholder')} disabled={isRunning} className="block min-w-0 flex-1 resize-none bg-white text-base disabled:bg-stone-100" />
        {isRunning ? <Button type="button" variant="secondary" disabled={!online || stop.isPending} onClick={() => stop.mutate()}>{t('ask.stop')}</Button>
          : <button type="submit" aria-label={t('ask.send')} title={t('ask.send')} disabled={!available || !online || upload.isPending || Boolean(uploadFile) || removePhoto.isPending || (!text.trim() && photos.length === 0)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-200 disabled:text-stone-500"><SendIcon /></button>}
      </div>
      {upload.isPending && <p role="status" className="text-sm text-brand-800">Uploading photo…</p>}
      <details className="text-xs text-stone-600"><summary className="cursor-pointer">{t('ask.privacySummary')}</summary><p className="pt-1">{t('ask.privacy')}</p></details>
    </form>
  </div>;
}
