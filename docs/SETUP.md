# GTM-OS — Setup & Credentials Guide

This is the **step-by-step** guide for getting GTM-OS running locally, including
how to obtain every credential the `.env` file needs. The `README.md` is the
high-level overview; this file is the hands-on checklist.

> Each phase that introduces a new external service appends its credential
> steps to the bottom of this file under "Per-phase credentials". Phase 1 only
> needs Google OAuth.

---

## 0. Prerequisites

Install these once:

| Tool | Version | Check | Where |
| --- | --- | --- | --- |
| Node.js | ≥ 20 | `node --version` | <https://nodejs.org> |
| Docker Desktop | latest | `docker --version` | <https://www.docker.com/products/docker-desktop> |
| Git | any | `git --version` | <https://git-scm.com> |

You already have Node 24, Docker, and Git — so you're set.

---

## 1. The `.env` file

GTM-OS uses **one** `.env` file at the repo root (`gtm-os/.env`). Both the web
app and the API read from it. Start by copying the template:

```bash
cd gtm-os
cp .env.example .env
```

Here is every variable, what it does, and whether you must change it for Phase 1.

### Database — **set a real password**

| Variable | Purpose | Action |
| --- | --- | --- |
| `POSTGRES_USER` | Postgres username | Leave as `gtm` |
| `POSTGRES_PASSWORD` | Postgres password | **Generate a strong one** (below) |
| `POSTGRES_DB` | Database name | Leave as `gtm_os` |
| `DATABASE_URL` | Full connection string Prisma uses | Put the **same** password here |

Don't ship the `change_me` placeholder. Generate a strong, **URL-safe** password
(hex avoids the `@ : / # ? %` characters that would break the connection URL):

```bash
openssl rand -hex 16
```

Then set **both** lines to that value (keep user `gtm` and db `gtm_os`):

```env
POSTGRES_PASSWORD=<paste the hex value>
DATABASE_URL=postgresql://gtm:<paste the same hex value>@localhost:5432/gtm_os?schema=public
```

> The password appears in **two** places and they must be identical. If you ever
> change it *after* first running `npm run docker:up`, you must also recreate the
> database volume so Postgres picks up the new credentials:
> `npm run docker:down && docker volume rm gtm-os_gtm_pg_data`.
>
> This password is local-only (Postgres listens on `localhost` and `.env` is
> gitignored), but a strong value is the right habit and keeps the same `.env`
> safe if you later deploy.

### Redis (no change needed)

| Variable | Purpose | Action |
| --- | --- | --- |
| `REDIS_URL` | Redis connection (used from Phase 2) | Leave default |

### Ports & URLs (no change needed)

| Variable | Purpose |
| --- | --- |
| `API_PORT` / `API_BASE_URL` | Express API (4000) |
| `WEB_PORT` / `NEXT_PUBLIC_API_BASE_URL` | Next.js web (3000) |

### Auth secrets — **you must set these**

| Variable | Purpose | How to generate |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | Signs the NextAuth session cookie | see below |
| `INTERNAL_JWT_SECRET` | Signs the web→api bridge JWT | see below |
| `NEXTAUTH_URL` | Base URL of the web app | Leave as `http://localhost:3000` |

Generate two strong random strings:

**macOS / Linux / Git Bash:**
```bash
openssl rand -base64 32   # paste into NEXTAUTH_SECRET
openssl rand -base64 64   # paste into INTERNAL_JWT_SECRET
```

