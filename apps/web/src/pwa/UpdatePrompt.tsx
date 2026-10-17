import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/ui';

/** Registers the single service worker and offers reload when a new version is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2 text-sm ring-1 ring-brand-200">
      <span>A new version of NeighbourHood is available.</span>
      <div className="flex gap-1">
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
      </div>
    </div>
  );
}
