import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UnreadSummarySchema } from '@neighbourhood/shared';
import { api } from '../lib/api';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { t, type MessageKey } from '../i18n';
import { usingAuthEmulator } from '../lib/firebase';
import { useOnline } from '../lib/useOnline';
import { BellIcon, ChatIcon, HomeIcon, ListIcon, SearchIcon, SparkIcon, UserIcon } from './icons';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

const NAV: Array<{ to: string; label: MessageKey; icon: () => React.JSX.Element }> = [
  { to: '/', label: 'nav.home', icon: HomeIcon }, { to: '/explore', label: 'nav.explore', icon: SearchIcon },
  { to: '/needs', label: 'nav.ask', icon: SparkIcon }, { to: '/activity', label: 'nav.activity', icon: ListIcon },
  { to: '/profile', label: 'nav.profile', icon: UserIcon },
];
export function Layout() {
  const online = useOnline(); const location = useLocation(); const shell = useRef<HTMLDivElement>(null);
  const unread = useQuery({ queryKey: ['notifications', 'unread'], queryFn: ({ signal }) => api('/api/v1/notifications/unread', { schema: UnreadSummarySchema, signal }), refetchInterval: online ? 15000 : false, staleTime: 10000 });
  const conversation = location.pathname === '/needs' || (location.pathname === '/messages' && new URLSearchParams(location.search).has('conversation'));
  useEffect(() => {
    if (!conversation || !window.visualViewport) return;
    const viewport = window.visualViewport; const element = shell.current; const resize = () => element?.style.setProperty('--app-height', `${viewport.height}px`);
    resize(); viewport.addEventListener('resize', resize);
    return () => { viewport.removeEventListener('resize', resize); element?.style.removeProperty('--app-height'); };
  }, [conversation]);
  return <div ref={shell} className={`mx-auto flex w-full max-w-6xl flex-col ${conversation ? 'conversation-shell overflow-hidden' : 'min-h-dvh'}`}>
    <header className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 sm:px-6">
      <NavLink to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-800"><img src="/brand/neighbourhood-horizontal-colour.svg" alt={t('app.name')} className="h-auto w-40 min-[400px]:w-48" /></NavLink>
      <div className="flex shrink-0 items-center gap-1">{usingAuthEmulator && <span className="mr-1 hidden rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 min-[360px]:inline-flex" title="Local demo environment">Local demo</span>}<NavLink to="/messages" aria-label={unread.data?.messages ? `Messages, ${unread.data.messages} unread` : 'Messages'} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"><ChatIcon /><UnreadBadge count={unread.data?.messages ?? 0} /></NavLink><NavLink to="/notifications" aria-label={unread.data?.updates ? `Updates, ${unread.data.updates} unread` : 'Updates'} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"><BellIcon /><UnreadBadge count={unread.data?.updates ?? 0} /></NavLink></div>
    </header>
    {!online && <div role="status" className="shrink-0 bg-stone-800 px-4 py-2 text-center text-sm text-white">{t('common.offline')}</div>}<UpdatePrompt />
    <main className={`app-main min-h-0 flex-1 px-4 sm:px-6 ${conversation ? 'flex flex-col py-3' : 'pt-5 pb-8'}`}><Outlet /></main><ScrollRestoration />
    <nav aria-label="Main" className={`${conversation ? 'shrink-0' : 'sticky bottom-0'} z-20 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]`}><ul className="mx-auto grid max-w-2xl grid-cols-5">{NAV.map(({ to, label, icon: Icon }) => <li key={to}><NavLink to={to} end={to === '/'} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${isActive ? 'text-brand-800' : 'text-stone-600 hover:text-brand-800'}`}><span className={to === '/needs' ? '-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-md hover:bg-brand-800' : ''}><Icon /></span>{t(label)}</NavLink></li>)}</ul></nav>
  </div>;
}
function UnreadBadge({ count }: { count: number }) {
  return count > 0 ? <span aria-hidden="true" className="absolute right-0 top-0 min-w-4 rounded-full bg-brand-700 px-1 text-center text-[10px] font-semibold text-white">{count > 99 ? '99+' : count}</span> : null;
}
