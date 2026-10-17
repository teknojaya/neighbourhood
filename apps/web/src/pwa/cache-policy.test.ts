import { describe, expect, it } from 'vitest';
import { shouldServeAppShell } from './cache-policy';

const origin = 'https://neighbourhood.example';
const u = (p: string) => new URL(p, origin);

describe('service worker cache policy', () => {
  it('serves the app shell for client routes', () => {
    expect(shouldServeAppShell(u('/'), origin)).toBe(true);
    expect(shouldServeAppShell(u('/needs'), origin)).toBe(true);
  });
  it('never serves API, health or Firebase reserved paths from cache', () => {
    expect(shouldServeAppShell(u('/api/v1/me'), origin)).toBe(false);
    expect(shouldServeAppShell(u('/api/v1/conversations/c1/messages'), origin)).toBe(false);
    expect(shouldServeAppShell(u('/api/v1/listings/l1/pickup'), origin)).toBe(false);
    expect(shouldServeAppShell(u('/healthz'), origin)).toBe(false);
    expect(shouldServeAppShell(u('/__/auth/handler'), origin)).toBe(false);
  });
  it('ignores other origins', () => {
    expect(shouldServeAppShell(new URL('https://firebasestorage.googleapis.com/x'), origin)).toBe(false);
  });
});
