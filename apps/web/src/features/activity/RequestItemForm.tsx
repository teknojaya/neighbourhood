import { ApiRoutes, CreateDonationRequestBodySchema, DonationRequestSchema } from '@neighbourhood/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, TextField } from '../../components/ui';
import { t } from '../../i18n';
import { api } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { featureError } from './feature-errors';
import { createRetryKey } from './retry-key';

/** Engineer 1 can embed this in a donate listing detail once its route is ready. */
export function RequestItemForm({ listingId, availableQuantity }: { listingId: string; availableQuantity: number }) {
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const keys = useRef(createRetryKey());
  const online = useOnline();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: async () => {
      const body = CreateDonationRequestBodySchema.parse({ listingId, quantity: Number(quantity), message });
      return api(ApiRoutes.requests, { method: 'POST', body, idempotencyKey: keys.current.forPayload(body), schema: DonationRequestSchema });
    },
    onSuccess: async (request) => {
      keys.current.clear();
      await qc.invalidateQueries({ queryKey: ['requests'] });
      navigate(`/activity?request=${request.id}`);
    },
  });
  return <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
    <TextField label={t('activity.quantity')} type="number" inputMode="numeric" min={1} max={Math.min(100, availableQuantity)} step={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
    <label className="block space-y-1"><span className="text-sm font-medium">{t('activity.message')}</span><textarea className="min-h-24 w-full rounded-xl border border-stone-300 p-3" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
    <p className="text-xs text-stone-500">{t('activity.requestHint')}</p>
    {submit.isError && <Alert tone="error">{featureError(submit.error)}</Alert>}
    <Button className="w-full" disabled={!online || submit.isPending || availableQuantity < 1}>{submit.isPending ? t('common.saving') : t('activity.request')}</Button>
  </form>;
}
