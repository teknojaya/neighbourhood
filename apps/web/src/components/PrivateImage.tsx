import { useEffect, useState } from 'react';
import { privateImage } from '../lib/api';
export function PrivateImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { const controller = new AbortController(); let objectUrl: string | null = null; setUrl(null); setFailed(false); void privateImage(path, controller.signal).then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); }); return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [path, attempt]);
  return url ? <a href={url} target="_blank" rel="noreferrer" aria-label="Open attached photo"><img src={url} alt={alt} className="h-28 w-28 rounded-xl object-cover" /></a> : <span className="flex h-28 w-28 flex-col items-center justify-center rounded-xl bg-stone-100 p-2 text-xs text-stone-700">{failed ? 'Photo unavailable' : 'Loading photo…'}{failed && <button type="button" className="min-h-11 text-brand-800 underline" onClick={() => setAttempt(value => value + 1)}>Retry photo</button>}</span>;
}
