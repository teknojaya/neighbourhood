# Marketplace completion checklist

Integration branch: `feat/marketplace-integration`. User direction supersedes
the original module ownership split: finish the combined marketplace. The
original special assistance feature is ordinary product categories.

## Acceptance journeys

- [x] Donation publication, nearby search, request, approval, private pickup/chat and collection. Live two-user mobile and PostgreSQL tests verify stock and retries.
- [x] Lending publication, date availability, approval, checkout, return/overdue and overlap protection. Domain concurrency covered by PostgreSQL tests.
- [x] Communities, join/approval, consented point/QR, deposit review and audited inventory-backed collection. QR grants no privileges.
- [x] Ask discovery/publication/management, saved needs/matching, requests, loans, chat/inbox, community/volunteer tools and profile preferences use typed services/review cards.
- [x] Session history, private images, recovery, edit/confirm/cancel and independent saved needs. Live Gemini image and confirmation smoke passed.
- [x] Mobile camera/composer and direct controls, offline/error behavior, English/Indonesian model prompts and private-field redaction. Mobile screenshots inspected.
- [x] Bucket-backed listing/Ask photos, normalization, retry/cleanup, nine migrations, seeded demo and compiled maintenance job.
- [x] In-app inbox, opt-in push lifecycle/outbox, request expiry and deployment runbook. Real FCM delivery remains a provider check below.
- [x] Types/lint/build, 92 unit tests, 44 PostgreSQL tests and real Gemini/Storage emulator mobile smoke.

## External release checks

- [ ] Reauthenticate Google ADC and verify the real private bucket.
- [ ] Configure SMTP/OTP secrets and test real email delivery.
- [ ] Configure VAPID/FCM and verify HTTPS browser push opt-in/delivery/revoke.
- [ ] Build/run the Docker image once the Linux engine is available; deploy
  migrations, Cloud Run service and scheduled maintenance to the intended project.

Current evidence and local demo instructions: [integration runbook](integration-handoff.md).

## Delivery record

- Source branches: Engineer 2 `5e5b59e`; Engineer 1 `484c482`.
- Production deployment needs real Firebase/Cloud SQL/Cloud Run credentials;
  SMTP delivery and browser FCM also need configured provider credentials.
  Verify local/emulated operation and document provider configuration honestly.
- The integration is reviewed through the PR from `feat/mobile-first-ui` to
  `main`. Keep credentials, local database exports and local uploads out of Git.
