import { useLocation, useNavigate } from 'react-router';
import { ListingFormModal } from './ListingFormModal';
export function SharePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const origin = from?.startsWith('/') && !from.startsWith('//') ? from : '/';
  return <ListingFormModal inline onClose={() => navigate(origin)} onSuccess={() => navigate('/activity?tab=giving')} />;
}
