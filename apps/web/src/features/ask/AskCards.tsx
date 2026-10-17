import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ApiRoutes, AskActionSchema, ItemCategorySchema, type AskAction, type AskAttachment, type AskPart } from '@neighbourhood/shared';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { t } from '../../i18n';
import { api, privateImage, ApiError } from '../../lib/api';
import { featureError } from '../activity/feature-errors';
import { useOnline } from '../../lib/useOnline';

export function PrivatePhoto({ sessionId, attachment }: { sessionId: string; attachment: AskAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void privateImage(`${ApiRoutes.ask}/sessions/${sessionId}/attachments/${attachment.id}`, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [sessionId, attachment.id]);
  return url ? <img src={url} alt={t('ask.photoAlt')} className="h-28 w-28 rounded-xl object-cover" />
    : <span className="flex h-28 w-28 items-center justify-center rounded-xl bg-stone-100 p-2 text-xs">{failed ? t('ask.photoUnavailable') : t('common.loading')}</span>;
}

export function AskCard({ part, sessionId, onEditDraft }: { part: AskPart; sessionId: string; onEditDraft(): void }) {
  switch (part.kind) {
    case 'action': return <ActionCard key={`${part.action.id}:${part.action.revision}:${part.action.status}`} action={part.action} sessionId={sessionId} />;
    case 'listing_draft': return <Card className="space-y-2">
      <h3 className="font-semibold">{t('ask.listingDraft')}</h3>
      <p>{part.draft.data.title ?? t('ask.unknown')}</p>
      <p className="text-sm text-stone-600">{part.draft.data.category ? t(`category.${part.draft.data.category}`) : t('ask.unknown')} · {part.draft.data.mode ?? t('ask.unknown')}</p>
      <p className="text-sm">{part.draft.data.description}</p>
      <p className="text-sm">{t('ask.draftFacts', { quantity: part.draft.data.quantity ?? t('ask.unknown'), condition: part.draft.data.condition?.replaceAll('_', ' ') ?? t('ask.unknown') })}</p>
      <Alert>{t('ask.draftPrivate')}</Alert>
      <Button type="button" variant="secondary" onClick={onEditDraft}>{t('ask.editInChat')}</Button>
    </Card>;
    case 'saved_needs': return <Card className="space-y-2"><h3 className="font-semibold">{t('needs.savedTitle')}</h3>
      {part.items.length === 0 && <p>{t('needs.savedEmpty')}</p>}
      {part.items.map((need) => <p key={need.id} className="text-sm">{need.extraction.items.map((item) => item.name).join(', ')}</p>)}
      <Link className="text-sm font-semibold text-brand-800 underline" to="/needs/saved">{t('ask.manageNeeds')}</Link>
    </Card>;
    case 'requests': return <Card className="space-y-2"><h3 className="font-semibold">{t('activity.title')}</h3>
      {part.items.length === 0 && <p>{t('ask.noResults')}</p>}
      {part.items.map((item) => <Link key={item.id} to={`/activity?request=${item.id}`} className="block border-b border-stone-100 py-2 text-sm"><strong>{item.listingTitle ?? t('activity.item')}</strong><br />{t(`request.status.${item.status}`)} · {t('needs.quantity', { value: item.quantity })}</Link>)}
    </Card>;
    case 'conversations': return <Card className="space-y-2"><h3 className="font-semibold">{t('module.messages.title')}</h3>
      {part.items.length === 0 && <p>{t('messages.empty')}</p>}
      {part.items.map((item) => <Link className="block py-2 text-sm text-brand-800 underline" key={item.id} to={`/messages?conversation=${item.id}`}>{item.listingTitle ?? t('module.messages.title')}</Link>)}
    </Card>;
    case 'messages': return <Card className="space-y-2"><h3 className="font-semibold">{t('module.messages.title')}</h3>
      {part.items.length === 0 && <p>{t('messages.noMessages')}</p>}
      {[...part.items].reverse().map((item) => <p key={item.id} className="whitespace-pre-wrap break-words border-b border-stone-100 py-2 text-sm">{item.body}</p>)}
    </Card>;
    case 'notifications': return <Card className="space-y-2"><h3 className="font-semibold">{t('module.notifications.title')}</h3>
      {part.items.length === 0 && <p>{t('notifications.empty')}</p>}
      {part.items.map((item) => <p className="text-sm" key={item.id}>{item.title}</p>)}
      <Link to="/notifications" className="text-sm text-brand-800 underline">{t('notifications.open')}</Link>
    </Card>;
  }
}

function ActionCard({ action, sessionId }: { action: AskAction; sessionId: string }) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [edit, setEdit] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const [extraction, setExtraction] = useState(action.payload.kind === 'save_need' ? action.payload.extraction : null);
  const mutation = useMutation({
    mutationFn: ({ operation }: { operation: 'confirm' | 'cancel' | 'edit' }) => api(`${ApiRoutes.ask}/actions/${action.id}${operation === 'edit' ? '' : `/${operation}`}`, {
      method: operation === 'edit' ? 'PATCH' : 'POST',
      body: operation === 'edit' ? { revision: action.revision, extraction } : operation === 'confirm' ? { revision: action.revision } : undefined,
      schema: AskActionSchema,
    }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['ask-detail', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['saved-needs'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const isHandover = action.payload.kind === 'transition_request' && action.payload.body.to === 'collected';
  const pending = action.status === 'pending';
  return <Card className="space-y-3 border-l-4 border-brand-700">
    <h3 className="font-semibold">{t(`ask.action.${action.payload.kind}`)}</h3>
    <p className="break-words text-sm">{action.summary}</p>
    {action.payload.kind === 'send_message' && <><blockquote className="whitespace-pre-wrap break-words rounded-xl bg-stone-50 p-3 text-sm">{action.payload.body}</blockquote><Link className="text-sm text-brand-800 underline" to={`/messages?conversation=${action.payload.conversationId}`}>{t('ask.openConversation')}</Link></>}
    {action.payload.kind === 'request_item' && <><p>{t('needs.quantity', { value: action.payload.body.quantity })}</p>{action.payload.body.message && <blockquote className="whitespace-pre-wrap break-words text-sm">{action.payload.body.message}</blockquote>}</>}
    {action.payload.kind === 'transition_request' && <div className="space-y-2 text-sm">
      {action.payload.body.to === 'approved' && <p>{action.payload.body.pickupBy ? t('activity.pickupBy', { date: new Date(action.payload.body.pickupBy).toLocaleString() }) : t('ask.defaultPickup')}</p>}
      {action.payload.body.note && <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-stone-50 p-3">{action.payload.body.note}</blockquote>}
    </div>}
    {extraction && !edit && <div className="space-y-1 text-sm">
      {extraction.items.map((item, index) => <div key={index}><p>{item.name} · {item.category.replaceAll('_', ' ')} · {t(`needs.preference.${item.preference}`)}{item.quantity === null ? '' : ` · ${item.quantity}`}</p>{item.attributes.map((attribute, i) => <p key={i} className="text-stone-600">{attribute.name}: {attribute.value}</p>)}</div>)}
      {extraction.timing.neededBy && <p>{t('needs.neededBy', { date: extraction.timing.neededBy })}</p>}
      {extraction.timing.loanDurationDays && <p>{t('needs.duration', { days: extraction.timing.loanDurationDays })}</p>}
      {extraction.timing.originalText && <p>{extraction.timing.originalText}</p>}
      {extraction.clarificationQuestions.map((question, index) => <p key={`q-${index}`} className="text-stone-600">{question}</p>)}
      {extraction.outOfScope.map((item, index) => <p key={`o-${index}`} className="text-stone-600">{item.note}</p>)}
    </div>}
    {pending && edit && extraction && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ operation: 'edit' }); }}>
      {extraction.items.map((item, index) => <div key={index} className="space-y-2 rounded-xl bg-stone-50 p-3">
        <TextField label={t('ask.itemName')} value={item.name} maxLength={200} required onChange={(event) => setExtraction({ ...extraction, items: extraction.items.map((old, i) => i === index ? { ...old, name: event.target.value } : old) })} />
        <label className="block space-y-1 text-sm">{t('needs.category')}<select className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white p-2" value={item.category} onChange={(event) => setExtraction({ ...extraction, items: extraction.items.map((old, i) => i === index ? { ...old, category: event.target.value as typeof item.category } : old) })}>
          {[...ItemCategorySchema.options, 'other', 'unknown'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select></label>
        <label className="block space-y-1 text-sm">{t('needs.preference')}<select className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white p-2" value={item.preference} onChange={(event) => setExtraction({ ...extraction, items: extraction.items.map((old, i) => i === index ? { ...old, preference: event.target.value as typeof item.preference } : old) })}>
          {(['donation', 'borrow', 'either', 'unknown'] as const).map((value) => <option key={value} value={value}>{t(`needs.preference.${value}`)}</option>)}
        </select></label>
        <TextField type="number" label={t('activity.quantity')} min={1} max={1000} value={item.quantity ?? ''} onChange={(event) => setExtraction({ ...extraction, items: extraction.items.map((old, i) => i === index ? { ...old, quantity: event.target.value ? Number(event.target.value) : null } : old) })} />
      </div>)}
      <TextField type="date" label={t('ask.neededBy')} value={extraction.timing.neededBy ?? ''} onChange={(event) => setExtraction({ ...extraction, timing: { ...extraction.timing, neededBy: event.target.value || null } })} />
      <Button type="submit" disabled={mutation.isPending || !online}>{t('ask.updatePreview')}</Button>
    </form>}
    {mutation.isError && <Alert tone="error">{featureError(mutation.error)}</Alert>}
    {action.errorCode && !mutation.isError && <Alert tone="error">{featureError(new ApiError(action.errorCode, '', 0))}</Alert>}
    {action.receipt && <Alert tone="success">{action.receipt.message}{action.receipt.link && <Link className="ml-2 underline" to={action.receipt.link}>{t('notifications.open')}</Link>}</Alert>}
    {pending && <>
      <p className="text-xs text-stone-500">{t('ask.reviewHint')}</p>
      {isHandover && <label className="flex gap-2 text-sm"><input type="checkbox" checked={handedOver} onChange={(event) => setHandedOver(event.target.checked)} />{t('ask.handoverCheck')}</label>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={mutation.isPending || !online || edit || (isHandover && !handedOver)} onClick={() => mutation.mutate({ operation: 'confirm' })}>{t('common.confirm')}</Button>
        {extraction && <Button type="button" variant="secondary" disabled={mutation.isPending || !online} onClick={() => setEdit(!edit)}>{edit ? t('common.back') : t('ask.edit')}</Button>}
        <Button type="button" variant="ghost" disabled={mutation.isPending || !online} onClick={() => mutation.mutate({ operation: 'cancel' })}>{t('ask.cancel')}</Button>
      </div>
    </>}
    {action.status === 'executing' && <><Alert>{t('ask.actionRunning')}</Alert><Button type="button" variant="secondary" disabled={mutation.isPending || !online} onClick={() => mutation.mutate({ operation: 'confirm' })}>{t('ask.checkAction')}</Button></>}
    {(action.status === 'cancelled' || action.status === 'expired') && <p className="text-sm text-stone-500">{t(`ask.actionState.${action.status}`)}</p>}
  </Card>;
}
