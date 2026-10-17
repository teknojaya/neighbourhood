import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { usingAuthEmulator } from '../../lib/firebase';
import { api } from '../../lib/api';
import { Alert, Button, Card } from '../../components/ui';

export function DemoSignIn() {
  const { signInWithEmailCode } = useAuth(); const navigate = useNavigate(); const [busy,setBusy] = useState(false); const [failed,setFailed] = useState(false);
  if (!usingAuthEmulator) return null;
  async function signIn(uid: string) { setBusy(true); setFailed(false); try { const result = await api('/api/v1/auth/demo', { method: 'POST', body: { uid }, schema: z.object({ customToken: z.string() }) }); await signInWithEmailCode(result.customToken); navigate('/'); } catch { setFailed(true); } finally { setBusy(false); } }
  return <Card className="space-y-3"><h2 className="font-semibold">Choose an account</h2><p className="text-sm text-stone-600">Use separate browsers to try both sides of sharing, borrowing and the pantry.</p><div className="flex flex-wrap gap-2">{(['owner', 'neighbour', 'volunteer', 'moderator', 'newcomer'] as const).map(role => <Button key={role} disabled={busy} variant="secondary" onClick={() => void signIn('demo-' + role)}>{role}</Button>)}</div>{failed && <Alert>Accounts are not ready. Run the playground seed first.</Alert>}</Card>;
}
