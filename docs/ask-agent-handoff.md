# Ask agent: implemented foundation (historical)

> This records the pre-integration Engineer 2 branch. The current Ask includes
> marketplace discovery/publication, loans, community and inventory tools,
> streaming progress and matching. See [integration handoff](integration-handoff.md)
> and [architecture](architecture.md) for current behavior and provider limits.

Branch: `feat/requests-communication`. The Ask route (`/needs`) now uses a
conversational agent. Saved needs remain independently accessible at
`/needs/saved`. The broader target is in `ask-agent-plan.md`.

## Sessions and history

- Private AI sessions use `ask_sessions`, `ask_messages` and `ask_runs`, separate
  from neighbour conversations. Session creation uses a client UUID so a lost
  response does not create a second chat.
- History persists in PostgreSQL, pages by message sequence, and resumes from
  the `chat` URL parameter. No private chat text is put in local storage or URL
  query strings. The unsent text composer is held in component memory; it is
  not autosaved. Uploaded-but-unsent photos are restored from the server.
- Each turn has a client message UUID and input hash. Repeated identical turns
  recover the existing run. Changed input using the same UUID is rejected.
  One run per session executes at a time across instances. A stale run becomes
  failed after its lease and can be retried without a second user message.
- Stop cancels the run and prevents a late answer from committing to history.
  It does not undo a previously confirmed marketplace action.
- Deleting a chat immediately hides it and removes its history/photos. Saved
  needs, marketplace requests and sent neighbour messages are independent.
  Soft-deleted sessions awaiting storage cleanup remain inaccessible.

## Image input

- Upload authenticated raw JPEG/PNG/WebP bytes to the session attachment route
  with an `Idempotency-Key`; source hashes reject changed-key reuse.
- Input maximum is 4 MiB and 25 million decoded pixels. Sharp decodes, orients,
  resizes to fit 1600 x 1600 and re-encodes WebP without EXIF metadata. Forged,
  malformed and mismatched image types are rejected.
- Up to two photos per message and twenty stored photos per chat. Attachment
  IDs are checked against the caller's exact session. Photos already in
  history cannot be removed independently; deleting their chat removes them.
- Firebase objects live under the private `ask-attachments/` prefix. Images
  are fetched through authenticated API reads with `Cache-Control: no-store`;
  the browser creates and revokes temporary blob URLs. Storage paths and image
  bytes are absent from JSON history responses.
- Model context includes at most thirty recent messages, about 32,000 text
  characters, and the two most recent photos in that history. Older history is
  still accessible in the UI. The model must clarify references it cannot see.

## Agent and tools

The new Gemini adapter uses typed `models.generateContent` with explicit
history and manually executed function calls. Tool-call metadata, including
thought signatures, stays intact during each loop. Prior turns are rebuilt
from visible messages and server cards; hidden reasoning is not persisted or
rendered. The existing structured extraction adapter is preserved.

Budgets: four model rounds, six tool executions and a 45-second turn deadline.
Each tool response sent to the model is capped at 16,000 JSON characters;
larger results carry an explicitly truncated preview rather than hidden IDs.
The UI polls persisted run state for recovery; token streaming is not yet
implemented. Unknown tools and invalid arguments cannot execute arbitrary code.
Tools always derive the user from authentication and call existing services.

Working tools:

- Read saved needs, incoming/outgoing requests, a request, private conversation
  lists/messages and the in-app inbox.
- Prepare editable saved-need cards, request transition cards and exact message
  previews. The model cannot confirm any action.
- Create/update a partial private donation/lending draft. These drafts remain
  separate from valid published listing records.
- A donation request preparation tool can be enabled by supplying Engineer 1's
  authorized listing-detail service. It is not enabled in the current server.

Confirmations load a stored action payload, verify user and revision, and
delegate to the domain service using a deterministic idempotency key. Server
permissions, stock and state rules run again. Receipts come from committed
results. Unknown execution failures leave the proposal immutable for recovery;
replaying the domain key recovers the commit-to-receipt gap. Such recovery is
bounded to twenty hours, inside the domain key's 24-hour lifetime.

Need cards allow edits to item name, category, preference, quantity and deadline
before saving. Editing increments the revision, so an old confirmation cannot
save the previous payload. Pending cards expire after ten minutes and can be
cancelled. Handover cards explicitly ask the owner to confirm in-person pickup.

## Configuration and cleanup

Text turns require `GEMINI_API_KEY` and `GEMINI_MODEL`. Photos also require
`FIREBASE_STORAGE_BUCKET` and Firebase Admin credentials with storage access.
History and saved needs remain accessible when AI is unavailable. No fake
marketplace success is shown in that state.

Deletion cleanup runs on API startup and opportunistically every fifteen
minutes. Because background work is not guaranteed on every hosting setup,
schedule `npm run cleanup:ask -w @neighbourhood/api` as a recurring maintenance
job in deployment. It retries deleted sessions and removes untracked files in
the dedicated Ask prefix only after twenty-four hours. This job is provided;
no cloud scheduler was provisioned. Active chats are retained until their owner
deletes them; there is no automatic active-history retention cutoff yet.

## Still to integrate

Engineer 1: listing search/detail/publish/edit/photo services; loan services;
communities/points/deposits. Use the same services for regular screens and Ask.
Current Ask honestly describes nearby search and publication as unavailable.
Do not enable a tool whose backend still returns 501.

Engineer 2 follow-ups: grounded listing search/matching, remaining marketplace
tool groups, streaming polish, FCM delivery and automatic request expiry. The
full target includes all permitted user-facing marketplace actions; this
foundation does not claim those unfinished services are implemented.

## Verification

PostgreSQL tests cover session ownership, duplicate turns, resumable history,
concurrent turns, cancellation, failed-turn retry, abandoned runs, private
image input, edited confirmations, stock changes, cancelled/expired proposals,
and recovery after a domain write commits before its receipt is saved.

Image unit tests cover metadata removal, resize limits, malformed inputs, MIME
mismatch, byte limits and decoded pixel limits. A 390 px browser smoke test
with mocked API responses covers review/edit/confirmation, photo attachment,
lost-response recovery, history reload and saved-needs navigation.

Live verification passed with real Gemini and local Firebase Auth/Storage
emulators against the developer's local PostgreSQL database: tool calls,
persisted history, editable need confirmation and replay, private normalized
photo upload/read/retry, image understanding, session isolation, and chat
deletion preserving saved needs. All disposable test records were removed.
Production Firebase Storage credentials and Google sign-in remain unverified.

Repeat with `npm run smoke:ask -w @neighbourhood/api` while the API and both
emulators are running. Set `SMOKE_API_URL` to override the default
`http://127.0.0.1:8080`. The script requires loopback API/database/emulator
hosts, a demo Firebase project, a demo bucket and a configured Gemini key/model.
Run the API without file watching for this check, so development rebuilds do
not interrupt a model turn. `npm run emulators` requires Java 21+ on PATH.
