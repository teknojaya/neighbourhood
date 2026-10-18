import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

// Text only, in memory. Never store private attachments or API payloads on disk.
const drafts = new Map<string, string>();
export function clearTextDrafts() { drafts.clear(); }
export function useTextDraft(thread: string, initial = '') {
  const { user } = useAuth();
  const key = `${user?.uid}:${thread}`;
  const [text, update] = useState(() => drafts.get(key) ?? initial);
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current !== key) {
      if (text) drafts.set(key, text);
      drafts.delete(previousKey.current); previousKey.current = key;
    }
  }, [key, text]);
  const setText = useCallback((value: string | ((current: string) => string)) => {
    update(current => { const next = typeof value === 'function' ? value(current) : value; if (next) drafts.set(key, next); else drafts.delete(key); return next; });
  }, [key]);
  return [text, setText] as const;
}
