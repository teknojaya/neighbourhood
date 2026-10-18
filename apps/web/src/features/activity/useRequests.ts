import { ApiRoutes, DonationRequestPageSchema, DonationRequestSchema, type DonationRequestStatus } from '@neighbourhood/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useRequests(direction: 'incoming' | 'outgoing', enabled = true) {
  return useInfiniteQuery({
    enabled, queryKey: ['requests', direction], initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) => api(`${ApiRoutes.requests}/${direction}?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: DonationRequestPageSchema, signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 15_000,
  });
}

export function useRequest(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id], enabled: Boolean(id), refetchInterval: 15_000,
    queryFn: ({ signal }) => api(`${ApiRoutes.requests}/${encodeURIComponent(id!)}`, { schema: DonationRequestSchema, signal }),
  });
}

export function useRequestTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: Exclude<DonationRequestStatus, 'pending' | 'expired'>; pickupBy?: string; key: string }) => {
      const { key, ...body } = input;
      return api(`${ApiRoutes.requests}/${id}/transition`, { method: 'POST', body, idempotencyKey: key, schema: DonationRequestSchema });
    },
    onSuccess: async () => {
      await Promise.all(['requests', 'conversations', 'notifications'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    },
  });
}
