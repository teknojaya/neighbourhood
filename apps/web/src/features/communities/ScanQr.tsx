import { useState } from 'react';
import { Alert } from '../../components/ui';

type Detector = { detect(image: ImageBitmap): Promise<Array<{ rawValue: string }>> };
export function ScanQr({ onScan }: { onScan(value: string): void }) {
  const [error,setError] = useState('');
  return <div className="space-y-2"><label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold">Scan point QR photo<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const ctor = (window as unknown as { BarcodeDetector?: new (config: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!ctor) { setError('This browser cannot scan QR photos. Use your phone camera to read the token and paste it above.'); return; }
    let bitmap: ImageBitmap | null = null;
    try { setError(''); bitmap = await createImageBitmap(file); const found = await new ctor({ formats: ['qr_code'] }).detect(bitmap); const token = found[0]?.rawValue; if (!token) throw new Error('No point QR found in this photo'); onScan(token); } catch (err) { setError(err instanceof Error ? err.message : 'Could not read QR'); } finally { bitmap?.close(); event.target.value = ''; }
  }} /></label>{error && <Alert>{error}</Alert>}</div>;
}
