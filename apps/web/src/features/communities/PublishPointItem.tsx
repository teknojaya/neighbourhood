import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { PointInventoryItemSchema, CommunityPoint } from '@neighbourhood/shared';
import { Link } from 'react-router';
import { Button } from '../../components/ui';
import { ListingFormModal } from '../listings/ListingFormModal';

export function PublishPointItem({ item, point }: { item: z.infer<typeof PointInventoryItemSchema>; point: CommunityPoint }) {
  const [open,setOpen] = useState(false); const qc = useQueryClient();
  if (item.listingId) return <Link className="block py-3 font-semibold text-brand-800 underline" to={'/listings/' + item.listingId}>View / request this point item</Link>;
  return <><Button variant="secondary" disabled={item.available < 1} onClick={() => setOpen(true)}>Review and share confirmed stock</Button>{open && <ListingFormModal initialDraft={{ title: item.title, category: item.category, mode: 'donate', quantity: item.available, description: '', condition: null }} pointInventory={{ itemId: item.id, pointId: point.id, areaLabel: point.location.areaLabel }} onClose={() => setOpen(false)} onSuccess={() => { setOpen(false); void qc.invalidateQueries({ queryKey: ['inventory', point.id] }); }} />}</>;
}
