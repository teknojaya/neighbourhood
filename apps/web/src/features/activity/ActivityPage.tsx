import { useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListingPublic, ListingStatus } from '@neighbourhood/shared';
import { Alert, Button, Card } from '../../components/ui';
import { t } from '../../i18n';
import { fetchMyListings, transitionListing } from '../listings/listingApi';
import { ListingFormModal } from '../listings/ListingFormModal';

type ActivityTab = 'giving' | 'receiving';

function ListingThumbnail({ url, title, category }: { url?: string; title: string; category: string }) {
  const [hasError, setHasError] = useState(false);

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt={title}
        onError={() => setHasError(true)}
        className="h-14 w-14 rounded-xl object-cover ring-1 ring-stone-200"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl">
      {category === 'groceries' ? '🥫' : category === 'appliances' ? '🔌' : '📦'}
    </div>
  );
}

/**
 * ActivityPage provides a dual-role management center:
 * 1. Giving & Lending: For item owners managing their listings and incoming neighbour requests.
 * 2. Receiving & Borrowing: For recipients tracking requested items and return due dates.
 */
export function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') === 'receiving' ? 'receiving' : 'giving') as ActivityTab;
  const qc = useQueryClient();

  // Modal State for creating or editing listings
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ListingPublic | null>(null);

  // Fetch my listings from backend
  const {
    data: myListings = [],
    isLoading: isListingsLoading,
    error: listingsError,
  } = useQuery({
    queryKey: ['my-listings'],
    queryFn: ({ signal }) => fetchMyListings(signal),
    enabled: currentTab === 'giving',
  });

  const handleTabChange = (tab: ActivityTab) => {
    try {
      console.info(`[ActivityPage] Switching tab to: ${tab}`);
      setSearchParams({ tab });
    } catch (err) {
      console.error('[ActivityPage] Failed to switch tab:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: ListingPublic) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: ListingPublic) => {
    try {
      const nextStatus: ListingStatus = item.status === 'active' ? 'paused' : 'active';
      console.info(`[ActivityPage] Toggling status for ${item.id} to ${nextStatus}`);
      await transitionListing(item.id, nextStatus);
      void qc.invalidateQueries({ queryKey: ['my-listings'] });
    } catch (err) {
      console.error('[ActivityPage] Toggle status failed:', err);
    }
  };

  const handleCloseListing = async (item: ListingPublic) => {
    const confirmed = window.confirm(`Are you sure you want to close and unlist "${item.title}"?`);
    if (!confirmed) return;

    try {
      console.info(`[ActivityPage] Closing listing ${item.id}`);
      await transitionListing(item.id, 'closed');
      void qc.invalidateQueries({ queryKey: ['my-listings'] });
    } catch (err) {
      console.error('[ActivityPage] Close listing failed:', err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-stone-900">{t('activity.title')}</h1>
        <p className="text-sm text-stone-600">{t('activity.subtitle')}</p>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="grid grid-cols-2 rounded-2xl bg-stone-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => handleTabChange('giving')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
            currentTab === 'giving'
              ? 'bg-white font-semibold text-brand-800 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span>🎁</span>
          <span>{t('activity.tab.giving')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('receiving')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
            currentTab === 'receiving'
              ? 'bg-white font-semibold text-brand-800 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span>📥</span>
          <span>{t('activity.tab.receiving')}</span>
        </button>
      </div>

      {/* Tab 1 Content: Giving & Lending (Owner/Donor Role) */}
      {currentTab === 'giving' && (
        <div className="space-y-5">
          {/* Quick Action Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <div>
              <p className="font-semibold text-brand-900">Have items to donate or lend?</p>
              <p className="text-xs text-brand-700">List an item in under 2 minutes for nearby neighbours.</p>
            </div>
            <Button variant="primary" className="text-xs shrink-0" onClick={handleCreateNew}>
              + New Item
            </Button>
          </div>

          {/* Incoming Requests Section */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                Incoming Requests
              </h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">0 pending</span>
            </div>

            <Card className="space-y-2 py-6 text-center">
              <div className="text-2xl">📬</div>
              <p className="text-sm font-medium text-stone-700">No incoming requests yet</p>
              <p className="text-xs text-stone-500">
                When neighbours ask for your items, you will review and approve them here.
              </p>
            </Card>
          </section>

          {/* My Active Listings & Shared Items */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                My Shared Items
              </h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                {myListings.length} items
              </span>
            </div>

            {listingsError && (
              <Alert tone="error">
                Failed to load items. {listingsError instanceof Error ? listingsError.message : ''}
              </Alert>
            )}

            {isListingsLoading ? (
              <Card className="py-8 text-center text-stone-500 text-sm">
                Loading your shared items...
              </Card>
            ) : myListings.length === 0 ? (
              <Card className="space-y-3 py-8 text-center">
                <div className="text-3xl">📦</div>
                <div className="space-y-1">
                  <p className="font-medium text-stone-800">{t('activity.giving.emptyTitle')}</p>
                  <p className="text-xs text-stone-500">{t('activity.giving.emptyDesc')}</p>
                </div>
                <div>
                  <Button variant="secondary" className="text-xs" onClick={handleCreateNew}>
                    {t('activity.giving.action')}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-3">
                {myListings.map((item) => {
                  const available = item.stock.total - item.stock.reserved - item.stock.collected;
                  const firstPhoto = item.photos[0]?.url;

                  return (
                    <Card key={item.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Link to={`/listings/${item.id}`} className="shrink-0 transition-transform hover:opacity-90 active:scale-95">
                            <ListingThumbnail
                              url={firstPhoto}
                              title={item.title}
                              category={item.category}
                            />
                          </Link>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  item.mode === 'donate'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {item.mode}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  item.status === 'active'
                                    ? 'bg-brand-100 text-brand-800'
                                    : item.status === 'paused'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-stone-200 text-stone-600'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>

                            <Link
                              to={`/listings/${item.id}`}
                              className="block font-semibold text-stone-900 leading-tight hover:text-brand-700 hover:underline"
                            >
                              {item.title}
                            </Link>
                            <p className="text-xs text-stone-500">
                              {item.category} • {item.condition.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-stone-800">
                            {available} <span className="text-xs font-normal text-stone-500">avail</span>
                          </p>
                          <p className="text-[11px] text-stone-500">{item.stock.total} total</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-2.5">
                        <Link
                          to={`/listings/${item.id}`}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                        >
                          👁 Details
                        </Link>
                        {item.status !== 'closed' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                            >
                              {item.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                            >
                              ✏ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCloseListing(item)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              ✕ Close
                            </button>
                          </>
                        )}
                        {item.status === 'closed' && (
                          <span className="text-xs text-stone-400 italic">Archived listing</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2 Content: Receiving & Borrowing (Recipient Role) */}
      {currentTab === 'receiving' && (
        <div className="space-y-5">
          {/* Active Borrowed Items */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                Active Borrowed Items
              </h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                0 on loan
              </span>
            </div>

            <Card className="space-y-2 py-6 text-center">
              <div className="text-2xl">⏳</div>
              <p className="text-sm font-medium text-stone-700">No borrowed items at the moment</p>
              <p className="text-xs text-stone-500">
                Track return schedules and pickup instructions here to avoid schedule overlap.
              </p>
            </Card>
          </section>

          {/* Outgoing Requests Section */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                My Requests
              </h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">0 requests</span>
            </div>

            <Card className="space-y-3 py-8 text-center">
              <div className="text-3xl">🔍</div>
              <div className="space-y-1">
                <p className="font-medium text-stone-800">{t('activity.receiving.emptyTitle')}</p>
                <p className="text-xs text-stone-500">{t('activity.receiving.emptyDesc')}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Link to="/explore">
                  <Button variant="secondary" className="text-xs">
                    {t('activity.receiving.action')}
                  </Button>
                </Link>
                <Link to="/needs">
                  <Button variant="primary" className="text-xs">
                    Ask AI Assistant ✨
                  </Button>
                </Link>
              </div>
            </Card>
          </section>
        </div>
      )}

      {/* Listing Form Modal */}
      {isModalOpen && (
        <ListingFormModal
          existingListing={editingItem}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            void qc.invalidateQueries({ queryKey: ['my-listings'] });
          }}
        />
      )}
    </div>
  );
}
