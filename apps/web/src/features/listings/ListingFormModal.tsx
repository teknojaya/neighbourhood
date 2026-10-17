import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { AI_LIMITS } from '@neighbourhood/shared';
import { useAuth } from '../../auth/AuthProvider';
import { getShareDraft, removeShareDraft, saveShareDraft } from './shareDraftStore';
import type {
  CreateListingBody,
  AskListingDraft,
  ItemCategory,
  ItemCondition,
  ListingMode,
  ListingPublic,
} from '@neighbourhood/shared';
import { useMe } from '../../auth/useMe';
import { Alert, Button, FormSurface, TextField } from '../../components/ui';
import { CloseIcon } from '../../components/icons';
import { ApiError } from '../../lib/api';
import { createRetryKey } from '../activity/retry-key';
import { createListing, updateListing, uploadListingPhoto } from './listingApi';

interface ListingFormModalProps {
  inline?: boolean;
  existingListing?: ListingPublic | null;
  initialDraft?: AskListingDraft['data'];
  onPrepare?: (body: CreateListingBody) => Promise<void>;
  pointInventory?: { itemId: string; pointId: string; areaLabel: string };
  existingPickupInstructions?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES: Array<{ value: ItemCategory; label: string; icon: string }> = [
  { value: 'groceries', label: 'Groceries / Food', icon: '' },
  { value: 'clothing', label: 'Clothing & Wear', icon: '' },
  { value: 'books', label: 'Books & Learning', icon: '' },
  { value: 'household', label: 'Household Items', icon: '' },
  { value: 'appliances', label: 'Appliances & Tools', icon: '' },
  { value: 'mobility_aids', label: 'Mobility Aids', icon: '' },
];

const CONDITIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: 'new', label: 'New / Unopened' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'needs_repair', label: 'Needs Repair' },
];

/**
 * Modal dialog for creating or updating an item listing.
 * Supports donation vs loan modes, appliance specifications, and photo uploads.
 */
