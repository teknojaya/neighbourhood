# Neighbourhood seed repair — 2026-10-18

The old seed assigned the same image to unrelated products, used positional IDs
that could change meaning when the catalog grew, and created a new photographed
listing for each workflow state. Running the demo and playground seeds also
created overlapping catalogs.

The current catalog defines 17 explicit products with unique photo assets and
stable semantic IDs. It includes the supplied Indonesian household/food assets
and user-supplied community meal photograph. Requests, loans and saved items
reference these products instead of creating more listing copies. The legacy
demo command delegates to the same seed. No fallback category photo is used.

Cooked food has same-day collection notes and a best-before date that reruns
preserve. The community rice meals have their own confirmed point inventory,
separate from the dry rice/beans/lentils parcels. Images are sample content,
not evidence of actual goods or medical suitability.

## Local saved-data changes

- Full PostgreSQL dumps and affected original photo bytes were saved outside
  the repository before repair, under the workspace's `tmp/backups/seed-catalog`.
- Removed 82 obsolete recognized seed listings and their fixture workflows.
  Existing bookmarks were merged into the product matching the actual photo.
- Consolidated an old seeded jacket listing into its catalog product while
  preserving the real request and conversation IDs and original owner.
- With the user's confirmation, retained “Utility jackets and scarf” and
  consolidated the duplicate personal jacket listing into it.
- Added a distinct generated seed jacket photo; the retained resident upload
  was not changed. All accounts, profiles, saved needs and real chats remain.
- Final inventory is 17 catalog listings plus the retained personal listing.

`cleanup:duplicates` inspects by default and is restricted to a local database
and demo emulators. Apply requires a successful backup. It recognizes seed IDs,
protects custom photos and real interactions, rechecks records inside a locked
transaction, and does not delete images from storage. Explicit product merges
preserve real conversations and recompute committed stock.

## Verification

- API typecheck, repository lint and 68 API unit/HTTP tests.
- `smoke:seed-catalog`: matching unique photos, owner/stock consistency, current
  saved titles, and rerun preservation of listings, workflows, photo IDs, read
  markers and bookmarks.
- `smoke:playground`: all five seeded accounts, independent browser contexts,
  profiles, requests, notifications, saved needs and mapped products.
- Supplied community image loaded in Home and its detail page without browser
  exceptions; captures are ignored local artifacts under
  `apps/web/.impeccable/review/seed-catalog`.

The browser check first timed out on the existing development server; it passed
on an isolated API/web instance using the same local data and emulators.
