# Implementation status — 2026-10-17

Branch `feat/marketplace-integration` combines Engineer 2 `5e5b59e` and Engineer 1
`484c482`. The integration implements missing backend services and connects
the marketplace, Ask and mobile controls. No Engineer 1 code dependency remains
for these implemented journeys.

| Area | Implemented behavior |
|---|---|
| Listings | Create/edit/pause/close, donation/lending, appliance access facts, bucket photo upload/removal, authorized pickup |
| Discovery | Keywords, categories, availability, profile radius 1/3/5/10 km, saved needs and grounded Gemini explanations |
| Donation | Request, approve/reject/cancel, expiry, atomic reservation/release/collection, idempotent writes |
| Lending | Availability, single-unit approval, overlap exclusion, checkout/return/condition, overdue protection |
| Communities | Directory/join/review, server roles, consented points, QR resolution/scanning, reviewed deposits, audit and linked inventory listings |
| Communication | Participant chat, unread/read state, inbox, durable push delivery and opt-in token lifecycle |
| Ask | Sessions/history, private photos/camera, tool loop, partial text/progress, draft publication, typed review/confirm/cancel, recovery |
| Runtime | Nine PostgreSQL migrations, safe demo seeding, maintenance entry point, Node 24 Docker stages |

Verification includes unit/type/lint/build checks, PostgreSQL transaction and
permission tests, real Gemini tools and structured output, Storage emulator
reads/writes, and a two-user mobile donation journey. Exact results and remaining
provider checks are recorded in [the runbook](integration-handoff.md).

Real-cloud bucket access, SMTP and browser FCM still require valid provider
configuration. They are deployment prerequisites, not Engineer 1 dependencies.
Docker image execution must be verified when the local Docker engine is usable.
The historical special assistance flow is now ordinary product categories;
legacy migration names are retained to preserve migration history.
