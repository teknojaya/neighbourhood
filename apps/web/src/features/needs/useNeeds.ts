import { AiStatusSchema, ApiRoutes, ExtractNeedsResponseSchema, SavedNeedPageSchema, SavedNeedSchema, type NeedsExtraction } from '@neighbourhood/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useRef } from 'react';
import { api } from '../../lib/api';
import { createRetryKey } from '../activity/retry-key';

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: ({ signal }) => api(ApiRoutes.aiStatus, { schema: AiStatusSchema, signal }),
    staleTime: 5 * 60_000,
  });
}

/** Not cached: private needs text and results stay in component state only. */
export function useExtractNeeds() {
  return useMutation({
    mutationFn: (text: string) =>
      api(ApiRoutes.aiExtractNeeds, {
        method: 'POST',
        body: { text, today: localIsoDate() },
        schema: ExtractNeedsResponseSchema,
      }),
  });
}

export function useSavedNeeds() {
  return useQuery({
    queryKey: ['saved-needs'],
    queryFn: ({ signal }) => api(ApiRoutes.needs, { schema: SavedNeedPageSchema, signal }),
  });
}

export function useSaveNeed() {
  const queryClient = useQueryClient();
  const saveRetry = useRef(createRetryKey());
  return useMutation({
    mutationFn: (extraction: NeedsExtraction) => {
      const body = { extraction };
      return api(ApiRoutes.needs, {
        method: 'POST', body, schema: SavedNeedSchema, idempotencyKey: saveRetry.current.forPayload(body),
      });
    },
    onSuccess: () => { saveRetry.current.clear(); void queryClient.invalidateQueries({ queryKey: ['saved-needs'] }); },
  });
}

export function useDeleteNeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${ApiRoutes.needs}/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-needs'] }),
  });
}

function localIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
