import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { RedirectIfSignedIn, RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { FullScreenMessage } from './components/ui';
import { ActivityPage } from './features/activity/ActivityPage';
import { LoginPage } from './features/auth/AuthPages';
import { CommunitiesPage } from './features/communities/CommunitiesPage';
import { HomePage } from './features/home/HomePage';
import { ExplorePage } from './features/listings/ExplorePage';
import { MedicinePage } from './features/medicine/MedicinePage';
import { MessagesPage } from './features/messages/MessagesPage';
import { NeedsAssistantPage } from './features/needs/NeedsAssistantPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { t } from './i18n';
import { firebaseConfigured } from './lib/firebase';

const router = createBrowserRouter([
  {
    element: <RedirectIfSignedIn />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <Navigate to="/login" replace /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'needs', element: <NeedsAssistantPage /> },
          { path: 'explore', element: <ExplorePage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'communities', element: <CommunitiesPage /> },
          { path: 'messages', element: <MessagesPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'medicine', element: <MedicinePage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  if (!firebaseConfigured) return <FullScreenMessage title={t('config.missingTitle')} body={t('config.missingBody')} />;
  return <RouterProvider router={router} />;
}
