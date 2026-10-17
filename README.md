# NeighbourHood

> **Updated 2026-10-17: architecture change.** PostgreSQL (Prisma 7 migrations; Cloud SQL in production) has replaced Firestore.
> Sign-in now uses **Google** or a **numeric email OTP** (both via Firebase Auth; there are no passwords).
> Firebase still provides Authentication, FCM and Cloud Storage. Any section below that mentions Firestore collections, rules or the Firestore emulator is out of date.
> For current details, see `docs/implementation-status.md` and `apps/api/prisma/schema.prisma`.


A mobile-first PWA where neighbours donate or lend useful items: groceries,
clothing, books, household goods, appliances and mobility aids. Collection
happens at the owner's location or a partner-managed community box, and
recipients arrange their own transport. Built for the Google Cloud AI
Builder Cup.

- **Stack**: TypeScript · npm workspaces · React 19 + Vite + Tailwind 4 +
  React Router + TanStack Query · Express 5 + Firebase Admin · Firestore,
  Firebase Auth, Cloud Storage, FCM · Gemini Developer API (`@google/genai`)
  · Cloud Run.
- **Docs**: [architecture](docs/architecture.md) ·
  [API contracts](docs/api-contracts.md) ·
  [module ownership](docs/module-ownership.md) ·
  [implementation status](docs/implementation-status.md)

```
packages/shared   Zod schemas, DTOs, enums, state machines, domain rules, AI contracts
apps/api          Express API + static hosting of the built PWA (Cloud Run)
apps/web          React PWA
```

## Prerequisites

- Node.js **≥ 22.22** (see `.nvmrc`) and npm 10.
- **Java 21+** for the Firebase emulators (`java -version`).
- Optional: a Gemini API key from https://aistudio.google.com/apikey.

## Local setup

```bash
npm install

# Environment files (these never overwrite existing ones)
[ -e apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -e apps/web/.env.development.local ] || cp apps/web/.env.example apps/web/.env.development.local
```

To enable AI, open `apps/api/.env` yourself and set `GEMINI_API_KEY=`. The
key stays server-side. Don't put it in any `VITE_` variable (the web build
refuses secret-like names). Without a key, the app runs and shows AI as
unavailable.

Then, in two terminals:

```bash
npm run emulators   # Auth :9099, Firestore :8085, Storage :9199, UI http://127.0.0.1:4000
npm run dev         # shared (watch) + API http://localhost:8080 + web http://localhost:5173
```

Open http://localhost:5173, create an account, set your profile (area,
location or manual coordinates, radius) and try **Ask** (needs extraction).

Granting a platform role locally (operator tool; no HTTP endpoint exists):

```bash
npm run grant-role -w @neighbourhood/api -- <uid> staff            # or medicine_partner, add --revoke to remove
```

The uid is shown in the Emulator UI → Authentication.

### Emulator safety

The API refuses to start if emulator variables are present with
`NODE_ENV=production` or on Cloud Run. It also refuses if an emulator host is
set without `USE_FIREBASE_EMULATORS=true`, or if emulators are used with a
non-`demo-*` project. The web app connects to the Auth emulator only in
`vite` dev on localhost, and `vite build` fails if
`VITE_USE_FIREBASE_EMULATORS=true`.

## Scripts (repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Build shared, then watch shared + API (tsx) + web (Vite, proxies `/api`) |
| `npm run emulators` | Firebase emulators (fresh data each run) |
| `npm run emulators:persist` | Emulators that import/export `.emulator-data/` (the folder must already exist from an earlier export; use `npx firebase emulators:export .emulator-data --project demo-neighbourhood` while emulators are running) |
| `npm run smoke:emulator` | End-to-end check against running emulators + API: register, token, profile, 401/400 guards |
| `npm run typecheck` | `tsc --noEmit` for all workspaces (web app + service worker) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest: shared domain rules, API auth/authorization/AI validation, SW cache policy |
| `npm run build` | shared → API (`dist/`) → web (`dist/` with `sw.js`) |
| `npm start` | Run the built API (serves `WEB_DIST_DIR` if set) |
| `npm run check` | typecheck + lint + test + build |

Production-like run locally:

```bash
npm run build
WEB_DIST_DIR=apps/web/dist node --env-file=apps/api/.env apps/api/dist/server.js   # http://localhost:8080
```

A production web build needs real Firebase web config in
`apps/web/.env.production.local`. Otherwise the app shows an honest
"Firebase is not configured" screen.

## Deploying to Cloud Run (manual — nothing is deployed automatically)

These steps create billable resources in your project, so review them first.
`asia-southeast2` is Jakarta.

```bash
PROJECT_ID=your-project
REGION=asia-southeast2
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/neighbourhood/app:$(date +%Y%m%d-%H%M)

gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create neighbourhood --repository-format=docker --location=$REGION

# Runtime service account with least privilege
gcloud iam service-accounts create neighbourhood-run
SA=neighbourhood-run@$PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/datastore.user
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/firebaseauth.viewer

# Gemini key in Secret Manager: paste it at the prompt, then press Ctrl-D (it is not echoed to logs)
gcloud secrets create gemini-api-key --replication-policy=automatic --data-file=-
gcloud secrets add-iam-policy-binding gemini-api-key --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor

# Build with PUBLIC Firebase web config (from Firebase console → Project settings → Web app)
docker build -t $IMAGE \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com \
  --build-arg VITE_FIREBASE_PROJECT_ID=$PROJECT_ID \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=$PROJECT_ID.firebasestorage.app \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... .
gcloud auth configure-docker $REGION-docker.pkg.dev
docker push $IMAGE

gcloud run deploy neighbourhood --image $IMAGE --region $REGION \
  --service-account $SA --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID,FIREBASE_STORAGE_BUCKET=$PROJECT_ID.firebasestorage.app,GEMINI_MODEL=gemini-3.5-flash-lite \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 3 --timeout 60

# Firestore/Storage rules and indexes (deny-all rules)
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT_ID
```

After deploying:

- In Firebase Console → Authentication, enable **Email/Password** and add the
  Cloud Run URL to **Authorized domains**.
- Set a Firestore TTL policy on `idempotencyKeys.expireAt` once that feature
  is implemented.
- `--allow-unauthenticated` is required so browsers can load the PWA. Every
  `/api/v1` route still verifies Firebase ID tokens.
- Health check: `GET /healthz`.

## Security summary

- Firebase ID tokens are verified server-side, with revocation checks. Roles
  and memberships are server-controlled.
- Firestore and Storage rules deny all direct client access, and services
  enforce authorization.
- Exact home coordinates and pickup instructions are kept in private records.
  Public DTOs carry approximate location only.
- The Gemini key is server-only (Secret Manager in production). Prompts and
  needs text are never logged.
- The service worker caches the app shell only. APIs send `no-store`.
