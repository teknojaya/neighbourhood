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

For a new task, the agent asks one to four focused questions about missing facts
before proceeding. A question card offers short choices and free-text answers;
Use these answers drafts an editable message. Fully specified follow-ups and
read-only product help can proceed immediately. The server gives clarification
priority if a model attempts questions and marketplace operations together.
Question answers never count as approval to execute a marketplace write.

## Photos and publication

- A selected photo previews immediately while uploading. An upload response
  joins pending attachments immediately, including in a newly created session.
  Failed uploads retain the selected file with retry/remove controls, and Send
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

No database migration or new environment key is needed. Storage failures use
`STORAGE_UNAVAILABLE`, rather than suggesting sign-in configuration is missing.
Local Auth, Storage, PostgreSQL and Gemini must be available to exercise the full
flow. The changes remain on the UI enhancement branch; no deployment is implied.

## Verification

Run the normal checks and PostgreSQL suite, then, with local services running:

```sh
npm run smoke:ask-agent
```

This creates a disposable account, verifies first-upload preview, interactive
question choices, a photographed draft, an approval card before any listing
exists, confirmation, bucket photo copying, reload, streamed partial text and
the published item's photo. It removes its own account, records and objects.
Browser captures are ignored under `apps/web/.impeccable/review/ask-agent`.
Map tiles are intercepted with labelled synthetic tiles. Native camera picker
behavior still needs a physical-device check; the harness exercises file input.

Verified locally: 96 unit tests and the production/PWA build passed; 50 PostgreSQL
integration tests passed, including authenticated streaming before completion,
question priority over a simultaneous proposed action, legacy draft photo
recovery, approval-only publication, idempotent photo copying, a missing-photo
preflight and renewed history image grants. The isolated test database was
stopped. The real Gemini/browser/bucket smoke passed, and the existing 19-capture
UI refinement harness passed. Phone widths 320/440 and desktop 1440 were checked.
The single Impeccable detector pass had no primary findings; its one advisory is
an existing 11px hint in the shared listing form. Existing bundle/PWA warnings
remain. No production mutation, deployment or PR was created.
