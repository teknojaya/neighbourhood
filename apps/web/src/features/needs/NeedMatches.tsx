import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { NeedMatchesSchema } from '@neighbourhood/shared';
import { api } from '../../lib/api';
import { Alert, Button } from '../../components/ui';

export function NeedMatches({ id }: { id: string }) {
  const [enabled, setEnabled] = useState(false);
  const matches = useQuery({ queryKey: ['need-matches', id], queryFn: () => api(`/api/v1/needs/${id}/matches`, { schema: NeedMatchesSchema }), enabled, retry: false });
  return <div className="space-y-3"><Button variant="secondary" onClick={() => { setEnabled(true); if (enabled) void matches.refetch(); }} disabled={matches.isFetching}>{matches.isFetching ? 'Finding matches…' : 'Find nearby matches'}</Button>
    {matches.isError && <Alert tone="error">{matches.error.message}</Alert>}{matches.data?.items.length === 0 && <p>No matching items nearby yet.</p>}{matches.data?.items.map(item => <Link key={item.listing.id} to={'/listings/' + item.listing.id} className="block border-t py-3"><strong>{item.listing.title}</strong><p className="text-sm">{item.reason}</p>{item.missingInfo.map((info,i) => <p className="text-xs text-stone-600" key={i}>{info}</p>)}</Link>)}
  </div>;
}
