import { AI_LIMITS, ApiRoutes, ConversationPageSchema, ConversationSchema, MessageAttachmentSchema, MessagePageSchema, MessageSchema, type MessageAttachment } from '@neighbourhood/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { useMe } from '../../auth/useMe';
import { Alert, Button, Card, PageHeading, Skeleton } from '../../components/ui';
import { useTextDraft } from '../../lib/textDrafts';
import { t } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { ChevronLeftIcon, SendIcon } from '../../components/icons';
import { PrivateImage } from '../../components/PrivateImage';
import { AttachmentButton } from '../ask/AttachmentButton';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';
import { createRetryKey } from '../activity/retry-key';

export function MessagesPage() {
  const [params] = useSearchParams();
  const selected = params.get('conversation');
  const list = useInfiniteQuery({
    queryKey: ['conversations'], initialPageParam: null as string | null, refetchInterval: 15_000,
    queryFn: ({ signal, pageParam }) => api(`${ApiRoutes.conversations}?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: ConversationPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return <div className={selected ? 'conversation-page mx-auto w-full max-w-3xl' : 'space-y-4'}>
    <PageHeading title="Messages" />
    {selected ? <>
      <Link to="/messages" className="inline-flex min-h-11 items-center gap-1 py-2 text-sm font-semibold text-brand-800"><ChevronLeftIcon />{t('messages.back')}</Link>
      <Thread key={selected} id={selected} />
    </> : <>
      <p className="text-sm text-stone-600">{t('messages.intro')}</p>
      {list.isPending && <Skeleton />}
      {list.isError && <Alert tone="error">{featureError(list.error)} <Button variant="ghost" onClick={() => void list.refetch()}>{t('common.retry')}</Button></Alert>}
      {list.isSuccess && items.length === 0 && <Card className="space-y-2"><h2 className="font-semibold">Your neighbour conversations live here</h2><p className="text-sm text-stone-600">A chat opens after a request is approved, so you can arrange pickup and return.</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline" to="/explore">Find something nearby</Link></Card>}
      {items.map((item) => <Link key={item.id} to={`/messages?conversation=${item.id}`} className="block">
        <Card className="flex items-center justify-between gap-3">
          {item.listingPhotoUrl && <img src={item.listingPhotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
          <div className="min-w-0"><h2 className="break-words font-semibold">{item.listingTitle ?? t('activity.item')}</h2><p className="text-xs text-stone-500">{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : t('messages.noMessages')}</p></div>
          {!!item.unreadCount && <span className="rounded-full bg-brand-700 px-2 py-1 text-xs font-bold text-white">{t('messages.unread', { count: item.unreadCount })}</span>}
        </Card>
      </Link>)}
      {list.hasNextPage && <Button variant="secondary" className="w-full" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('common.loadMore')}</Button>}
    </>}
  </div>;
}

function Thread({ id }: { id: string }) {
  const me = useMe();
  const online = useOnline();
  const qc = useQueryClient();
  const [text, setText] = useTextDraft(`messages:${id}`);
  const scroll = useRef<HTMLDivElement>(null);
  const keys = useRef(createRetryKey());
  const lastRead = useRef<string | null>(null);
  const photoKey = useRef(createRetryKey());
  const [localPhotos, setLocalPhotos] = useState<MessageAttachment[]>([]), [uploadFile, setUploadFile] = useState<File | null>(null), [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { const url = uploadFile ? URL.createObjectURL(uploadFile) : null; setPreview(url); return () => { if (url) URL.revokeObjectURL(url); }; }, [uploadFile]);
  const detail = useQuery({
    queryKey: ['conversations', id], refetchInterval: 15_000,
    queryFn: ({ signal }) => api(`${ApiRoutes.conversations}/${encodeURIComponent(id)}`, { schema: ConversationSchema, signal }),
  });
  const closed = detail.data?.closed ?? true;
  const messages = useInfiniteQuery({
    queryKey: ['messages', id], initialPageParam: null as string | null, refetchInterval: 5_000,
    queryFn: ({ signal, pageParam }) => api(`${ApiRoutes.conversations}/${encodeURIComponent(id)}/messages?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: MessagePageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const newest = messages.data?.pages[0]?.items[0]?.id;
  const { mutate: markRead, ...read } = useMutation({
    mutationFn: (throughMessageId: string) => api(`${ApiRoutes.conversations}/${encodeURIComponent(id)}/read`, { method: 'POST', body: { throughMessageId }, schema: z.null() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications', 'unread'] }); return qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });
  useEffect(() => {
    if (online && newest && lastRead.current !== newest) {
      lastRead.current = newest;
      markRead(newest);
    }
  }, [newest, markRead, online]);
  const send = useMutation({
    mutationFn: () => {
      const body = { body: text.trim(), attachmentIds: photos.map(photo => photo.id) };
      return api(`${ApiRoutes.conversations}/${encodeURIComponent(id)}/messages`, { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: MessageSchema });
    },
    onSuccess: async () => {
      setText(''); keys.current.clear(); setLocalPhotos([]);
      await Promise.all([qc.invalidateQueries({ queryKey: ['messages', id] }), qc.invalidateQueries({ queryKey: ['conversations'] })]);
    },
  });
  const upload = useMutation({ mutationFn: async (file: File) => { if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) || file.size > AI_LIMITS.imageMaxBytes) throw new ApiError('VALIDATION_FAILED', 'Choose JPEG, PNG or WebP under 4 MB', 400); return api(`${ApiRoutes.conversations}/${id}/attachments`, { method: 'POST', binaryBody: file, schema: MessageAttachmentSchema, idempotencyKey: photoKey.current.forPayload({ name: file.name, size: file.size, modified: file.lastModified }) }); }, onSuccess: photo => { setLocalPhotos(old => [...old.filter(item => item.id !== photo.id), photo]); setUploadFile(null); photoKey.current.clear(); void qc.invalidateQueries({ queryKey: ['conversations', id] }); } });
  const remove = useMutation({ mutationFn: (photoId: string) => api(`${ApiRoutes.conversations}/${id}/attachments/${photoId}`, { method: 'DELETE', schema: z.null() }), onSuccess: (_value, photoId) => { setLocalPhotos(old => old.filter(photo => photo.id !== photoId)); void qc.invalidateQueries({ queryKey: ['conversations', id] }); } });
  const items = [...(messages.data?.pages.flatMap((p) => p.items) ?? [])].reverse();
  const used = new Set(items.flatMap(message => message.attachments.map(photo => photo.id)));
  const photos = [...new Map([...(detail.data?.pendingAttachments ?? []), ...localPhotos].filter(photo => !used.has(photo.id)).map(photo => [photo.id, photo])).values()];
  useEffect(() => { const box = scroll.current; if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 220) box.scrollTop = box.scrollHeight; }, [items.length]);
  return <div className="conversation-page">
    {detail.data?.listingTitle && <Link to={detail.data.listingId ? '/listings/' + detail.data.listingId : '/activity'} className="flex shrink-0 items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">{detail.data.listingPhotoUrl && <img src={detail.data.listingPhotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}<div className="min-w-0"><h2 className="break-words font-semibold">{detail.data.listingTitle}</h2><p className="text-sm text-brand-800">View item details</p></div></Link>}
    <div ref={scroll} className="conversation-scroll space-y-3 pr-1">
    {detail.isError && <Alert tone="error">{featureError(detail.error)}</Alert>}
    {messages.isPending && <Skeleton cards={2} />}
    {messages.isError && <Alert tone="error">{featureError(messages.error)} <Button variant="ghost" onClick={() => void messages.refetch()}>{t('common.retry')}</Button></Alert>}
    {messages.hasNextPage && <Button variant="secondary" disabled={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()}>{t('messages.older')}</Button>}
    {messages.isSuccess && items.length === 0 && <Card>{t('messages.start')}</Card>}
    <ol className="space-y-3" aria-label={t('module.messages.title')}>
      {items.map((message) => <li key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.senderId === me.data?.userId ? 'ml-auto bg-brand-700 text-white' : 'bg-white ring-1 ring-stone-200'}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        {message.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.attachments.map(photo => <PrivateImage key={photo.id} path={`${ApiRoutes.conversations}/${id}/attachments/${photo.id}`} alt="Photo in this conversation" />)}</div>}
        <time dateTime={message.createdAt} className="mt-1 block text-xs opacity-70">{new Date(message.createdAt).toLocaleString()}</time>
      </li>)}
    </ol>
    {read.isError && <Alert tone="error">{t('messages.readFailed')} <Button variant="ghost" onClick={() => newest && markRead(newest)}>{t('common.retry')}</Button></Alert>}
    {detail.data?.closed && <Alert>{t('messages.closed')}</Alert>}
    </div>
    {messages.isSuccess && !closed && <form className="composer space-y-2" onSubmit={(e) => { e.preventDefault(); if ((text.trim() || photos.length) && !send.isPending && online && !upload.isPending && !uploadFile && !remove.isPending) send.mutate(); }}>
      {preview && <img src={preview} alt="Selected photo preview" className="h-28 w-28 rounded-xl object-cover" />}
      {!send.isPending && photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map(photo => <div key={photo.id}><PrivateImage path={`${ApiRoutes.conversations}/${id}/attachments/${photo.id}`} alt="Pending message photo" /><Button type="button" variant="ghost" disabled={!online || remove.isPending} onClick={() => remove.mutate(photo.id)}>Remove photo</Button></div>)}</div>}
      <label className="block text-sm font-medium" htmlFor="message-body">{t('messages.compose')}</label>
      <div className="flex items-end gap-2">{detail.data?.imagesAvailable && <AttachmentButton disabled={!online || send.isPending || upload.isPending || photos.length >= 2} uploading={upload.isPending} onFile={file => { if ((AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) && file.size <= AI_LIMITS.imageMaxBytes) setUploadFile(file); upload.mutate(file); }} />}<textarea id="message-body" rows={2} className="min-w-0 flex-1 resize-none text-base" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required={!photos.length} disabled={send.isPending} /><button type="submit" title={t('messages.send')} aria-label={t('messages.send')} disabled={!online || send.isPending || upload.isPending || Boolean(uploadFile) || remove.isPending || (!text.trim() && !photos.length)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-200 disabled:text-stone-500"><SendIcon /></button></div>
      <p className="text-xs text-stone-500">{t('messages.privacy')}</p>
      {send.isError && <Alert tone="error">{featureError(send.error)}</Alert>}
      {upload.isPending && <p role="status" className="text-sm text-brand-800">Uploading photo…</p>}{upload.isError && <Alert tone="error">{featureError(upload.error)}</Alert>}{remove.isError && <Alert tone="error">{featureError(remove.error)}</Alert>}{upload.isError && uploadFile && <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={!online} onClick={() => upload.mutate(uploadFile)}>Retry photo upload</Button><Button type="button" variant="ghost" onClick={() => { setUploadFile(null); upload.reset(); photoKey.current.clear(); }}>Remove selected photo</Button></div>}
    </form>}
  </div>;
}
