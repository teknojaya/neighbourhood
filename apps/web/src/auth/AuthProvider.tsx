import { useQueryClient } from '@tanstack/react-query';
import {
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth } from '../lib/firebase';

interface AuthState {
  /** Firebase user; `undefined` while the initial session is restored. */
  user: User | null | undefined;
  signInWithGoogle(): Promise<void>;
  /** Exchanges a server-issued custom token (after email OTP verification). */
  signInWithEmailCode(customToken: string): Promise<void>;
  /** Explicitly links Google to the signed-in account (no silent merging). */
  linkGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getFirebaseAuth();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(auth ? undefined : null);

  useEffect(() => {
    if (!auth) return;
    return onIdTokenChanged(auth, (u) => {
      setUser((prev) => {
        // Drop all cached user data whenever the signed-in identity changes.
        if (prev?.uid !== u?.uid) queryClient.clear();
        return u;
      });
    });
  }, [auth, queryClient]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      // Installed PWAs and some mobile browsers block popups.
      if ((err as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
      else throw err;
    }
  }, [auth]);

  const signInWithEmailCode = useCallback(
    async (customToken: string) => {
      if (!auth) throw new Error('Firebase not configured');
      await signInWithCustomToken(auth, customToken);
    },
    [auth],
  );

  const linkGoogle = useCallback(async () => {
    const current = auth?.currentUser;
    if (!current) throw new Error('Not signed in');
    await linkWithPopup(current, new GoogleAuthProvider());
  }, [auth]);

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    queryClient.clear();
  }, [auth, queryClient]);

  const value = useMemo(
    () => ({ user, signInWithGoogle, signInWithEmailCode, linkGoogle, signOut }),
    [user, signInWithGoogle, signInWithEmailCode, linkGoogle, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Maps Firebase Auth error codes to translated message keys. */
export function authErrorKey(err: unknown) {
  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'auth.error.cancelled' as const;
    case 'auth/account-exists-with-different-credential':
    case 'auth/credential-already-in-use':
      return 'auth.error.linkRequired' as const;
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'auth.error.notConfigured' as const;
    case 'auth/too-many-requests':
      return 'auth.error.tooManyRequests' as const;
    case 'auth/network-request-failed':
      return 'auth.error.network' as const;
    default:
      return 'auth.error.generic' as const;
  }
}
