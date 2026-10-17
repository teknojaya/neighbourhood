/// <reference lib="webworker" />
/**
 * The single NeighbourHood service worker (PWA shell now, FCM later).
 *
 * Caches: precached build assets only + index.html for navigations.
 * No runtime caching routes are registered, so API calls, chat, pickup
 * details, images and medical information always go to the network.
 *
 * FCM plan (Engineer 2): add to THIS file, do not register a second
 * firebase-messaging-sw.js:
 *   import { initializeApp } from 'firebase/app';
 *   import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
 *   onBackgroundMessage(getMessaging(initializeApp(config)), (payload) => ...);
 * and pass this registration to getToken({ serviceWorkerRegistration }).
 * Notification payloads must stay generic (no addresses/medical details).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { shouldServeAppShell } from './pwa/cache-policy';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// App-shell navigations only; the policy is unit-tested in pwa/cache-policy.test.ts.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && shouldServeAppShell(url, self.location.origin),
  createHandlerBoundToURL('/index.html'),
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string } | null)?.link;
  const target = link?.startsWith('/') ? link : '/notifications';
  event.waitUntil(self.clients.openWindow(target));
});
