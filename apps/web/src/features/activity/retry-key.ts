/** Keep a mutation's key after a lost response; only edited input starts a new operation. */
export function createRetryKey() {
  let previous: { signature: string; key: string } | null = null;
  return {
    forPayload(payload: unknown) {
      const signature = JSON.stringify(payload);
      if (previous?.signature !== signature) previous = { signature, key: crypto.randomUUID().replaceAll('-', '') };
      return previous.key;
    },
    clear() { previous = null; },
  };
}
