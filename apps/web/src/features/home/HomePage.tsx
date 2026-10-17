import { Link } from 'react-router';
import { useMe } from '../../auth/useMe';
import { Alert, Card } from '../../components/ui';
import { t, type MessageKey } from '../../i18n';

const MODULES: Array<{ to: string; title: MessageKey; body: MessageKey }> = [
  { to: '/explore', title: 'module.listings.title', body: 'module.listings.body' },
  { to: '/activity', title: 'module.activity.title', body: 'module.activity.body' },
  { to: '/communities', title: 'module.communities.title', body: 'module.communities.body' },
  { to: '/messages', title: 'module.messages.title', body: 'module.messages.body' },
  { to: '/notifications', title: 'module.notifications.title', body: 'module.notifications.body' },
  { to: '/categories', title: 'module.categories.title', body: 'module.categories.body' },
];

export function HomePage() {
  const me = useMe();
  const name = me.data?.profile?.displayName;
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{name ? t('home.greeting', { name }) : t('app.name')}</h1>
        <p className="text-stone-600">{t('home.intro')}</p>
      </div>

      {me.data && (!me.data.profile.displayName || !me.data.profile.homeLocation) && (
        <Alert tone="info">
          <Link to="/profile" className="underline">
            {t('home.completeProfile')}
          </Link>
        </Alert>
      )}

      <Link to="/needs" className="block rounded-2xl bg-brand-700 p-5 text-white shadow-sm hover:bg-brand-800">
        <p className="text-lg font-semibold">{t('home.askCta')}</p>
        <p className="mt-1 text-sm text-brand-50">{t('home.askBody')}</p>
      </Link>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{t('home.modules')}</h2>
        <div className="grid gap-3">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to}>
              <Card className="flex items-start justify-between gap-3 hover:ring-brand-700/40">
                <div>
                  <p className="font-semibold">{t(m.title)}</p>
                  <p className="text-sm text-stone-600">{t(m.body)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                  {t('common.comingSoon')}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
