import { MAX_RADIUS_KM, MIN_RADIUS_KM, RadiusKmSchema } from '@neighbourhood/shared';
import { Button, TextField } from '../../components/ui';
import { ChevronDownIcon } from '../../components/icons';

export function RadiusInput({ value, onApply }: { value: number; onApply(radius: number): void }) {
  return <details className="text-sm text-brand-800"><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 font-semibold [&_svg]:h-[18px] [&_svg]:w-[18px]">Search distance · {value} km<ChevronDownIcon /></summary>
    <form className="mt-3 max-w-sm space-y-2" onSubmit={event => { event.preventDefault(); const radius = RadiusKmSchema.safeParse(new FormData(event.currentTarget).get('radius')); if (radius.success) onApply(radius.data); }}>
      <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><TextField key={value} label="Search radius (km)" name="radius" type="number" inputMode="numeric" min={MIN_RADIUS_KM} max={MAX_RADIUS_KM} step={1} defaultValue={value} required /></div><Button type="submit">Apply radius</Button></div><p className="text-sm text-stone-600">Enter 1–50 km, in whole kilometres.</p>
    </form>
  </details>;
}
