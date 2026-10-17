import { useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  CreateListingBody,
  ItemCategory,
  ItemCondition,
  ListingMode,
  ListingPublic,
} from '@neighbourhood/shared';
import { useMe } from '../../auth/useMe';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { createListing, updateListing, uploadListingPhoto } from './listingApi';

interface ListingFormModalProps {
  existingListing?: ListingPublic | null;
  existingPickupInstructions?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES: Array<{ value: ItemCategory; label: string; icon: string }> = [
  { value: 'groceries', label: 'Groceries / Food', icon: '🥫' },
  { value: 'clothing', label: 'Clothing & Wear', icon: '👕' },
  { value: 'books', label: 'Books & Learning', icon: '📚' },
  { value: 'household', label: 'Household Items', icon: '🏡' },
  { value: 'appliances', label: 'Appliances & Tools', icon: '🔌' },
  { value: 'mobility_aids', label: 'Mobility Aids', icon: '♿' },
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
  existingListing,
  existingPickupInstructions,
  onClose,
  onSuccess,
}: ListingFormModalProps) {
  const me = useMe();
  const defaultArea = me.data?.profile?.areaLabel ?? 'Local Neighbourhood';
  const defaultLocation = me.data?.profile?.homeLocation ?? { lat: -6.2, lng: 106.816 };

  // Form State
  const [mode, setMode] = useState<ListingMode>(existingListing?.mode ?? 'donate');
  const [category, setCategory] = useState<ItemCategory>(existingListing?.category ?? 'household');
  const [title, setTitle] = useState(existingListing?.title ?? '');
  const [description, setDescription] = useState(existingListing?.description ?? '');
  const [condition, setCondition] = useState<ItemCondition>(existingListing?.condition ?? 'good');
  const [quantity, setQuantity] = useState<number>(existingListing?.stock.total ?? 1);
  const [areaLabel, setAreaLabel] = useState(existingListing?.location.areaLabel ?? defaultArea);
  const [pickupInstructions, setPickupInstructions] = useState(
    existingPickupInstructions ?? 'Ring front door or message on arrival',
  );
  const [maxLoanDays, setMaxLoanDays] = useState<number>(existingListing?.lending?.maxLoanDays ?? 7);

  // Appliance specifics
  const [applianceStatus, setApplianceStatus] = useState<'working' | 'partially_working' | 'not_working' | 'unknown'>(
    existingListing?.appliance?.workingStatus ?? 'working',
  );
  const [applianceBrand, setApplianceBrand] = useState(existingListing?.appliance?.brand ?? '');
  const [applianceWeight, setApplianceWeight] = useState(
    existingListing?.appliance?.approxWeightKg ? String(existingListing.appliance.approxWeightKg) : '',
  );

  // Photo selection
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Status & error tracking
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (file) {
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
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
      console.info('[ListingFormModal] Submitting listing form');

      if (existingListing) {
        // Edit mode
        await updateListing(existingListing.id, {
          title: title.trim(),
          description: description.trim(),
          condition,
          quantity: mode === 'lend' ? 1 : quantity,
          areaLabel: areaLabel.trim(),
          pickupInstructions: pickupInstructions.trim(),
          lending: mode === 'lend' ? { maxLoanDays, depositRequired: false, notes: null } : null,
          appliance:
            category === 'appliances'
              ? {
                  workingStatus: applianceStatus,
                  brand: applianceBrand.trim() || null,
                  model: null,
                  dimensionsCm: null,
                  approxWeightKg: applianceWeight ? Number(applianceWeight) : null,
                  powerRequirement: null,
                  access: {
                    floorLevel: 0,
                    elevatorAvailable: true,
                    requiresDismantling: false,
                    requiresInstallation: false,
                    suggestedHelpers: 1,
                    notes: null,
                  },
                }
              : null,
        });

        // Upload photo if a new file was chosen
        if (photoFile) {
          await uploadListingPhoto(existingListing.id, photoFile);
        }
      } else {
        // Create mode
        const payload: CreateListingBody = {
          mode,
          category,
          title: title.trim(),
          description: description.trim(),
          condition,
          quantity: mode === 'lend' ? 1 : Number(quantity),
          areaLabel: areaLabel.trim() || defaultArea,
          exactLocation: defaultLocation,
          pickupInstructions: pickupInstructions.trim(),
          collection: { method: 'owner_location', communityPointId: null },
          lending: mode === 'lend' ? { maxLoanDays, depositRequired: false, notes: null } : null,
          bestBefore: null,
          appliance:
            category === 'appliances'
              ? {
                  workingStatus: applianceStatus,
                  brand: applianceBrand.trim() || null,
                  model: null,
                  dimensionsCm: null,
                  approxWeightKg: applianceWeight ? Number(applianceWeight) : null,
                  powerRequirement: null,
                  access: {
                    floorLevel: 0,
                    elevatorAvailable: true,
                    requiresDismantling: false,
                    requiresInstallation: false,
                    suggestedHelpers: 1,
                    notes: null,
                  },
                }
              : null,
        };

        const created = await createListing(payload);

        // Upload photo if selected
        if (photoFile) {
          await uploadListingPhoto(created.id, photoFile);
        }
      }

      onSuccess();
    } catch (err) {
      console.error('[ListingFormModal] Submit failed:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 className="text-xl font-bold text-stone-900">
            {existingListing ? 'Edit Item' : 'Share or Lend an Item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Mode Switcher: Donate vs Lend */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase">Offering Mode</label>
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setMode('donate')}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'donate' ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600'
                }`}
              >
                🎁 Give away (Donation)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('lend');
                  setQuantity(1);
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'lend' ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600'
                }`}
              >
                🤝 Lend (Borrow & Return)
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
              <label className="block text-sm font-medium text-stone-800">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-700 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-800">Condition *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-700 focus:outline-none"
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

          {/* Appliance Specifics */}
          {category === 'appliances' && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-3">
              <p className="text-xs font-bold text-stone-700 uppercase">⚡ Appliance Specifications</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Working Status</label>
                  <select
                    value={applianceStatus}
                    onChange={(e) => setApplianceStatus(e.target.value as any)}
                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="working">Fully Working</option>
                    <option value="partially_working">Partially Working</option>
                    <option value="not_working">Not Working / For Parts</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700">Brand / Maker</label>
                  <input
                    type="text"
                    placeholder="e.g. Philips, Cosmos"
                    value={applianceBrand}
                    onChange={(e) => setApplianceBrand(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700">Approx. Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={applianceWeight}
                  onChange={(e) => setApplianceWeight(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <p className="text-[11px] text-stone-500">
                Note: Recipients are responsible for arranging their own helpers and transport.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-800">Description</label>
            <textarea
              rows={3}
              placeholder="Tell neighbours more about this item, usage tips, or reasons for sharing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-700 focus:outline-none"
            />
          </div>

          {/* Private Pickup Instructions */}
          <div>
            <label className="block text-sm font-medium text-stone-800">
              Private Pickup Instructions *
            </label>
            <textarea
              rows={2}
              placeholder="Private details shown ONLY to the confirmed recipient (e.g. House No. 12, ring bell twice)"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-700 focus:outline-none"
              required
            />
          </div>

          {/* Photo Upload Picker */}
          <div>
            <label className="block text-sm font-medium text-stone-800">Item Photo</label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handlePhotoSelect}
              className="mt-1 block w-full text-xs text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-xs file:font-semibold hover:file:bg-stone-200"
            />
            {photoPreview && (
              <div className="mt-2 flex items-center gap-2">
                <img src={photoPreview} alt="Preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-stone-300" />
                <span className="text-xs text-stone-500">Ready to upload on save</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : existingListing ? 'Save Changes' : 'Publish Listing'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
