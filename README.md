# GTM-OS

> Outbound operating system for AI automation agencies.
> CRM-centric, event-driven, entity-agnostic. Built in phases.

This repo is the working implementation of the platform described in the
phased build plan. **Phase 1 (Foundation + CRM)** ships here. Subsequent
phases extend the same primitives without breaking the schema.

---

## Phase 1 — what's working

- Monorepo (npm workspaces): `apps/web`, `apps/api`, `packages/database`, `packages/shared`
- PostgreSQL + Redis via Docker Compose (Redis reserved for Phase 2)
- Prisma schema for users, workspaces, leads, pipeline stages, tags, notes, activities
- Google OAuth via NextAuth v5 with workspace bootstrap on first sign-in
- Express API with JWT bridge auth, helmet, CORS, pino request logs
- Lead CRUD, pipeline stage CRUD, notes, activity timeline
- Next.js 15 dashboard: pipeline summary, recent activity, leads table, Kanban board (drag to move stage), lead detail with notes + timeline, light/dark theme
- Every mutation writes an `Activity` row in the same transaction — the spine
  the analytics + AI phases will ride on

## Architecture in one diagram

```
                    ┌─────────────────────────────┐
   browser ─────▶   │  Next.js 15 (apps/web)      │
                    │  - NextAuth (Google OAuth)  │
                    │  - shadcn UI                │
                    │  - /api/proxy/* signs JWT   │
                    └──────────────┬──────────────┘
                                   │ HS256 JWT (60s TTL)
                                   │ x-internal-auth header
                                   ▼
                    ┌─────────────────────────────┐
                    │  Express API (apps/api)     │
                    │  - JWT verify middleware    │
                    │  - service layer (Lead,     │
                    │    Pipeline, Note, Activity)│
                    │  - Prisma transactions      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Postgres (Prisma schema)   │
                    │  - Workspace-scoped rows    │
                    │  - Activity event log       │
                    └─────────────────────────────┘
```

### Key decisions

| Decision | Why |
| --- | --- |
| **Entity-agnostic schema** (`companyName`, not `clinicName`) | Switching from dental → mechanics → law firms is a template change, not a migration. |
| **Workspace-scoped tenancy from day one** | Adding multi-tenancy later is invasive; scaffolding it now is one extra column per table. |
| **JWT bridge between web and api** | Express stays stateless and the auth secret never touches the client bundle. Tokens live 60 seconds. |
| **PipelineStage is a row, not an enum** | Operators rename and reorder stages without a migration. |
| **Activity log is transactional** | Every mutation writes its event row in the same transaction. No silent drift between data and audit log. Foundation for Phase 5 analytics + Phase 7 AI. |
| **Service layer separated from routes** | Phase 2 queue workers (BullMQ) reuse `LeadService.create()` directly, no HTTP hop. |

---

## Local setup

> **New here? Read [`docs/SETUP.md`](docs/SETUP.md)** — it has the full
> step-by-step credential walkthrough (how to get the Google OAuth client,
> how to generate the secrets) plus a 14-point Phase 1 test checklist. The
> section below is the short version.

### Prerequisites
- Node.js ≥ 20
- Docker Desktop (Postgres + Redis)
- A Google Cloud OAuth 2.0 client
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env:
#   - NEXTAUTH_SECRET   (openssl rand -base64 32)
#   - INTERNAL_JWT_SECRET (openssl rand -base64 64)
#   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
```

### 3. Start infrastructure

```bash
npm run docker:up           # Postgres + Redis
```

### 4. Generate Prisma client + migrate + seed

```bash
npm run db:generate
npm run db:migrate          # name the first migration "init"
npm run db:seed             # default pipeline stages
# Optional sample data:
SEED_SAMPLE_DATA=1 npm run db:seed
```

### 5. Run

The easiest path is one command — the startup script handles Docker, the
containers, migrations, the Prisma client, and launches the dev servers.
All dev output (compile progress, request logs, errors) streams to that
terminal so you can see what's happening.

**Windows PowerShell:**
```powershell
.\scripts\start.ps1
```

**Git Bash / WSL / macOS / Linux:**
```bash
bash scripts/start.sh
```

To stop: `Ctrl+C` in the same terminal, then run the matching `stop` script
(`.\scripts\stop.ps1` or `bash scripts/stop.sh`) to shut the containers down.
Your database volume is preserved across restarts.

> ⚠️ **Back up before risky Docker operations.** A Docker Desktop "Reset to
> factory defaults", a `docker volume prune`, or a `docker compose down -v`
> *will* destroy your `gtm_os` data — the named volume is part of what gets
> wiped. Use the backup scripts:
>
> ```powershell
> # Snapshot the current DB to .\backups\gtm-os_<timestamp>.sql
> .\scripts\db-backup.ps1
>
> # List backups
> .\scripts\db-restore.ps1
>
> # Restore a specific snapshot (destructive — confirms first)
> .\scripts\db-restore.ps1 .\backups\gtm-os_20260530-120000.sql
> ```
>
> Bash equivalents: `bash scripts/db-backup.sh`, `bash scripts/db-restore.sh`.
> The `backups/` folder is gitignored.

Manual sequence if you'd rather run the steps yourself:

```bash
npm run docker:up           # Postgres + Redis
npm run db:migrate:deploy   # apply any pending migrations
npm run dev                 # web on :3000, api on :4000
```

Open <http://localhost:3000>, sign in with Google. On first sign-in your
workspace is created automatically with the default pipeline stages.

---

## Phase 1 verification checklist

Walk through these to confirm the foundation is solid before Phase 2.

- [ ] `npm run docker:up` brings up healthy Postgres + Redis containers
- [ ] `npm run db:migrate` creates all tables without errors
- [ ] `npm run db:seed` populates the default workspace + 9 pipeline stages
- [ ] `GET http://localhost:4000/health` returns `{ ok: true }`
- [ ] Visiting `/` while signed out redirects to `/login`
- [ ] Sign in with Google succeeds and lands on `/dashboard`
- [ ] `/dashboard` shows totals, pipeline bars, and recent activity (last 10)
- [ ] Clicking **New Lead** opens the dialog and creates a lead
- [ ] Creating a lead writes a `LEAD_CREATED` row to the `Activity` table
- [ ] `/leads` lists leads with working search, stage, and industry filters
- [ ] Clicking a lead opens the detail page
- [ ] Changing the pipeline stage writes a `LEAD_STAGE_CHANGED` activity row
- [ ] Adding a note writes a `NOTE_ADDED` activity row and shows in the timeline
- [ ] `/leads/kanban` displays the columns; drag-and-drop between columns persists
- [ ] `/activity` shows the workspace-wide event feed
- [ ] Deleting a lead works and writes a `LEAD_DELETED` activity row
- [ ] Light/dark theme toggle works
- [ ] Signing out lands on `/login`

