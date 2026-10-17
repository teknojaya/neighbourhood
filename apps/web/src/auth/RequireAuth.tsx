import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenMessage } from '../components/ui';
import { t } from '../i18n';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <FullScreenMessage title={t('common.loading')} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RedirectIfSignedIn() {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenMessage title={t('common.loading')} />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
