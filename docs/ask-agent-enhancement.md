# Conversational Ask agent

Ask streams authenticated response updates from the existing message endpoint.
The browser sends `Accept: application/x-ndjson`; each newline-delimited event
contains `{ type: "run" | "done", run: AskRun }`. Run snapshots replace partial
text rather than appending it twice. Ordinary JSON clients remain compatible.
Gemini's existing streaming adapter emits real incremental text, not simulated
typing. Tool states identify thinking, reading, searching and preparation.

Turns, partial progress and final messages remain durable in PostgreSQL. Stop
uses the existing cancellation gate. A browser disconnect does not automatically
repeat a turn or approve a write; reopening the chat recovers its state. Polling
remains a recovery path for a running turn after disconnection or navigation.
Deployments must allow response streaming and avoid buffering this route.

For a new task, the agent asks one casual question about the next missing fact,
waits for a normal chat answer, then asks another only if needed. Known facts
and corrections stay in context. Optional reply pills send the chosen answer immediately;
there is no questionnaire form. The server emits only the first question even
if a model proposes a batch. Fully specified follow-ups and read-only product
help can proceed immediately. The server gives clarification priority if a
model attempts questions and marketplace operations together.
Question answers never count as approval to execute a marketplace write.

## Photos and publication

- A selected photo previews immediately while uploading. An upload response
  joins pending attachments immediately, including in a newly created session.
  Sharing asks for a photo first unless one was supplied or the user declined.
  A real photo input handoff opens Camera/Photo library. Failed uploads retain
  the selected file with retry/remove controls, and Send
  is blocked until the photo is uploaded or removed.
- Sent photos appear with that user message while the assistant works. Private
  reads use bearer-authenticated blobs; object URLs are revoked on cleanup.
- A listing draft stores its own attachment IDs. Current-turn photos attach to
  the draft; text-only edits preserve them. Earlier drafts without that field
  can recover photos preceding the draft from the same chat. Explicitly removed
  draft photos remain removed. The secure review form previews included photos
  and also accepts an additional upload, up to two total.
- Historical item and match cards receive fresh signed product-photo URLs when
  loaded, avoiding persisted expired grants and grants from a prior API process.
  Exact pickup details remain excluded from model context and public cards.
- `prepare_publish_listing` requires a complete draft and the resident's choice
  of saved Profile pickup location. Lending additionally requires maximum loan
  days and a single unit. The server supplies the saved coordinates and a
  neutral private pickup instruction; custom pickup details use the secure form.
  The tool creates an approval card, including photos, and does not publish.
- Confirm uses the existing authorization, revision and idempotency checks.
  Private images are read before creating a listing, then copied to the listing
  bucket with stable upload keys. Repeated confirmation creates one listing and
  one copy of each photo. A completed receipt links to the published item.

The initial streaming pass needed no migration. The conversational follow-up
requires `20261018010000_saved_items_message_photos`; run
`npm run db:deploy -w @neighbourhood/api` before starting the updated API. No new environment key is
needed. Storage failures use
`STORAGE_UNAVAILABLE`, rather than suggesting sign-in configuration is missing.
Local Auth, Storage, PostgreSQL and Gemini must be available to exercise the full
flow. The changes remain on the UI enhancement branch; no deployment is implied.

## Verification

Run the normal checks and PostgreSQL suite, then, with local services running:

```sh
npm run smoke:ask-agent
```

This creates a disposable account and verifies first-upload preview, sequential
Q&A through normal chat, a photographed draft, an approval card before any
listing exists, confirmation, bucket photo copying, reload, streamed partial
text, clothing discovery and collapsible history without stale radius prompts.
It removes its own account, records and objects.
Browser captures are ignored under `artifacts/ui/ask-agent`.
Map tiles are intercepted with labelled synthetic tiles. Native camera picker
behavior still needs a physical-device check; the harness exercises file input.

Verified locally in the initial streaming pass: 96 unit tests and the production/PWA build passed; 50 PostgreSQL
integration tests passed, including authenticated streaming before completion,
question priority over a simultaneous proposed action, legacy draft photo
recovery, approval-only publication, idempotent photo copying, a missing-photo
preflight and renewed history image grants. The isolated test database was
stopped. The real Gemini/browser/bucket smoke passed, and the existing 19-capture
UI refinement harness passed. Phone widths 320/440 and desktop 1440 were checked.
The single Impeccable detector pass had no primary findings; its one advisory is
an existing 11px hint in the shared listing form. Existing bundle/PWA warnings
remain. No production mutation, deployment or PR was created.

## Conversational discovery and saved products

Older product results collapse when a newer user message arrives and can be
reopened. Radius choices send a chat answer directly and appear only on the active result when the conversation
has not already supplied a distance. A wider check with no matches
never promises that widening will help. Generic category names such as clothes,
pakaian and baju resolve to clothing; specific attributes remain literal.

Saved items bookmark actual listings; Saved needs describe things still being
sought. Item cards, details and Ask results have explicit bookmark buttons.
Open `/saved-items` from Profile or Saved needs. These private bookmarks survive
chat deletion, do not reserve stock, and show a removable title if an item
becomes unavailable. Ask can list bookmarks and prepare save/remove approval
cards. Direct bookmark buttons are explicit user actions and apply immediately.

See [Messages and saved items](conversation-and-saved-items.md) for photo privacy,
migration and the two-browser smoke check.

## Photo and location handoffs

`request_input` emits a typed `input_request` part for `photo`,
`profile_location` or `listing_pickup`. These controls open real UI instead of
sending setup labels back into a conversation loop. Historical setup choices
also open the appropriate control. Questions and input handoffs end the turn;
they never approve writes.

The composer clears when sending. The user can type a next draft while the
assistant responds, and completion preserves it. A failed transport restores
the original text only when no next draft exists; retries retain message IDs.

Profile coordinates and public area are distinct. `my_account` reports
`searchLocationSet`, `pickupLocationReady` and missing fields without revealing
coordinates. When only a city label is missing, Ask can prepare an `areaLabel`
preference update for explicit approval, preserving coordinates. Missing
coordinates open the Profile location form; a city name never invents a point.
Saving the location form resumes the chat using fresh state. Custom private
pickup instructions open the listing review form. Direct sharing also offers
Profile setup when needed, preserving its item fields and photos.

No migration or new environment key is required for these handoffs.

`npm run smoke:ask-inputs` isolates the input UI from model availability. It
uses a disposable account and real Profile saves to verify coordinate validation,
Cancel, preference preservation, safe chat continuation and historical setup
choices at 320/440/1440 pixels; only the subsequent AI response is stubbed.
`smoke:ask-agent` exercises real Gemini photo-first sharing, one-tap replies,
immediate composer clearing/next-draft preservation and location save/resume
before approval-only publication. Its bounded UI retry handles at most two
transient upstream failures and reports each retry explicitly.