export function ListingFormModal({
  inline = false,
  existingListing,
  initialDraft,
  onPrepare,
  pointInventory,
  existingPickupInstructions,
  onClose,
  onSuccess,
}: ListingFormModalProps) {
  const { user } = useAuth();
  const [restored] = useState(() => inline && user ? getShareDraft(user.uid) : undefined);
  const cleared = useRef(false);
  const me = useMe();
  const defaultArea = me.data?.profile?.areaLabel ?? 'Local Neighbourhood';
  const defaultLocation = me.data?.profile?.homeLocation;
  const keys = useRef(restored?.retryKeys ?? createRetryKey());
  const photoKey = useRef(restored?.photoKey ?? crypto.randomUUID());

  // Form State
  const [mode, setMode] = useState<ListingMode>(restored?.mode ?? existingListing?.mode ?? initialDraft?.mode ?? 'donate');
  const [category, setCategory] = useState<ItemCategory>(restored?.category ?? existingListing?.category ?? initialDraft?.category ?? 'household');
  const [title, setTitle] = useState(restored?.title ?? existingListing?.title ?? initialDraft?.title ?? '');
  const [description, setDescription] = useState(restored?.description ?? existingListing?.description ?? initialDraft?.description ?? '');
  const [condition, setCondition] = useState<ItemCondition>(restored?.condition ?? existingListing?.condition ?? initialDraft?.condition ?? 'good');
  const [quantity, setQuantity] = useState<number>(restored?.quantity ?? existingListing?.stock.total ?? initialDraft?.quantity ?? 1);
  const [areaLabel] = useState(existingListing?.location.areaLabel ?? defaultArea);
  const [pickupInstructions, setPickupInstructions] = useState(
    restored?.pickupInstructions ?? existingPickupInstructions ?? 'Ring front door or message on arrival',
  );
  const [bestBefore,setBestBefore] = useState(restored?.bestBefore ?? existingListing?.bestBefore ?? '');
  const [applianceModel,setApplianceModel] = useState(restored?.applianceModel ?? existingListing?.appliance?.model ?? '');
  const [powerRequirement,setPowerRequirement] = useState(restored?.powerRequirement ?? existingListing?.appliance?.powerRequirement ?? '');
  const [maxLoanDays, setMaxLoanDays] = useState<number>(restored?.maxLoanDays ?? existingListing?.lending?.maxLoanDays ?? 7);

  // Appliance specifics
  const [applianceStatus, setApplianceStatus] = useState<'working' | 'partially_working' | 'not_working' | 'unknown'>(
    restored?.applianceStatus ?? existingListing?.appliance?.workingStatus ?? 'unknown',
  );
  const [applianceBrand, setApplianceBrand] = useState(restored?.applianceBrand ?? existingListing?.appliance?.brand ?? '');
  const [applianceWeight, setApplianceWeight] = useState(
    restored?.applianceWeight ?? (existingListing?.appliance?.approxWeightKg ? String(existingListing.appliance.approxWeightKg) : ''),
  );

  const [dimensions,setDimensions] = useState(restored?.dimensions ?? { width: String(existingListing?.appliance?.dimensionsCm?.width ?? ''), height: String(existingListing?.appliance?.dimensionsCm?.height ?? ''), depth: String(existingListing?.appliance?.dimensionsCm?.depth ?? '') });
  const [floor,setFloor] = useState(restored?.floor ?? String(existingListing?.appliance?.access.floorLevel ?? ''));
  const [elevator,setElevator] = useState<boolean | null>(restored?.elevator ?? existingListing?.appliance?.access.elevatorAvailable ?? null);
  const [dismantling,setDismantling] = useState<boolean | null>(restored?.dismantling ?? existingListing?.appliance?.access.requiresDismantling ?? null);
  const [installation,setInstallation] = useState<boolean | null>(restored?.installation ?? existingListing?.appliance?.access.requiresInstallation ?? null);
  const [helpers,setHelpers] = useState(restored?.helpers ?? String(existingListing?.appliance?.access.suggestedHelpers ?? ''));
  const [accessNotes,setAccessNotes] = useState(restored?.accessNotes ?? existingListing?.appliance?.access.notes ?? '');
  // Photo selection
  const [photoFile, setPhotoFile] = useState<File | null>(restored?.photoFile ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Status & error tracking
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => { const url = photoFile ? URL.createObjectURL(photoFile) : null; setPhotoPreview(url); return () => { if (url) URL.revokeObjectURL(url); }; }, [photoFile]);
  useEffect(() => {
    if (inline && user && !cleared.current) saveShareDraft(user.uid, { mode, category, title, description, condition, quantity, pickupInstructions, bestBefore, applianceModel, powerRequirement, maxLoanDays, applianceStatus, applianceBrand, applianceWeight, dimensions, floor, elevator, dismantling, installation, helpers, accessNotes, photoFile, retryKeys: keys.current, photoKey: photoKey.current });
  }, [inline, user, mode, category, title, description, condition, quantity, pickupInstructions, bestBefore, applianceModel, powerRequirement, maxLoanDays, applianceStatus, applianceBrand, applianceWeight, dimensions, floor, elevator, dismantling, installation, helpers, accessNotes, photoFile]);
  function clearDraft() { cleared.current = true; if (inline && user) removeShareDraft(user.uid); }

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (file) {
        if (!(AI_LIMITS.imageMimeTypes as readonly string[]).includes(file.type) || file.size > AI_LIMITS.imageMaxBytes) {
          setErrorMessage('Choose a JPEG, PNG or WebP photo under 4 MB.'); e.target.value = ''; return;
        }
        setErrorMessage(null);
        photoKey.current = crypto.randomUUID();
        setPhotoFile(file);
      }
    } catch (err) {
      console.error('[ListingFormModal] Error previewing image:', err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (title.trim().length < 3) {
      setErrorMessage('Title must be at least 3 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (!existingListing && !defaultLocation) throw new Error('Set your pickup location in Profile before sharing an item.');

      if (existingListing) {
        // Edit mode
        await updateListing(existingListing.id, {
          title: title.trim(),
          description: description.trim(),
          condition,
          quantity: mode === 'lend' ? 1 : quantity,
          areaLabel: areaLabel.trim(),
          pickupInstructions: pickupInstructions.trim(),
          bestBefore: bestBefore || null,
          lending: mode === 'lend' ? { maxLoanDays, depositRequired: false, notes: null } : null,
          appliance:
            category === 'appliances'
              ? {
                  workingStatus: applianceStatus,
                  brand: applianceBrand.trim() || null,
                  model: applianceModel || null,
                  dimensionsCm: dimensions.width && dimensions.height && dimensions.depth ? { width: Number(dimensions.width), height: Number(dimensions.height), depth: Number(dimensions.depth) } : null,
                  approxWeightKg: applianceWeight ? Number(applianceWeight) : null,
                  powerRequirement: powerRequirement || null,
                  access: {
                    floorLevel: floor ? Number(floor) : null,
                    elevatorAvailable: elevator,
                    requiresDismantling: dismantling,
                    requiresInstallation: installation,
                    suggestedHelpers: helpers ? Number(helpers) : null,
                    notes: accessNotes || null,
                  },
                }
              : null,
        });

        // Upload photo if a new file was chosen
        if (photoFile) {
          await uploadListingPhoto(existingListing.id, photoFile, photoKey.current);
        }
      } else {
        // Create mode
        const payload: CreateListingBody = {
          pointInventoryItemId: pointInventory?.itemId ?? null,
          mode,
          category,
          title: title.trim(),
          description: description.trim(),
          condition,
          quantity: mode === 'lend' ? 1 : Number(quantity),
          areaLabel: pointInventory?.areaLabel ?? defaultArea,
          exactLocation: defaultLocation!,
          pickupInstructions: pickupInstructions.trim(),
          collection: pointInventory ? { method: 'community_point', communityPointId: pointInventory.pointId } : { method: 'owner_location', communityPointId: null },
          bestBefore: bestBefore || null,
          lending: mode === 'lend' ? { maxLoanDays, depositRequired: false, notes: null } : null,
          appliance:
            category === 'appliances'
              ? {
                  workingStatus: applianceStatus,
                  brand: applianceBrand.trim() || null,
                  model: applianceModel || null,
                  dimensionsCm: dimensions.width && dimensions.height && dimensions.depth ? { width: Number(dimensions.width), height: Number(dimensions.height), depth: Number(dimensions.depth) } : null,
                  approxWeightKg: applianceWeight ? Number(applianceWeight) : null,
                  powerRequirement: powerRequirement || null,
                  access: {
                    floorLevel: floor ? Number(floor) : null,
                    elevatorAvailable: elevator,
                    requiresDismantling: dismantling,
                    requiresInstallation: installation,
                    suggestedHelpers: helpers ? Number(helpers) : null,
                    notes: accessNotes || null,
                  },
                }
              : null,
        };

        if (onPrepare) {
          if (photoFile) throw new Error('Attach photos in Ask before preparing publication.');
          await onPrepare(payload);
          onSuccess();
          return;
        }
        const created = await createListing(payload, keys.current.forPayload(payload));

        // Upload photo if selected
        if (photoFile) {
          await uploadListingPhoto(created.id, photoFile, photoKey.current);
        }
      }

      clearDraft(); onSuccess();
    } catch (err) {

      if (err instanceof ApiError && err.details && err.details.length > 0) {
        setErrorMessage(`${err.message}: ${err.details.map((d) => `${d.path} (${d.message})`).join(', ')}`);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save listing. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSurface inline={inline} onClose={onClose}>
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 className="text-xl font-bold text-stone-900">
            {existingListing ? 'Edit item' : 'Donate / Share an item'}
          </h2>
          <button
            type="button"
            aria-label="Close item form"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
          >
            <CloseIcon />
          </button>
        </div>

        {inline && <p className="mt-3 text-sm text-stone-600">{restored ? 'Draft restored. ' : ''}Your draft stays here while you use the app. Refreshing or signing out clears it.</p>}

        {errorMessage && (
          <div className="mt-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Mode Switcher: Donate vs Lend */}
          <div>
            <p className="block text-sm font-semibold text-stone-700">Offering</p>
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                aria-pressed={mode === 'donate'}
                onClick={() => setMode('donate')}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'donate' ? 'bg-white text-brand-800 ' : 'text-stone-600'
                }`}
              >
                 Donate (free to keep)
              </button>
              <button
                type="button"
                aria-pressed={mode === 'lend'}
                onClick={() => {
                  setMode('lend');
                  setQuantity(1);
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'lend' ? 'bg-white text-brand-800 ' : 'text-stone-600'
                }`}
              >
                 Lend (return later)
              </button>
            </div>
          </div>

          {/* Title */}
          <TextField
            label="Item Title *"
            placeholder="e.g. Rice Cooker 1.8L, Blender Philips, English Dictionary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Category & Condition */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-800" htmlFor="listing-field-0">Category *</label>
<select
id="listing-field-0"                 value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm  focus:border-brand-700 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-800" htmlFor="listing-field-1">Condition *</label>
<select
id="listing-field-1"                 value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm  focus:border-brand-700 focus:outline-none"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity & Lending terms */}
          {mode === 'donate' ? (
            <TextField
              label="Quantity Available *"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          ) : (
            <div>
              <TextField
                label="Maximum Loan Duration (Days) *"
                type="number"
                min={1}
                max={90}
                value={maxLoanDays}
                onChange={(e) => setMaxLoanDays(Number(e.target.value))}
                hint="Lending is single-item only (quantity: 1 unit)"
                required
              />
            </div>
          )}

          {category === 'groceries' && <TextField label="Best before, if known" type="date" value={bestBefore} onChange={e => setBestBefore(e.target.value)} />}
          {/* Appliance Specifics */}
          {category === 'appliances' && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-3">
              <p className="text-sm font-bold text-stone-700"> Appliance Specifications</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700" htmlFor="listing-field-2">Working Status</label>
<select
id="listing-field-2"                     value={applianceStatus}
                    onChange={(e) => setApplianceStatus(e.target.value as typeof applianceStatus)}
                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
                  >
                    <option value="working">Fully Working</option>
                    <option value="partially_working">Partially Working</option>
                    <option value="not_working">Not Working / For Parts</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700" htmlFor="listing-field-3">Brand / Maker</label>
<input
id="listing-field-3"                     type="text"
                    placeholder="e.g. Philips, Cosmos"
                    value={applianceBrand}
                    onChange={(e) => setApplianceBrand(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700" htmlFor="listing-field-4">Approx. Weight (kg)</label>
<input
id="listing-field-4"                   type="number"
                  placeholder="e.g. 5"
                  value={applianceWeight}
                  onChange={(e) => setApplianceWeight(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2"><TextField label="Model, if known" maxLength={80} value={applianceModel} onChange={e => setApplianceModel(e.target.value)} /><TextField label="Power requirement, if known" maxLength={80} value={powerRequirement} onChange={e => setPowerRequirement(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">{(['width','height','depth'] as const).map(key => <TextField key={key} label={key + ' (cm)'} type="number" min={1} max={1000} value={dimensions[key]} onChange={e => setDimensions({ ...dimensions, [key]: e.target.value })} />)}</div>
              <div className="grid grid-cols-2 gap-2"><TextField label="Pickup floor" type="number" min={-5} max={100} value={floor} onChange={e => setFloor(e.target.value)} /><TextField label="Helpers suggested" type="number" min={1} max={6} value={helpers} onChange={e => setHelpers(e.target.value)} /></div>
              <label className="block text-sm">Elevator available<select className="block min-h-11 w-full rounded-xl border p-2" value={elevator === null ? '' : String(elevator)} onChange={e => setElevator(e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not confirmed</option><option value="true">Yes</option><option value="false">No</option></select></label>
              <label className="block text-sm">Dismantling needed<select className="block min-h-11 w-full rounded-xl border p-2" value={dismantling === null ? '' : String(dismantling)} onChange={e => setDismantling(e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not confirmed</option><option value="true">Yes</option><option value="false">No</option></select></label>
              <label className="block text-sm">Installation needed<select className="block min-h-11 w-full rounded-xl border p-2" value={installation === null ? '' : String(installation)} onChange={e => setInstallation(e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not confirmed</option><option value="true">Yes</option><option value="false">No</option></select></label>
              <TextField label="Pickup access notes" maxLength={300} value={accessNotes} onChange={e => setAccessNotes(e.target.value)} />
              <p className="text-[11px] text-stone-500">
                Note: Recipients are responsible for arranging their own helpers and transport.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-800" htmlFor="listing-field-5">Description</label>
<textarea
id="listing-field-5"               rows={3}
              placeholder="Tell neighbours more about this item, usage tips, or reasons for sharing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm  focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Private Pickup Instructions */}
          <div>
            <label className="block text-sm font-medium text-stone-800" htmlFor="listing-field-6">
              Private Pickup Instructions *
            </label>
<textarea
id="listing-field-6"               rows={2}
              placeholder="Private details shown ONLY to the confirmed recipient (e.g. House No. 12, ring bell twice)"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm  focus:border-brand-700 focus:outline-none"
              required
            />
          </div>

          {/* Photo Upload Picker */}
          <div>
            <label className="block text-sm font-medium text-stone-800" htmlFor="listing-field-7">Item Photo</label>
<input
id="listing-field-7"               type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handlePhotoSelect}
              className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-stone-200"
            />
            <p className="mt-1 text-sm text-stone-600">JPEG, PNG or WebP, up to 4 MB. {onPrepare ? 'Attach photos in Ask before preparing this listing.' : 'Choose a clear photo of the actual item.'}</p>
            {photoPreview && (
              <div className="mt-2 flex items-center gap-2">
                <img src={photoPreview} alt="Preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-stone-300" />
                <span className="text-sm text-stone-500">Ready to upload on save</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {inline && <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => { clearDraft(); onClose(); }}>Discard draft</Button>}
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : existingListing ? 'Save Changes' : onPrepare ? 'Prepare review card' : 'Publish Listing'}
            </Button>
          </div>
        </form>
    </FormSurface>
  );
}