---

## Workspaces

```
gtm-os/
├── apps/
│   ├── api/                # Express API (port 4000)
│   │   ├── src/
│   │   │   ├── server.ts             # entrypoint
│   │   │   ├── env.ts                # zod-validated env
│   │   │   ├── logger.ts             # pino
│   │   │   ├── errors.ts             # AppError vocabulary
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT verify
│   │   │   │   └── errorHandler.ts   # zod/AppError/Prisma normalizer
│   │   │   ├── routes/               # thin handlers
│   │   │   └── services/             # business logic
│   │   └── Dockerfile
│   └── web/                # Next.js 15 (port 3000)
│       └── src/
│           ├── app/
│           │   ├── (app)/            # authenticated shell + pages
│           │   ├── api/
│           │   │   ├── auth/[...nextauth]/route.ts
│           │   │   └── proxy/[...path]/route.ts   # signs JWT, forwards
│           │   ├── login/
│           │   └── layout.tsx
│           ├── components/ui/        # shadcn-style primitives
│           ├── lib/
│           │   ├── auth.ts           # NextAuth config + workspace bootstrap
│           │   ├── env.ts
│           │   └── api/              # server + client API clients
│           └── middleware.ts         # protected-route guard
├── packages/
│   ├── database/           # Prisma schema + client
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── shared/             # zod schemas + DTOs used by web & api
├── docker/
│   └── docker-compose.yml  # Postgres + Redis
├── .env.example
└── package.json            # npm workspaces root
```

---

## What comes next (preview only — not built)

These are the planned phases. Each one inherits the schema and event log
without modification; new tables are added, none are reshaped.

- **Phase 2 — Campaign engine.** Campaign + Sequence + SequenceStep models, template variable resolver, BullMQ scheduler.
- **Phase 3 — Email delivery + tracking.** Gmail API integration, OAuth scope upgrade, pixel + click tracking, reply detection, bounce handling.
- **Phase 4 — Follow-up automation.** State-machine over `Lead` + `CampaignEnrollment`, conditional branches, stop-on-reply.
- **Phase 5 — Analytics.** Funnel + cohort aggregations off the `Activity` log; Recharts dashboards.
- **Phase 6 — Lead intelligence engine.** Google Maps + website + LinkedIn enrichment pipeline, confidence waterfall, deduper.
- **Phase 7 — AI assistance layer.** Personalization, subject lines, follow-up drafts, reply classification, lead scoring.

Build them in order. Each new module is a worker process and an API surface
under `/v1/<module>` — no rewrites of Phase 1 needed.

---

## Common commands

| Command | What |
| --- | --- |
| `npm run dev` | Start web + api in parallel |
| `npm run db:studio` | Open Prisma Studio against Postgres |
| `npm run db:migrate` | Create/apply a new migration |
| `npm run db:seed` | (Re-)seed default pipeline stages |
| `npm run docker:up` / `:down` / `:logs` | Manage local infra |
| `npm run typecheck` | TS check across the workspaces |
| `npm run build` | Build every workspace |

---

## Security notes (Phase 1 baseline)

- **Helmet + CORS** locked to the web origin
- **Zod validation** on every request body and query string
- **JSON body limit** 1 MB
- **HS256 JWT** with a 60-second TTL between web and api
- **Prisma parameterized queries** — no raw SQL in the codebase
- **Cascade delete** on workspace teardown (no orphans)
- **No secrets in client bundle** — the API base URL is server-only; the
  browser only talks to same-origin `/api/proxy/*`

Things that should change before going to production:
- Rotate the dev passwords in `.env`
- Run Postgres on a managed service with TLS
- Put a reverse proxy (Caddy / Cloudflare) in front of both apps
- Configure NextAuth `useSecureCookies: true`
- Add a CSP via Next.js `headers()`
- Wire up an error reporter (Sentry / OpenTelemetry exporter)
