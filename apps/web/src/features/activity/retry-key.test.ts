import { describe, expect, it } from 'vitest';
import { createRetryKey } from './retry-key';

describe('mobile mutation retries', () => {
  it('reuses the key after a failed response and changes it for edited input or a completed operation', () => {
    const keys = createRetryKey();
    const first = keys.forPayload({ to: 'approved', pickupBy: '2026-10-18T00:00:00Z' });
    expect(keys.forPayload({ to: 'approved', pickupBy: '2026-10-18T00:00:00Z' })).toBe(first);
    const edited = keys.forPayload({ to: 'cancelled' });
    expect(edited).not.toBe(first);
    keys.clear();
    expect(keys.forPayload({ to: 'cancelled' })).not.toBe(edited);
  });
});
