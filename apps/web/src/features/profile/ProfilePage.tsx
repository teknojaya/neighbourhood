import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM, type RadiusKm, type UiLanguage } from '@neighbourhood/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useMe, useSaveProfile } from '../../auth/useMe';
import { Alert, Button, Card, TextField } from '../../components/ui';
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
  const [radius, setRadius] = useState<RadiusKm>(DEFAULT_RADIUS_KM);
  const [language, setLanguage] = useState<UiLanguage>('en');
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'unavailable'>('idle');

  const profile = me.data?.profile;
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? '');
    setAreaLabel(profile.areaLabel ?? '');
    setLat(profile.homeLocation ? String(profile.homeLocation.lat) : '');
    setLng(profile.homeLocation ? String(profile.homeLocation.lng) : '');
    setRadius(profile.searchRadiusKm);
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
      searchRadiusKm: radius,
      preferredLanguage: language,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{profile?.displayName ? t('profile.title') : t('profile.setupTitle')}</h1>
      {me.data?.email && <p className="text-sm text-stone-600">{t('profile.email', { email: me.data.email })}</p>}
      {profile && !profile.displayName && <Alert tone="info">{t('profile.needsName')}</Alert>}
      {me.isError && <Alert tone="error">{t('error.generic')}</Alert>}

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <TextField label={t('auth.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={60} required />
          <TextField label={t('profile.area')} hint={t('profile.areaHint')} value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} maxLength={120} />

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
            <div className="grid grid-cols-2 gap-2">
              <TextField label={t('profile.lat')} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} pattern="-?\d{1,2}(\.\d+)?" required={lng !== ''} />
              <TextField label={t('profile.lng')} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} pattern="-?\d{1,3}(\.\d+)?" required={lat !== ''} />
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('profile.radius')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTIONS_KM.map((km) => (
                <label key={km} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ring-1 ${radius === km ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-stone-300'}`}>
                  <input type="radio" name="radius" value={km} checked={radius === km} onChange={() => setRadius(km)} className="sr-only" />
                  {t('profile.radiusOption', { km })}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1">
            <span className="text-sm font-medium">{t('profile.language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as UiLanguage)} className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3">
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
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
            {[...me.data.platformRoles, ...me.data.memberships.map((m) => `${m.role} @ ${m.communityId}`)].join(', ') || t('profile.noRoles')}
          </p>
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
