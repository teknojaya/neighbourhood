import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { t } from '../i18n';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-stone-300',
    secondary: 'bg-white text-brand-800 ring-1 ring-brand-700/30 hover:bg-brand-50 disabled:text-stone-400',
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
        className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base shadow-sm focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${className}`}>{children}</section>;
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
