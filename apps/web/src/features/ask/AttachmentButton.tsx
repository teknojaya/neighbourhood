import { useId, useRef, type Ref } from 'react';
import { ActionPill } from '../../components/ui';
import { CameraIcon, CloseIcon, ImageIcon, PlusIcon } from '../../components/icons';

export function AttachmentButton({ disabled, uploading, onFile, triggerRef }: { disabled: boolean; uploading: boolean; onFile(file: File): void; triggerRef?: Ref<HTMLButtonElement> }) {
  const id = useId(); const menu = useRef<HTMLDivElement>(null); const camera = useRef<HTMLInputElement>(null); const library = useRef<HTMLInputElement>(null);
  function choose(input: HTMLInputElement | null) { menu.current?.hidePopover(); input?.click(); }
  return <>
    <button ref={triggerRef} type="button" popoverTarget={id} aria-label={uploading ? 'Uploading photo' : 'Add attachments'} title="Add a photo" disabled={disabled} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 text-brand-800 hover:bg-brand-50 disabled:text-stone-400"><PlusIcon /></button>
    <div id={id} ref={menu} popover="auto" aria-label="Add a photo" className="attachment-popover rounded-2xl border border-stone-200 bg-white p-3 text-stone-900 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-3"><p className="font-semibold">Add a photo</p><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close photo options" className="flex h-11 w-11 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"><CloseIcon /></button></div>
      <div className="grid gap-2"><ActionPill type="button" className="justify-start" onClick={() => choose(camera.current)}><CameraIcon />Take photo</ActionPill><ActionPill type="button" className="justify-start" onClick={() => choose(library.current)}><ImageIcon />Photo library</ActionPill></div><p className="mt-3 text-xs text-stone-600">Up to 2 photos. JPEG, PNG or WebP, 4 MB each.</p>
    </div>
    <input ref={camera} aria-label="Take photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
    <input ref={library} aria-label="Add photo" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
  </>;
}
