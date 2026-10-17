import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { t } from '../i18n';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-300',
    secondary: 'bg-white text-brand-800 border border-stone-300 hover:border-brand-700 hover:bg-brand-50 disabled:text-stone-500',
    ghost: 'text-brand-800 hover:bg-brand-50',
  }[variant];
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-stone-600">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface rounded-2xl border border-stone-200 bg-white p-4 ${className}`}>{children}</section>;
}

export function ModeTabs({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="Offering">
    {([['', 'All'], ['donate', 'Free'], ['lend', 'Borrow']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${value === mode ? 'bg-white text-brand-800' : 'text-stone-600 hover:text-stone-900'}`}>{label}</button>)}
  </div>;
}

export function PageHeading({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><div className="min-w-0 space-y-1"><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{children && <p className="text-sm leading-relaxed text-stone-600">{children}</p>}</div>{action}</div>;
}

export function Skeleton({ cards = 3, grid = false }: { cards?: number; grid?: boolean }) {
  return <div role="status" aria-label="Loading" className={grid ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4' : 'space-y-3'}><span className="sr-only">Loading…</span>{Array.from({ length: cards }, (_, i) => <div key={i} aria-hidden="true" className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white">{grid && <div className="aspect-[4/3] bg-stone-100" />}<div className="space-y-3 p-4"><div className="h-4 w-2/3 rounded bg-stone-200" /><div className="h-3 w-4/5 rounded bg-stone-100" /><div className="h-3 w-1/2 rounded bg-stone-100" /></div></div>)}</div>;
}

export function Dialog({ children, onClose, label }: { children: ReactNode; onClose(): void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-stone-900 backdrop:bg-black/40">{children}</dialog>;
}

export function FormSurface({ children, inline, onClose }: { children: ReactNode; inline: boolean; onClose(): void }) {
  return inline ? <section className="mx-auto max-w-2xl">{children}</section> : <Dialog label="Share or edit an item" onClose={onClose}>{children}</Dialog>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    info: 'bg-sky-50 text-sky-900 ring-sky-200',
    error: 'bg-red-50 text-red-900 ring-red-200',
    success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm ring-1 ${styles}`}>
      {children}
    </div>
  );
}

/** Honest placeholder for a module that is not built yet. No fake actions. */
export function PlannedModule({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="space-y-2 text-center">
        <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
          {t('common.comingSoon')}
        </span>
        <p className="text-stone-700">{body}</p>
        <p className="text-sm text-stone-500">{t('common.notAvailableYet')}</p>
      </Card>
      {children}
    </div>
  );
}

export function FullScreenMessage({ title, body }: { title: string; body?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {body && <p className="text-sm text-stone-600">{body}</p>}
    </main>
  );
}