**Windows PowerShell (if you don't have openssl):**
```powershell
# NEXTAUTH_SECRET (32 bytes)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
# INTERNAL_JWT_SECRET (64 bytes)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Max 256 }))
```

Paste each result into the matching variable in `.env`.

### Google OAuth — **you must set these** (full walkthrough in §2)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud |

---

## 2. Getting your Google OAuth credentials (Phase 1)

Phase 1 uses Google **only to sign you in** (your operator identity). We do
**not** request Gmail-sending permission yet — that's a separate, scarier
consent screen we add in Phase 3.

Follow these steps exactly:

### 2.1 Create / pick a Google Cloud project
1. Go to <https://console.cloud.google.com/>.
2. Top bar → project dropdown → **New Project**.
3. Name it `gtm-os` (or anything) → **Create** → select it.

### 2.2 Configure the OAuth consent screen
1. Left menu → **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill the required fields:
   - App name: `GTM-OS`
   - User support email: your email
   - Developer contact email: your email
4. **Save and Continue** through "Scopes" (add nothing) and "Test users".
5. On **Test users**, click **Add Users** and add your own Gmail address
   (`michaelmatere606@gmail.com`). While the app is in "Testing" mode, only
   listed test users can sign in — that's fine for now.
6. **Save and Continue** → **Back to Dashboard**.

### 2.3 Create the OAuth client ID
1. Left menu → **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `GTM-OS Local`.
5. Under **Authorized JavaScript origins**, click **Add URI**:
   - `http://localhost:3000`
6. Under **Authorized redirect URIs**, click **Add URI**:
   - `http://localhost:3000/api/auth/callback/google`
   > This exact path matters — NextAuth listens here. A trailing slash or
   > wrong port will cause a `redirect_uri_mismatch` error.
7. **Create**.

### 2.4 Copy the credentials into `.env`
A dialog shows your **Client ID** and **Client secret**. Copy each into `.env`:

```env
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

You can reopen the credential later to copy these again if needed.

---

## 3. First run

From `gtm-os/`:

```bash
# 1. Install dependencies (once)
npm install

# 2. Start Postgres + Redis
npm run docker:up

# 3. Generate the Prisma client
npm run db:generate

# 4. Create the database tables (name the migration "init" when prompted)
npm run db:migrate

# 5. Seed default pipeline stages
npm run db:seed
#    Want demo leads too?  ->  SEED_SAMPLE_DATA=1 npm run db:seed

# 6. Run web + api together
npm run dev
```

- Web: <http://localhost:3000>
- API health: <http://localhost:4000/health> → `{"ok":true,"service":"gtm-api"}`

Sign in with the Google account you added as a test user. On first sign-in,
your workspace and its default pipeline are created automatically.

---

## 4. Testing Phase 1 works

Run through this end-to-end. Each step also proves a deeper part of the
architecture (noted in italics).

1. **Infra** — `npm run docker:up`, then `docker ps` shows
   `gtm-os-postgres` and `gtm-os-redis` as `healthy`.
2. **API health** — open <http://localhost:4000/health>. *Proves Express boots
   and env validated.*
3. **Auth guard** — open <http://localhost:3000/dashboard> in a private window
   while signed out. You should be redirected to `/login`. *Proves middleware
   guard.*
4. **Sign in** — click "Continue with Google", complete consent, land on
   `/dashboard`. *Proves NextAuth + workspace bootstrap.*
5. **Dashboard** — you see four count cards, a pipeline breakdown, and an empty
   activity feed.
6. **Create a lead** — click **New Lead**, fill at least Company name, Save.
   Toast confirms. *Proves web → proxy → JWT → Express → Prisma round-trip.*
7. **Activity written** — go to `/activity`; you see a "Lead Created" event.
   *Proves the transactional event log.*
8. **Leads table** — `/leads` lists your lead. Try the search box and the Stage
   filter. *Proves cursor list + filtering.*
9. **Lead detail** — click the lead. Change its **pipeline stage** via the
   selector → toast + a "Lead Stage Changed" event appears in its timeline.
10. **Notes** — add a note on the detail page → it appears, and a "Note Added"
    event is logged.
11. **Kanban** — `/leads/kanban`, drag the lead card to another column. It
    snaps over and persists (refresh to confirm). *Proves optimistic move +
    move-stage endpoint.*
12. **Delete** — on the detail page, **Delete** the lead, confirm. You return to
    `/leads` and it's gone; a "Lead Deleted" event remains in `/activity`.
13. **Theme** — toggle light/dark in the header; it persists on reload.
14. **Data check (optional)** — `npm run db:studio` opens Prisma Studio; inspect
    the `Lead` and `Activity` tables directly.

If all 14 pass, Phase 1 is solid and we can start Phase 2.

### Quick API smoke test (optional, without the UI)

The API requires a signed JWT, so you can't curl it raw. Easiest path is the
UI above. If you want a raw check, the only unauthenticated route is
`/health`:

```bash
curl http://localhost:4000/health
```

---

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `redirect_uri_mismatch` on Google sign-in | The redirect URI in Google Cloud must be exactly `http://localhost:3000/api/auth/callback/google`. |
| `Access blocked: app not verified` | Add your Gmail as a **Test user** on the OAuth consent screen (§2.2 step 5). |
| `Invalid env configuration` on API start | A required `.env` var is missing/short. Secrets must be ≥ 32 chars. |
| Prisma `P1001 can't reach database` | Postgres isn't up. Run `npm run docker:up` and wait for healthy. |
| Web can't reach API | Confirm `API_BASE_URL=http://localhost:4000` and the API is running. |
| Port already in use | Something else is on 3000/4000/5432/6379. Stop it or change the port vars. |

---

## Per-phase credentials (added as we build)

- **Phase 1 (this doc):** Google OAuth for sign-in. ✅
- **Phase 3:** Gmail API + send scopes (a new OAuth consent + token flow).
- **Phase 6:** Lead-source API keys (Google Maps Places, etc.).
- **Phase 7:** LLM provider key (OpenAI / Anthropic).

Each will be appended here with the same step-by-step format.
