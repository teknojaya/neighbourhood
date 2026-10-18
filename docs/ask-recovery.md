# Ask and conversation recovery

The reported chats had distinct causes, rather than one corrupt seed:

- Borrowing searches correctly found no clothing loans, but free alternatives
  had the same result heading. A later “yes please” could be interpreted as a
  radius choice instead of interest in those alternatives.
- The model copied historical `Server cards` JSON from its own model-role
  transcript. The JSON included approval metadata that belongs in rendered UI.
- A request was prepared even though the resident already had an active request
  for that listing. Confirmation correctly rejected the duplicate, but recovery
  did not take the resident to the existing request.
- A photo draft assumed quantity before the resident answered that question.
- Conversation requests returned gateway 502 errors while local API watchers
  restarted. The same conversation and messages subsequently returned 200.
  Several watch processes were present, and failed port binding was incorrectly
  logged as successful startup.

## Resulting behavior

Ask receives compact application state separately from assistant prose. Streamed
text, saved history and run progress filter echoed internal JSON. Search-only
summaries use actual server results and clearly separate Free and Borrow scopes;
an empty wider check does not offer another radius prompt. Old cards remain
collapsible. An ambiguous affirmation to two actions gets a single clarification.
Same-title listings require a choice rather than silently using the first UUID.

Request preparation returns an existing active request when one exists. A request
created between preparation and confirmation is recovered with its actual link
and quantity, without another write or notification. Identical pending proposals
reuse the same approval card. Historical duplicate-error cards offer a link to
the resident's existing request. Explicit approval remains required for new writes.

Draft quantity must come from user text or the answer to a quantity question,
not the photo or the model's description. Missing historical photo objects no
longer prevent text follow-ups; they cannot supply visual facts, and publication
still requires its selected photos to be readable. Attach a replacement if needed.

Gateway failures get a connection error and conversation retry control. Read
markers wait for successful conversation detail and retry on later successful
refreshes. Port-binding errors are logged as `server_start_failed` with an error
code; the process exits rather than claiming to have started.

## Local verification

```sh
npm run check
npm run test:db
npm run smoke:ask-recovery
npm run smoke:ask-agent
```

Keep `TEST_DATABASE_URL` on a separate disposable database. Browser smoke scripts
require local Auth/Storage emulators and a matching local API/web configuration.
The recovery smoke uses disposable users and records, injects historical bad
cards, and deliberately returns 502 for conversation detail and read markers.
It checks actual backend recovery and message send at phone/desktop sizes. The
agent smoke uses real Gemini, bucket bytes and streaming through Vite's proxy.
No production data or existing resident progress is reset by these tests.

Run only one `npm run dev` instance for the normal ports. If you have multiple
terminals from earlier runs, stop those commands before starting a fresh one.
PostgreSQL and Auth/Storage emulators run separately and should stay running.

## Evidence on 2026-10-18

- Type checks, lint, 107 unit tests and API/web/PWA production builds passed.
- All 59 isolated PostgreSQL integration tests passed, including the request
  confirmation race, same-title selection, unknown photo quantity, old JSON
  history and a missing historical photo.
- Recovery browser smoke passed in Edge/Chromium at 440×956 and 1440×900, with
  injected detail/read 502s, real message sending, ambiguous-yes clarification,
  legacy approval recovery and six captures. The batched visual review confirmed
  readable cards/recovery controls and no horizontal overflow. Physical devices
  and touch gestures were not tested in this pass.
- A second API on the occupied test port exited with `EADDRINUSE` and
  `server_start_failed`, without logging successful startup.
- Read-only checks of the resident's three reported chats confirmed filtered
  internal text and the existing-request recovery link. The reported neighbour
  conversation and its messages both returned 200. Resident records were retained.
- The actual Gemini browser smoke passed photo-first input, sequential replies,
  location save/resume, photo draft, explicit publication with bucket bytes and
  visible streamed product help. Its later discovery step hit
  `AI_QUOTA_EXCEEDED`; that full smoke did not pass. Discovery/recovery assertions
  above ran through controlled tool results and the actual backend. Provider quota
  must be available to repeat the full real-model flow.

No migration is required. Existing chats get the compatibility fixes on reload;
there is no need to delete a chat, reset the database or reseed for these fixes.
