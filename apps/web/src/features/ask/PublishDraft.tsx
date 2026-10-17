import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AskActionSchema, AskSessionDetailSchema, type AskListingDraft } from '@neighbourhood/shared';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { ListingFormModal } from '../listings/ListingFormModal';

export function PublishDraft({ draft, sessionId }: { draft: AskListingDraft; sessionId: string }) {
  const [open, setOpen] = useState(false); const qc = useQueryClient(); const clientId = useRef(crypto.randomUUID());
  return <><Button variant="secondary" onClick={() => setOpen(true)}>Review and prepare publication</Button>
    {open && <ListingFormModal initialDraft={draft.data} onClose={() => setOpen(false)} onSuccess={() => setOpen(false)} onPrepare={async body => {
      const detail = await api(`/api/v1/ask/sessions/${sessionId}`, { schema: AskSessionDetailSchema });
      const attachmentIds = detail.messages.items.flatMap(m => m.attachments.map(a => a.id)).slice(-2);
      await api(`/api/v1/ask/sessions/${sessionId}/proposals`, { method: 'POST', body: { clientId: clientId.current, action: { operation: 'listing_publish', body, attachmentIds } }, schema: AskActionSchema });
      clientId.current = crypto.randomUUID();
      await qc.invalidateQueries({ queryKey: ['ask-detail', sessionId] });
    }} />}
  </>;
}
