import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListingStatus } from '@neighbourhood/shared';
import { Alert, Button, Card } from '../../components/ui';
import { fetchListingDetail, transitionListing } from './listingApi';
import { ListingFormModal } from './ListingFormModal';

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['listing-detail', id],
    queryFn: ({ signal }) => fetchListingDetail(id!, signal),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 animate-pulse">
        <div className="h-6 w-24 rounded bg-stone-200" />
        <div className="h-64 w-full rounded-2xl bg-stone-200" />
        <div className="h-8 w-3/4 rounded bg-stone-200" />
        <div className="h-20 w-full rounded-xl bg-stone-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Alert tone="error">
          Failed to load item detail. {error instanceof Error ? error.message : 'Item may have been removed.'}
        </Alert>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  const { listing, privateDetails } = data;
  const isOwner = Boolean(privateDetails);
  const availableStock = listing.stock.total - listing.stock.reserved - listing.stock.collected;
  const photos = listing.photos || [];
  const currentPhoto = photos[activePhotoIdx]?.url || photos[0]?.url;

  const handleToggleStatus = async (to: ListingStatus) => {
    try {
      setActionError(null);
      await transitionListing(listing.id, to);
      await queryClient.invalidateQueries({ queryKey: ['listing-detail', listing.id] });
      await queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20 pt-2">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <span>←</span> Back
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
              listing.mode === 'donate'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {listing.mode === 'donate' ? '🎁 Donation' : '🔄 Loan / Pinjam'}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
              listing.status === 'active'
                ? 'bg-brand-100 text-brand-800'
                : listing.status === 'paused'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {listing.status}
          </span>
        </div>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {/* Photo Gallery */}
      <div className="overflow-hidden rounded-2xl bg-stone-100 shadow-sm ring-1 ring-stone-200">
        {currentPhoto ? (
          <div className="relative aspect-4/3 w-full bg-stone-900/5">
            <img
              src={currentPhoto}
              alt={listing.title}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex aspect-4/3 w-full flex-col items-center justify-center bg-stone-100 text-5xl">
            {listing.category === 'groceries' ? '🥫' : listing.category === 'appliances' ? '🔌' : '📦'}
            <span className="mt-2 text-xs font-medium text-stone-400">No photo uploaded</span>
          </div>
        )}

        {/* Thumbnail strip if multiple photos exist */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-stone-200 bg-white p-2">
            {photos.map((p, idx) => (
              <button
                key={p.path}
                type="button"
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${
                  activePhotoIdx === idx ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Info Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">{listing.title}</h1>
            <p className="text-sm font-medium text-stone-500 capitalize">
              {listing.category} • Condition: <span className="text-stone-800 font-semibold">{listing.condition.replace('_', ' ')}</span>
            </p>
          </div>

          <div className="rounded-xl bg-stone-50 px-3.5 py-2 text-right ring-1 ring-stone-200">
            <p className="text-lg font-bold text-stone-900">{availableStock}</p>
            <p className="text-[11px] font-medium text-stone-500">of {listing.stock.total} avail</p>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Description</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700 whitespace-pre-line">
            {listing.description || 'No description provided by the donor.'}
          </p>
        </div>
      </div>

      {/* Appliance Details (if applicable) */}
      {listing.appliance && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔌</span>
            <h2 className="text-sm font-bold text-stone-900">Appliance Specifications</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-stone-50 p-2.5">
              <span className="text-stone-400">Working Condition</span>
              <p className="mt-0.5 font-semibold text-stone-800 capitalize">
                {listing.appliance.workingStatus.replace('_', ' ')}
              </p>
            </div>
            {listing.appliance.brand && (
              <div className="rounded-lg bg-stone-50 p-2.5">
                <span className="text-stone-400">Brand / Merk</span>
                <p className="mt-0.5 font-semibold text-stone-800">{listing.appliance.brand}</p>
              </div>
            )}
            {listing.appliance.approxWeightKg && (
              <div className="rounded-lg bg-stone-50 p-2.5">
                <span className="text-stone-400">Approx. Weight</span>
                <p className="mt-0.5 font-semibold text-stone-800">{listing.appliance.approxWeightKg} kg</p>
              </div>
            )}
            <div className="rounded-lg bg-stone-50 p-2.5">
              <span className="text-stone-400">Pickup Accessibility</span>
              <p className="mt-0.5 font-semibold text-stone-800">
                Floor {listing.appliance.access.floorLevel ?? 0}
                {listing.appliance.access.elevatorAvailable ? ' (Elevator available)' : ' (Stairs only)'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Lending Terms (if applicable) */}
      {listing.mode === 'lend' && listing.lending && (
        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <h2 className="text-sm font-bold text-stone-900">Lending Schedule & Rules</h2>
          </div>
          <p className="text-xs text-stone-600">
            Maximum loan period: <strong className="text-stone-900">{listing.lending.maxLoanDays} days</strong>.
          </p>
          {listing.lending.notes && (
            <p className="text-xs italic text-stone-500">"{listing.lending.notes}"</p>
          )}
        </Card>
      )}

      {/* Neighborhood Location & Donor Info */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {listing.ownerDisplayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">{listing.ownerDisplayName}</p>
              <p className="text-xs text-stone-500">Verified Neighbour • Item Owner</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-700">
          <span className="text-base">📍</span>
          <div>
            <span className="font-semibold text-stone-800">{listing.location.areaLabel}</span>
            {listing.location.distanceKm !== undefined && (
              <span className="text-stone-500"> (~{listing.location.distanceKm} km away)</span>
            )}
          </div>
        </div>
      </Card>

      {/* ROLE 1: DONOR / OWNER PRIVATE DASHBOARD */}
      {isOwner && privateDetails && (
        <Card className="space-y-3 border-brand-200 bg-brand-50/40 p-4 ring-1 ring-brand-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <h2 className="text-sm font-bold text-stone-900">Owner Confidential Details</h2>
          </div>
          <p className="text-xs text-stone-500">
            This private information is only visible to you. Requesters will only see this after you approve their pickup.
          </p>

          <div className="rounded-lg bg-white p-3 text-xs shadow-2xs">
            <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">Private Pickup Instructions</span>
            <p className="mt-1 font-medium text-stone-800 whitespace-pre-line">
              {privateDetails.pickupInstructions || 'No private instructions specified.'}
            </p>
          </div>

          {privateDetails.contactNote && (
            <div className="rounded-lg bg-white p-3 text-xs shadow-2xs">
              <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">Contact Note</span>
              <p className="mt-1 font-medium text-stone-800">{privateDetails.contactNote}</p>
            </div>
          )}

          {/* Owner Quick Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => setIsEditModalOpen(true)}
            >
              ✏️ Edit Listing
            </Button>

            {listing.status === 'active' && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => handleToggleStatus('paused')}
              >
                ⏸ Pause Listing
              </Button>
            )}

            {listing.status === 'paused' && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => handleToggleStatus('active')}
              >
                ▶ Resume Listing
              </Button>
            )}

            {listing.status !== 'closed' && (
              <Button
                variant="secondary"
                className="text-xs text-rose-600 hover:bg-rose-50"
                onClick={() => handleToggleStatus('closed')}
              >
                ✕ Close Listing
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ROLE 2: RECIPIENT / BORROWER ACTION PANEL */}
      {!isOwner && (
        <Card className="space-y-4 border-stone-200 p-5 shadow-md">
          {requestSubmitted ? (
            <div className="space-y-2 text-center py-2">
              <span className="text-3xl">🎉</span>
              <h3 className="text-base font-bold text-stone-900">Request Sent to Donor</h3>
              <p className="text-xs text-stone-600">
                The donor will review your request. You can check the approval status on your <strong>Activity</strong> page.
              </p>
              <div className="pt-2">
                <Button variant="secondary" onClick={() => navigate('/activity?tab=receiving')}>
                  View in My Activity
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">
                  {listing.mode === 'donate' ? 'Interested in this item?' : 'Need to borrow this item?'}
                </h3>
                <p className="text-xs text-stone-500">
                  Exact address and coordination details will be shared once the donor approves your request.
                </p>
              </div>

              {availableStock > 0 && listing.status === 'active' ? (
                <Button
                  className="w-full py-3 text-sm font-semibold"
                  onClick={() => setRequestSubmitted(true)}
                >
                  {listing.mode === 'donate' ? '🎁 Request this Item' : '🔄 Request to Borrow'}
                </Button>
              ) : (
                <Alert tone="warning">
                  This item is currently {listing.status === 'paused' ? 'paused' : 'unavailable'}.
                </Alert>
              )}
            </>
          )}
        </Card>
      )}

      {/* Edit Modal (Donor) */}
      {isEditModalOpen && (
        <ListingFormModal
          existingListing={listing}
          existingPickupInstructions={privateDetails?.pickupInstructions}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['listing-detail', listing.id] });
            void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          }}
        />
      )}
    </div>
  );
}
