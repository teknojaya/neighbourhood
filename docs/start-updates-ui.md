# Start, sharing prompts and review UI

The centre navigation entry is Start and still opens Ask. Activity defaults to
Shared items; its tabs are Shared items, Requests and Loans. Explicit request
and loan links preserve their destination. The Shared items banner is permanent
with no close button, and the Activity navigation bubble also opens Share.

Notifications show compact grouped rows with type icons, readable states and
destination-specific actions. Their unread summary uses the global count.
Opening an unread update or marking it read refreshes the shared count.

Chat reviews show photos and essential facts first, preserve user text, and keep
private pickup details accessible in a disclosure. Publication still requires
Confirm; completed action details collapse without hiding their receipts.

## Verification

- Web typecheck and production/PWA build.
- Repository lint and existing web unit tests.
- `npm run smoke:start-updates`: disposable local Auth/API/Storage fixtures,
  photographed publication with explicit confirmation, completed review details,
  tab defaults/order, persistent banner, navigation bubble, notification read
  counts and request deep links. Layout captures at 320, 440 and 1440 pixels.
- `npm run smoke:unread`: global unread totals independent of pagination and
  message/notification read updates.

Browser captures are local ignored artifacts under
`apps/web/.impeccable/review/start-updates`. These checks use typed action
fixtures and do not claim live model or production provider verification.
