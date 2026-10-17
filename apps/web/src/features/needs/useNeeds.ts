import { AiStatusSchema, ApiRoutes, ExtractNeedsResponseSchema } from '@neighbourhood/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

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

function localIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
