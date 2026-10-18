import { useState } from 'react';
import { Link } from 'react-router';
import { BoxIcon, CheckIcon, ClockIcon, CloseIcon, ExchangeIcon } from '../../components/icons';

export function ActivityItem({ id, title, photo }: { id: string; title: string; photo?: string }) {
  const [broken, setBroken] = useState(false);
  return <Link to={`/listings/${id}`} className="flex min-w-0 items-center gap-3 rounded-lg hover:text-brand-800">
    {photo && !broken ? <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-20 w-20 shrink-0 rounded-xl bg-stone-100 object-cover" /> : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500" aria-label="Photo unavailable"><BoxIcon /></span>}
    <span className="min-w-0 break-words font-semibold">{title}</span>
  </Link>;
}

const states = {
  pending: ['Awaiting approval', 'bg-amber-50 text-amber-900', ClockIcon],
  approved: ['Ready to collect', 'bg-sky-50 text-sky-900', CheckIcon],
  checked_out: ['On loan', 'bg-sky-50 text-sky-900', ExchangeIcon],
  collected: ['Collected', 'bg-brand-50 text-brand-800', CheckIcon],
  returned: ['Returned', 'bg-brand-50 text-brand-800', CheckIcon],
  active: ['Available', 'bg-brand-50 text-brand-800', CheckIcon],
  draft: ['Private draft', 'bg-amber-50 text-amber-900', ClockIcon],
  paused: ['Paused', 'bg-stone-100 text-stone-700', ClockIcon],
  closed: ['Closed', 'bg-stone-100 text-stone-700', CloseIcon],
  rejected: ['Declined', 'bg-stone-100 text-stone-700', CloseIcon],
  cancelled: ['Cancelled', 'bg-stone-100 text-stone-700', CloseIcon],
  expired: ['Pickup expired', 'bg-amber-50 text-amber-900', ClockIcon],
} as const;
export function ActivityStatus({ status, overdue = false }: { status: keyof typeof states; overdue?: boolean }) {
  const [label, tone, Icon] = overdue ? ['Return overdue', 'bg-red-50 text-red-800', ClockIcon] as const : states[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5 ${tone}`}><Icon />{label}</span>;
}
