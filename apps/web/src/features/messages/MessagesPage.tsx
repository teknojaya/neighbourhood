import { ApiRoutes, ConversationPageSchema, ConversationSchema, MessagePageSchema, MessageSchema } from '@neighbourhood/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { useMe } from '../../auth/useMe';
import { Alert, Button, Card, PageHeading, Skeleton } from '../../components/ui';
import { useTextDraft } from '../../lib/textDrafts';
import { t } from '../../i18n';
import { api } from '../../lib/api';
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
      <Link to="/messages" className="inline-block min-h-11 py-3 text-sm font-semibold text-brand-800 underline">{t('messages.back')}</Link>
      <Thread key={selected} id={selected} />
    </> : <>
      <p className="text-sm text-stone-600">{t('messages.intro')}</p>
      {list.isPending && <Skeleton />}
      {list.isError && <Alert tone="error">{featureError(list.error)} <Button variant="ghost" onClick={() => void list.refetch()}>{t('common.retry')}</Button></Alert>}
      {list.isSuccess && items.length === 0 && <Card className="space-y-2"><h2 className="font-semibold">Your neighbour conversations live here</h2><p className="text-sm text-stone-600">A chat opens after a request is approved, so you can arrange pickup and return.</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline" to="/explore">Find something nearby</Link></Card>}
      {items.map((item) => <Link key={item.id} to={`/messages?conversation=${item.id}`} className="block">
        <Card className="flex items-center justify-between gap-3">
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
      const body = { body: text.trim() };
      return api(`${ApiRoutes.conversations}/${encodeURIComponent(id)}/messages`, { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: MessageSchema });
    },
    onSuccess: async () => {
      setText(''); keys.current.clear();
      await Promise.all([qc.invalidateQueries({ queryKey: ['messages', id] }), qc.invalidateQueries({ queryKey: ['conversations'] })]);
    },
  });
  const items = [...(messages.data?.pages.flatMap((p) => p.items) ?? [])].reverse();
  useEffect(() => { const box = scroll.current; if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 220) box.scrollTop = box.scrollHeight; }, [items.length]);
  return <div className="conversation-page">
    {detail.data?.listingTitle && <h2 className="font-semibold">{detail.data.listingTitle}</h2>}
    <div ref={scroll} className="conversation-scroll space-y-3 pr-1">
    {detail.isError && <Alert tone="error">{featureError(detail.error)}</Alert>}
    {messages.isPending && <Skeleton cards={2} />}
    {messages.isError && <Alert tone="error">{featureError(messages.error)} <Button variant="ghost" onClick={() => void messages.refetch()}>{t('common.retry')}</Button></Alert>}
    {messages.hasNextPage && <Button variant="secondary" disabled={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()}>{t('messages.older')}</Button>}
    {messages.isSuccess && items.length === 0 && <Card>{t('messages.start')}</Card>}
    <ol className="space-y-3" aria-label={t('module.messages.title')}>
      {items.map((message) => <li key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.senderId === me.data?.userId ? 'ml-auto bg-brand-700 text-white' : 'bg-white ring-1 ring-stone-200'}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <time dateTime={message.createdAt} className="mt-1 block text-xs opacity-70">{new Date(message.createdAt).toLocaleString()}</time>
      </li>)}
    </ol>
    {read.isError && <Alert tone="error">{t('messages.readFailed')} <Button variant="ghost" onClick={() => newest && markRead(newest)}>{t('common.retry')}</Button></Alert>}
    {detail.data?.closed && <Alert>{t('messages.closed')}</Alert>}
    </div>
    {messages.isSuccess && !closed && <form className="composer space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !send.isPending && online) send.mutate(); }}>
      <label className="block text-sm font-medium" htmlFor="message-body">{t('messages.compose')}</label>
      <textarea id="message-body" rows={2} className="w-full resize-none text-base" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required disabled={send.isPending} />
      <p className="text-xs text-stone-500">{t('messages.privacy')}</p>
      {send.isError && <Alert tone="error">{featureError(send.error)}</Alert>}
      <Button type="submit" className="w-full" disabled={!online || send.isPending || !text.trim()}>{send.isPending ? t('common.saving') : t('messages.send')}</Button>
    </form>}
  </div>;
}
