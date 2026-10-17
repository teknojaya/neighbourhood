import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AskActionSchema } from '@neighbourhood/shared';
import { useMe } from '../../auth/useMe';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { CommunityForm } from '../communities/CommunityForms';

export function PointDraft({ communityId, sessionId }: { communityId: string; sessionId: string }) {
  const me = useMe(); const [open, setOpen] = useState(false);
  const clientId = useRef(crypto.randomUUID()); const qc = useQueryClient();
  if (!me.data?.memberships.some(m => m.communityId === communityId && m.role === 'moderator')) return null;
  return <><Button variant="secondary" onClick={() => setOpen(!open)}>Review a new collection point</Button>
    {open && <CommunityForm communityId={communityId} onDone={() => setOpen(false)} onPreparePoint={async body => {
      await api(`/api/v1/ask/sessions/${sessionId}/proposals`, { method: 'POST', body: { clientId: clientId.current, action: { operation: 'point_create', communityId, body } }, schema: AskActionSchema });
      clientId.current = crypto.randomUUID();
      await qc.invalidateQueries({ queryKey: ['ask-detail', sessionId] });
    }} />}
  </>;
}
