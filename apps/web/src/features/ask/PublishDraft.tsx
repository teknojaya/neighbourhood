import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AskActionSchema, AskAttachmentSchema, type AskListingDraft } from '@neighbourhood/shared';
import { PrivatePhoto } from './AskCards';
import { createRetryKey } from '../activity/retry-key';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { ListingFormModal } from '../listings/ListingFormModal';

export function PublishDraft({ draft, sessionId, initiallyOpen = false, onDismiss }: { draft: AskListingDraft; sessionId: string; initiallyOpen?: boolean; onDismiss?(): void }) {
  const [open, setOpen] = useState(initiallyOpen); const qc = useQueryClient(); const clientId = useRef(crypto.randomUUID());
  function close() { setOpen(false); onDismiss?.(); }
  const [excluded, setExcluded] = useState<string[]>([]);
  const photoKey = useRef(createRetryKey());
  return <><Button variant="secondary" onClick={() => setOpen(true)}>Review and prepare publication</Button>
    {open && <ListingFormModal initialDraft={draft.data} attachedPhotos={<div className="flex flex-wrap gap-3">{draft.attachments.map(attachment => <label key={attachment.id} className="space-y-2"><PrivatePhoto sessionId={sessionId} attachment={attachment} /><span className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!excluded.includes(attachment.id)} onChange={event => setExcluded(old => event.target.checked ? old.filter(id => id !== attachment.id) : [...old, attachment.id])} />Include this photo</span></label>)}</div>} onClose={close} onSuccess={close} onPrepare={async (body, file) => {
      const attachmentIds = draft.data.attachmentIds.filter(id => !excluded.includes(id));
      if (file) {
        if (attachmentIds.length >= 2) throw new Error('Uncheck one draft photo before adding another. Maximum two photos.');
        const photo = await api(`/api/v1/ask/sessions/${sessionId}/attachments`, { method: 'POST', binaryBody: file, schema: AskAttachmentSchema, idempotencyKey: photoKey.current.forPayload({ name: file.name, size: file.size, modified: file.lastModified }) });
        attachmentIds.push(photo.id);
      }
      await api(`/api/v1/ask/sessions/${sessionId}/proposals`, { method: 'POST', body: { clientId: clientId.current, action: { operation: 'listing_publish', body, attachmentIds } }, schema: AskActionSchema });
      clientId.current = crypto.randomUUID();
      photoKey.current.clear();
      await qc.invalidateQueries({ queryKey: ['ask-detail', sessionId] });
    }} />}
  </>;
}
