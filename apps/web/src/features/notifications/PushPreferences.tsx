import { useState } from 'react';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { z } from 'zod';
import { getFirebaseApp, usingAuthEmulator } from '../../lib/firebase';
import { api } from '../../lib/api';
import { Alert, Button, Card } from '../../components/ui';

export function PushPreferences() {
  const [busy, setBusy] = useState(false); const [tokenId, setTokenId] = useState<string | null>(null); const [message, setMessage] = useState('');
  async function enable() {
    setBusy(true); setMessage('');
    try {
      if (usingAuthEmulator || !import.meta.env.VITE_FIREBASE_VAPID_KEY || !await isSupported()) throw new Error('Push needs a real Firebase project, web push key, and a supported installed browser. Your in-app inbox still works.');
      const app = getFirebaseApp(); if (!app) throw new Error('Sign in first');
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were not enabled. You can change this in browser settings.');
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Open the installed app or production build to enable push.')), 5000))]);
      const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
      const result = await api('/api/v1/notifications/push-tokens', { method: 'POST', body: { token }, schema: z.object({ id: z.uuid() }) });
      setTokenId(result.id); setMessage('Push enabled on this device.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Push could not be enabled'); } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try { const app = getFirebaseApp(); if (tokenId) await api('/api/v1/notifications/push-tokens/' + tokenId, { method: 'DELETE', schema: z.null() }); if (app && await isSupported()) await deleteToken(getMessaging(app)); setTokenId(null); setMessage('Push disabled on this device.'); } catch { setMessage('Could not disable push. Try again.'); } finally { setBusy(false); }
  }
  return <Card className="space-y-3"><h2 className="font-semibold">Device notifications</h2><p className="text-sm text-stone-600">Optional alerts contain a generic update only. Open the inbox for details.</p><div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => void enable()}>Enable push</Button><Button variant="ghost" disabled={busy} onClick={() => void disable()}>Disable push</Button></div>{message && <Alert>{message}</Alert>}</Card>;
}
