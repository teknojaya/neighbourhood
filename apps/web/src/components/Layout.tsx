import { NavLink, Outlet } from 'react-router';
import { t, type MessageKey } from '../i18n';
import { usingAuthEmulator } from '../lib/firebase';
import { useOnline } from '../lib/useOnline';
import { HomeIcon, ListIcon, SearchIcon, SparkIcon, UserIcon } from './icons';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

const NAV: Array<{ to: string; label: MessageKey; icon: () => React.JSX.Element }> = [
  { to: '/', label: 'nav.home', icon: HomeIcon },
  { to: '/explore', label: 'nav.explore', icon: SearchIcon },
  { to: '/needs', label: 'nav.ask', icon: SparkIcon },
  { to: '/activity', label: 'nav.activity', icon: ListIcon },
  { to: '/profile', label: 'nav.profile', icon: UserIcon },
];

export function Layout() {
  const online = useOnline();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-stone-50/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-brand-800">
          <img src="/icons/icon.svg" alt="" className="h-7 w-7" />
          {t('app.name')}
        </NavLink>
        {usingAuthEmulator && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{t('config.emulatorBadge')}</span>
        )}
      </header>
      {!online && (
        <div role="status" className="bg-stone-800 px-4 py-2 text-center text-sm text-white">
          {t('common.offline')}
        </div>
      )}
      <UpdatePrompt />
      <main className="flex-1 px-4 pt-2 pb-28">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-brand-700' : 'text-stone-500'}`
                }
              >
                <Icon />
                {t(label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
