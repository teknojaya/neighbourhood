import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM, RADIUS_OPTIONS_KM, type UiLanguage } from '@neighbourhood/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { useMe, useSaveProfile } from '../../auth/useMe';
import { Alert, Button, Card, PageHeading, Skeleton, TextField } from '../../components/ui';
import { t } from '../../i18n';
import { ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';

export function ProfilePage() {
  const { signOut, linkGoogle } = useAuth();
  const [linkState, setLinkState] = useState<'idle' | 'linked' | 'error'>('idle');
  const me = useMe();
  const save = useSaveProfile();
  const online = useOnline();

  const [displayName, setDisplayName] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_KM));
  const [language, setLanguage] = useState<UiLanguage>('en');
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'unavailable'>('idle');

  const profile = me.data?.profile;
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? '');
    setAreaLabel(profile.areaLabel ?? '');
    setLat(profile.homeLocation ? String(profile.homeLocation.lat) : '');
    setLng(profile.homeLocation ? String(profile.homeLocation.lng) : '');
    setRadius(String(profile.searchRadiusKm));
    setLanguage(profile.preferredLanguage);
  }, [profile]);

  function useDeviceLocation() {
    if (!('geolocation' in navigator)) return setGeoState('unavailable');
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setGeoState('idle');
      },
      () => setGeoState('unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hasLocation = lat.trim() !== '' && lng.trim() !== '';
    save.mutate({
      displayName: displayName.trim(),
      areaLabel: areaLabel.trim() || null,
      homeLocation: hasLocation ? { lat: Number(lat), lng: Number(lng) } : null,
      searchRadiusKm: Number(radius),
      preferredLanguage: language,
    });
  }

  return (
    <div className="space-y-4">
      <PageHeading title={profile?.displayName ? t('profile.title') : t('profile.setupTitle')}>Your neighbourhood, preferences and account.</PageHeading>
      <Link to="/saved-items" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Saved items</Link>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-stone-200 pb-3 text-sm font-semibold text-brand-800"><Link className="inline-flex min-h-11 items-center underline" to="/needs/saved">Saved needs</Link><Link className="inline-flex min-h-11 items-center underline" to="/communities">Communities & points</Link><Link className="inline-flex min-h-11 items-center underline" to="/categories">Product categories</Link></div>
      {me.data?.email && <p className="text-sm text-stone-600">{t('profile.email', { email: me.data.email })}</p>}
      {profile && !profile.displayName && <Alert tone="info">{t('profile.needsName')}</Alert>}
      {me.isError && <Alert tone="error">{t('error.generic')}</Alert>}
      {me.isPending && <Skeleton cards={2} />}

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <TextField label={t('auth.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={60} required />
          <TextField label="Neighbourhood / city / region" hint="Shown on your listings, for example: Tebet, South Jakarta. Keep your exact address private." value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} maxLength={120} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('profile.location')}</legend>
            <p className="text-xs text-stone-500">{t('profile.locationHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={useDeviceLocation} disabled={geoState === 'locating'}>
                {geoState === 'locating' ? t('profile.locating') : t('profile.useDevice')}
              </Button>
              {(lat || lng) && (
                <Button type="button" variant="ghost" onClick={() => { setLat(''); setLng(''); }}>
                  {t('profile.clearLocation')}
                </Button>
              )}
            </div>
            {geoState === 'unavailable' && <Alert tone="warning">{t('profile.geoUnavailable')}</Alert>}
            {(lat && lng) && <p className="text-sm text-brand-800">Location set. Save to use it for nearby discovery.</p>}
            <details><summary className="cursor-pointer py-3 text-sm font-semibold text-brand-800">Enter coordinates manually</summary><div className="grid grid-cols-2 gap-2">
              <TextField label={t('profile.lat')} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} pattern="-?\d{1,2}(\.\d+)?" required={lng !== ''} />
              <TextField label={t('profile.lng')} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} pattern="-?\d{1,3}(\.\d+)?" required={lat !== ''} />
            </div></details>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('profile.radius')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTIONS_KM.map((km) => (
                <label key={km} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-700 ${Number(radius) === km ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-stone-300'}`}>
                  <input type="radio" name="radius" value={km} checked={Number(radius) === km} onChange={() => setRadius(String(km))} className="sr-only" />
                  {t('profile.radiusOption', { km })}
                </label>
              ))}
            </div>
          </fieldset>

          <TextField label="Custom search radius (km)" type="number" inputMode="numeric" min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} step={1} required value={radius} onChange={event => setRadius(event.target.value)} hint="Enter 1–50 km, in whole kilometres." />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Preferred language for Ask</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as UiLanguage)} className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3">
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <span className="block text-sm text-stone-600">Ask supports English and Bahasa Indonesia. App menus currently use English.</span>
          </label>

          {!online && <Alert tone="warning">{t('error.OFFLINE')}</Alert>}
          {save.isError && (
            <Alert tone="error">{save.error instanceof ApiError && save.error.code === 'VALIDATION_FAILED' ? t('error.VALIDATION_FAILED') : t('error.generic')}</Alert>
          )}
          {save.isSuccess && <Alert tone="success">{t('profile.saved')}</Alert>}
          <Button type="submit" className="w-full" disabled={save.isPending || !online}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </Card>

      {me.data && (
        <Card className="text-sm">
          <p className="font-medium">{t('profile.roles')}</p>
          <p className="text-stone-600">
            {[...new Set([...me.data.platformRoles, ...me.data.memberships.map(m => m.role)])].map(role => role.replaceAll('_', ' ')).join(', ') || 'Neighbour'}
          </p>
          <Link to="/communities" className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline">View your community roles</Link>
        </Card>
      )}

      {me.data?.signInMethod === 'email_otp' && (
        <Card className="space-y-2 text-sm">
          <Button
            variant="secondary"
            className="w-full"
            disabled={!online}
            onClick={() =>
              void linkGoogle().then(
                () => setLinkState('linked'),
                () => setLinkState('error'),
              )
            }
          >
            {t('auth.linkGoogle')}
          </Button>
          {linkState === 'linked' && <Alert tone="success">{t('auth.linked')}</Alert>}
          {linkState === 'error' && <Alert tone="error">{t('auth.error.generic')}</Alert>}
        </Card>
      )}

      <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
        {t('common.signOut')}
      </Button>
    </div>
  );
}
