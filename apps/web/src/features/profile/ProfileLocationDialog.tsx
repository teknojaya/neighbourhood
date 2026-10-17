import { useState } from 'react';
import { useMe, useSaveProfile } from '../../auth/useMe';
import { Alert, Button, Dialog, Skeleton, TextField } from '../../components/ui';
import { CloseIcon } from '../../components/icons';
import { useOnline } from '../../lib/useOnline';
import { featureError } from '../activity/feature-errors';

/** Saves only through the authenticated Profile endpoint; private coordinates stay out of chat. */
export function ProfileLocationDialog({ onClose, onSaved }: { onClose(): void; onSaved(): void }) {
  const me = useMe();
  return <Dialog label="Set Profile location" onClose={onClose}><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Your pickup area</h2><Button variant="ghost" aria-label="Close location form" onClick={onClose}><CloseIcon /></Button></div><p className="mb-4 text-sm text-stone-600">Saved to Profile for nearby discovery and your listings. Coordinates stay private; only your area label is public.</p>{me.isPending && <Skeleton cards={1} />}{me.isError && <Alert tone="error">{featureError(me.error)} <Button variant="ghost" onClick={() => void me.refetch()}>Try again</Button></Alert>}{me.data && <LocationForm profile={me.data.profile} onSaved={onSaved} />}</Dialog>;
}

function LocationForm({ profile, onSaved }: { profile: NonNullable<ReturnType<typeof useMe>['data']>['profile']; onSaved(): void }) {
  const save = useSaveProfile(), online = useOnline();
  const [name, setName] = useState(profile.displayName ?? ''), [area, setArea] = useState(profile.areaLabel ?? '');
  const [lat, setLat] = useState(profile.homeLocation ? String(profile.homeLocation.lat) : ''), [lng, setLng] = useState(profile.homeLocation ? String(profile.homeLocation.lng) : '');
  const [geo, setGeo] = useState<'idle' | 'locating' | 'unavailable'>('idle');
  const [error, setError] = useState('');
  function locate() { if (!navigator.geolocation) { setGeo('unavailable'); return; } setGeo('locating'); navigator.geolocation.getCurrentPosition(position => { setLat(position.coords.latitude.toFixed(5)); setLng(position.coords.longitude.toFixed(5)); setGeo('idle'); }, () => setGeo('unavailable'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }); }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) { setError('Choose a device location or enter valid latitude and longitude.'); return; } setError(''); save.mutate({ displayName: name.trim(), areaLabel: area.trim(), homeLocation: { lat: Number(lat), lng: Number(lng) }, searchRadiusKm: profile.searchRadiusKm, preferredLanguage: profile.preferredLanguage }, { onSuccess: onSaved }); }}>
    {!profile.displayName && <TextField label="Display name" required minLength={2} maxLength={60} value={name} onChange={event => setName(event.target.value)} />}
    <TextField label="Neighbourhood / city / region" required maxLength={120} value={area} onChange={event => setArea(event.target.value)} hint="For example: Tebet, South Jakarta. A city label does not replace coordinates." />
    <Button type="button" variant="secondary" disabled={geo === 'locating' || save.isPending} onClick={locate}>{geo === 'locating' ? 'Finding your location…' : 'Use device location'}</Button>
    {geo === 'unavailable' && <Alert tone="warning">Device location is unavailable. Allow location access or enter coordinates below.</Alert>}
    {profile.homeLocation && <p className="text-sm text-brand-800">Your saved coordinates are already set. You can keep them and add your public area label.</p>}
    <div className="grid grid-cols-2 gap-3"><TextField label="Latitude" required inputMode="decimal" value={lat} onChange={event => { setLat(event.target.value); setError(''); }} /><TextField label="Longitude" required inputMode="decimal" value={lng} onChange={event => { setLng(event.target.value); setError(''); }} /></div>
    {error && <Alert tone="error">{error}</Alert>}{save.isError && <Alert tone="error">{featureError(save.error)}</Alert>}{!online && <Alert tone="warning">Reconnect to save your location.</Alert>}
    <Button type="submit" className="w-full" disabled={!online || save.isPending || geo === 'locating'}>{save.isPending ? 'Saving…' : 'Save location and continue'}</Button>
  </form>;
}
