# Engineer 2 handoff: requests and communication

Branch: `feat/requests-communication`. Donation requests, private chat, in-app
notifications, and private saved needs are implemented. They have HTTP tests
and PostgreSQL integration tests. The full listing flow still needs Engineer 1.

Ask now has private AI sessions, history, photo input, bounded tool calls and
confirmation cards. Saved needs remain independent. See `ask-agent-handoff.md`
for the current agent tools, recovery behavior and integration boundaries.

The brief's special-case assistance item is treated as **product categories**.
The app uses the shared `ItemCategorySchema` taxonomy and the standard listing,
search and request flow. The retired private case tables are archived by a
data-preserving migration; historical migration files remain immutable.

## Engineer 1 integration points

1. Render `RequestItemForm` from `apps/web/src/features/activity/RequestItemForm.tsx`
   on an active `donate` listing detail with its UUID and currently available
   quantity. Do not render it on the user's own listing or a `lend` listing.
2. Listing availability is `stock_total - stock_reserved - stock_collected`.
   `DonationRequestsStore` performs the reserve/release/collect updates in the
   request transaction using conditional SQL. Any listing stock edit must
   preserve these three fields and the PostgreSQL CHECK constraints.
3. A listing must have a stable owner and active status before it can be
   requested. Pending requests do not reserve units; only approval does.
4. Request details return public listing title and status, but no private
   pickup instructions or exact location. Engineer 1's private pickup endpoint
   can grant access only to the owner or an approved requester.

## Local verification

Start a PostgreSQL 17 database with a separate database whose name ends in
`_test`, then set `TEST_DATABASE_URL` to a loopback URL for it and run
`npm run test:db`. The test setup applies migrations to that database and
refuses a remote host or a database name without `_test`. Tests create unique
fixtures and delete only those fixtures. Run `npm run check` for typecheck,
lint, unit/HTTP tests and the production build.

The Ask agent saves a reviewed need through an editable confirmation card; automatic
matching still needs the active listing flow. The first end-to-end demo path
after Engineer 1's listing endpoint is ready:
create a photo listing → request it → approve from the owner's Activity page →
arrange collection in Messages → confirm pickup in Activity. The in-app inbox
receives request and message updates. FCM delivery, grounded matching, loan
integration and automatic expiry remain follow-up tasks.
