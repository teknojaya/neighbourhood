import { ApiRoutes, MeSchema, type UpsertProfileBody } from '@neighbourhood/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from './AuthProvider';

export const meQueryKey = ['me'] as const;

export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: meQueryKey,
    queryFn: ({ signal }) => api(ApiRoutes.me, { schema: MeSchema, signal }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UpsertProfileBody> & Pick<UpsertProfileBody, 'displayName'>) =>
      api(ApiRoutes.meProfile, { method: 'PUT', body, schema: MeSchema }),
    onSuccess: (me) => qc.setQueryData(meQueryKey, me),
  });
}
