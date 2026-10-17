import {
  ApiRoutes,
  AuthMethodsSchema,
  RequestEmailOtpResponseSchema,
  VerifyEmailOtpResponseSchema,
} from '@neighbourhood/shared';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { authErrorKey, useAuth } from '../../auth/AuthProvider';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { hasMessage, t, type MessageKey } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { useOnline } from '../../lib/useOnline';
import { DemoSignIn } from './DemoSignIn';

function errorKey(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    const key = `error.${err.code}`;
    if (hasMessage(key)) return key;
    return 'auth.error.generic';
  }
  return authErrorKey(err);
}

/** Single sign-in page: Google, or a numeric email code. First sign-in creates the account. */
export function LoginPage() {
  const { signInWithGoogle, signInWithEmailCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const methods = useQuery({
    queryKey: ['auth-methods'],
    queryFn: ({ signal }) => api(ApiRoutes.authMethods, { schema: AuthMethodsSchema, signal }),
  });
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState<'google' | 'send' | 'verify' | null>(null);
  const [email, setEmail] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const done = () => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from?.startsWith('/') ? from : '/', { replace: true });
  };

  async function run(kind: 'google' | 'send' | 'verify', fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(null);
    }
  }

  const google = () =>
    run('google', async () => {
      await signInWithGoogle();
      done();
    });

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run('send', async () => {
      await api(ApiRoutes.authEmailOtpRequest, { method: 'POST', body: { email }, schema: RequestEmailOtpResponseSchema });
      setCodeSentTo(email.trim().toLowerCase());
      setCode('');
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    return run('verify', async () => {
      const { customToken } = await api(ApiRoutes.authEmailOtpVerify, {
        method: 'POST',
        body: { email: codeSentTo, code },
        schema: VerifyEmailOtpResponseSchema,
      });
      await signInWithEmailCode(customToken);
      done();
    });
  };

  const otp = methods.data?.emailOtp;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <img src="/icons/icon.svg" alt="" className="mx-auto h-14 w-14" />
        <p className="text-2xl font-bold text-brand-800">{t('app.name')}</p>
        <p className="text-sm text-stone-600">{t('app.tagline')}</p>
      </div>
      <Card className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{t('auth.signIn')}</h1>
          <p className="text-sm text-stone-600">{t('auth.intro')}</p>
        </div>

        {!online && <Alert tone="warning">{t('error.OFFLINE')}</Alert>}
        {error && <Alert tone="error">{t(error)}</Alert>}

        <Button variant="secondary" className="w-full gap-2" onClick={() => void google()} disabled={!online || busy !== null}>
          <GoogleMark />
          {t('auth.google')}
        </Button>

        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          {t('auth.or')}
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        {otp && !otp.available ? (
          <Alert tone="info">
            {otp.reason === 'auth_backend_not_configured' ? t('auth.otpBackendUnavailable') : t('auth.otpUnavailable')}
          </Alert>
        ) : codeSentTo ? (
          <form className="space-y-3" onSubmit={(e) => void verify(e)}>
            <Alert tone="success">{t('auth.codeSent', { email: codeSentTo })}</Alert>
            <TextField
              label={t('auth.code')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              required
            />
            <Button type="submit" className="w-full" disabled={!online || busy !== null || code.length !== 6}>
              {busy === 'verify' ? t('auth.verifying') : t('auth.verify')}
            </Button>
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setCodeSentTo(null)}>
                {t('auth.changeEmail')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void sendCode()} disabled={busy !== null}>
                {t('auth.resend')}
              </Button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void sendCode(e)}>
            <TextField label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={!online || busy !== null || !otp}>
              {busy === 'send' ? t('auth.sendingCode') : t('auth.sendCode')}
            </Button>
          </form>
        )}
      </Card>
      <DemoSignIn />
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
