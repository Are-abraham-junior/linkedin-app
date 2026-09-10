# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Bleadin** (aka "Bime Link") — a LinkedIn prospection/automation SaaS. Node/Express/Prisma API + React/Vite SPA, backed by Postgres (Neon serverless) and the Unipile API for all LinkedIn actions (invitations, messages, profile visits, follows, webhooks).

## Commands

```bash
npm run dev              # runs API (tsx watch) + client (vite) concurrently
npm run dev:server       # API only, server/src/index.ts via tsx watch
npm run dev:client       # client only (npm --prefix client run dev)

npm run build            # client install+build, then prisma generate — used for local/Render-style deploys
npm run build:server     # tsc compile of server/ + lib/ + prisma/ per tsconfig.json -> dist/
npm run build:client     # npm --prefix client run build
npm run build:production # tsc --outDir dist + prisma generate (used for cPanel packaging)

npm run prisma:generate  # prisma generate
npm run prisma:migrate   # prisma db push (no migration files — schema is pushed directly)
npm run prisma:seed      # tsx prisma/seed.ts

npm run verify           # tsx scripts/verify-prisma.ts
```

There is no lint or test script configured — verify server changes with `npm run build:server` (tsc) and client changes with `npm --prefix client run build` (tsc + vite build). There is no test suite.

### Deployment (cPanel LWS / Passenger, single-command CLI)

`scripts/cpanel-remote.js` drives everything: `build`, `package` (assembles `deploy/`), `push` (SCP/SSH), `chmod` (755 on `dist/`), `restart` (Passenger `touch tmp/restart.txt`), `logs` (tail stderr.log), `diag` (direct `node app.js` run inside `nodevenv` to unmask Passenger 500s), `db-push`, `health` (curl `/api/health`), and `deploy-all` (the full pipeline). Corresponding `npm run deploy:*` / `remote:*` scripts wrap these. Config comes from `.env.deploy` (see `.env.deploy.example`), falling back to `.env`.

## Architecture

### Monorepo layout
- `server/src/` — Express 5 API in TypeScript, compiled to `dist/` via top-level `tsconfig.json` (`rootDir: ./`, includes `prisma/`, `lib/`, `server/`). Entry point `server/src/index.ts`.
- `client/` — separate React 18 + Vite + TypeScript app with its own `package.json`/`tsconfig.json`, built independently and served as static files by the API in production (`client/dist`).
- `lib/prisma.ts` — the single Prisma client instance, imported by server code as `../../../lib/prisma.js` (note the compiled `.js` extension convention — this is an ESM project, `"type": "module"`, `module: NodeNext`).
- `prisma/schema.prisma` — one flat schema, no migrations folder; schema changes are pushed directly with `prisma db push`.
- `deploy/` — pre-assembled production bundle (built `dist/`, `client/dist`, `prisma/`) that `cpanel-remote.js package`/`push` produce and ship to the cPanel host. `app.js` at repo root is the Passenger entry point.
- `.agents/skills/` — a set of domain-specific "skill" docs (prisma, unipile-linkedin, postgresql, api-architect, backend, express, node_expert, react_expert, frontend-dev, fullstack, cpanel-lws-expert, debugger, skill-creator) referenced by the multi-agent orchestration doc `AGENTS.md`. That doc describes a Gemini-style sub-agent orchestration workflow with named playbooks for campaign queues, Unipile sync, prospect imports, and dashboard/design work — useful background on intended domain boundaries even though it targets a different agent runtime.

### Server: multi-tenant data model
Prisma schema (`prisma/schema.prisma`) centers on:
- `Organization` → `User` (roles: `SUPER_ADMIN`/`USER` for platform role, `OWNER`/`ADMIN`/`MEMBER` for org role). Auth is JWT (`server/src/middlewares/auth.middleware.ts`), 7-day tokens, `requireAuth`/`requireSuperAdmin`. Super admins can impersonate an org via the `x-impersonate-org` header, which swaps `req.user` to the org owner's identity while retaining `SUPER_ADMIN` privileges (`isImpersonating`/`originalSuperAdminId`).
- `LinkedInAccount` (linked via Unipile, one per user) tracks daily send counters, connection status, and account type (STANDARD/PREMIUM/SALES_NAVIGATOR/RECRUITER).
- `ProspectList` → `Prospect` (CRM entities, dedup on `linkedinUrl`), with `providerProfileId` resolved lazily from Unipile ("ACo..." LinkedIn internal IDs).
- `Campaign` → `CampaignStep` (ordered sequence: INVITATION/MESSAGE/VISIT_PROFILE/FOLLOW/DELAY, each with `delayDays` and templated `messageText`) → `ProspectCampaignState` (per-prospect progress through a campaign) → `ActionQueue` (the actual scheduled/executed actions).
- `Conversation`/`Message` mirror Unipile inbox chats; `ImportHistory` tracks CSV/XLSX imports; `ApiKey`, `IntegrationConfig`, `Invoice` support org-level admin/billing features.

Routes live in `server/src/routes/*.routes.ts`, each paired with a same-named controller in `server/src/controllers/`, mounted in `server/src/index.ts` under `/api/<resource>` (auth, admin, user, lists, prospects, linkedin, campaigns, inbox, team, queue, settings), plus a standalone webhook endpoint `POST /api/webhooks/unipile`. In production the same Express app also serves `client/dist` and falls back to `index.html` for any non-`/api` GET (SPA routing).

### Campaign engine (`server/src/workers/campaign.worker.ts`)
This is the core automation loop, started via `startCampaignScheduler()` from `index.ts`:
- `processActionQueue()` runs every 60s: pulls up to 10 due `ActionQueue` rows, and for each checks (in order) account connection status, user's working hours/days (per-user `timezone`, computed with `Intl.DateTimeFormat`), campaign still ACTIVE, and daily quota (`maxDailyInvites`/`maxDailyMsg` on `User`, counted live from `ActionQueue` rows executed today — not just the cached counters on `LinkedInAccount`, which are resynced opportunistically). Then dispatches to `UnipileService` (`sendInvitation`/`sendMessage`/`visitProfile`/`followProfile`), personalizing `{{firstName}}`/`{{lastName}}`/`{{company}}`/`{{headline}}` template variables, resolving `providerProfileId` on demand via `resolveProviderId()`, and on success enqueues the campaign's next step (or marks the prospect COMPLETED) and enriches the prospect record (email/phone/avatar/headline/company) from any profile data returned.
- Unipile errors are triaged by `categorizeUnipileError()` into DISCONNECT_ACCOUNT (checkpoint/401 → marks the `LinkedInAccount` DISCONNECTED, pauses the user's active campaigns, and requeues the action 2h later), DEFER_ACTION (429/rate-limit → requeues 15 min later), or CONTINUE (marks that single action FAILED without affecting the account).
- `checkAcceptedInvitations()` runs every 5 min: polls Unipile profiles for prospects in `WAITING_CONDITION` (invitation sent, awaiting acceptance) and advances them to the next campaign step once `network_distance`/`connection_status` shows a 1st-degree connection.
- When touching this file, preserve the ordering of checks (connection → working hours → campaign active → quota) and the "account-level failure breaks the batch loop, prospect-level failure just marks FAILED and continues" distinction — it's what prevents burning through the whole queue against a disconnected/rate-limited account.

### Client (`client/src/`)
- React Router v7 SPA (`App.tsx`), split into a public shell (`/login`, `/join`, `/setup`) and an authenticated `AppLayout` shell wrapping `Sidebar` + `Header` + route `Outlet` for `/dashboard`, `/campaigns`, `/prospects`, `/inbox`, `/team`, `/settings`, and super-admin-only `/admin`, `/admin/users`.
- Auth/session state lives in `client/src/context/AuthContext.tsx`; API calls go through `client/src/services/api.ts`.
- Components are organized by feature under `client/src/components/` (admin, auth, campaigns, dashboard, inbox, layout, modals, profile, prospects, settings, common).
- UI follows the **Adora** design system (documented in `DESIGN (2).md`): Electric Violet `#592eff` as the single chromatic accent for primary CTAs/active states only (never as a background wash), pastel accents (Sky Tint `#bcf2ff`, Lime Spritz `#dfff9d`, Cotton Candy `#ffaae6`) for decorative surfaces, PolySans for display/headline type, Plus Jakarta Sans for body/UI text, generous `rounded-3xl`/`rounded-[40px]` card radii. Styling is Tailwind CSS utility classes inline (no separate component-class layer).

### Unipile integration
`server/src/services/unipile.service.ts` wraps the Unipile LinkedIn API ([docs](https://developer.unipile.com), [reference](https://developer.unipile.com/reference)) — account connection, invitations, messages, profile lookups/visits, follows. `server/src/controllers/webhook.controller.ts` handles inbound Unipile webhooks. LinkedIn's own internal profile identifier ("ACo..." `provider_id`) is distinct from `linkedinUrl`/slug and must be resolved via a profile lookup before most Unipile calls — see `resolveProviderId()` in the campaign worker for the caching pattern (store once resolved on `Prospect.providerProfileId`).

### Environment / config quirks
- `lib/prisma.ts` uses the standard `@prisma/adapter-pg` + `pg.Pool` driver adapter against the **PostgreSQL instance hosted on the LWS cPanel account itself** (`127.0.0.1:5432`). Connection mode (TCP vs Unix socket) and SSL are driven entirely by the contents of `DATABASE_URL`, so switching them is a config-only change (edit the remote `.env`, `touch tmp/restart.txt`) with no code redeploy. It resolves `DATABASE_URL` defensively (BOM, quoting, multiple `.env` locations) because of inconsistent env loading under Phusion Passenger.

- **CRITICAL — Prisma thread limiting on CloudLinux.** `lib/prisma.ts` and `env.js` both set `TOKIO_WORKER_THREADS=2` and `UV_THREADPOOL_SIZE=2` before Prisma is instantiated. Do not remove these. Prisma's Rust query engine sizes its Tokio thread pool from the visible CPU count (30 on this server), while CloudLinux caps the whole account at ~33 threads. Without the cap, thread creation fails with `EAGAIN`, the `futures-timer` thread dies, and the engine panics with `timer has gone away` — after which **every database query hangs forever with no actionable application-level error**. Symptoms are deceptive: `psql` and the raw `pg` driver keep working fine, only Prisma hangs. The setting must be applied in `lib/prisma.ts` (not only `env.js`) so that seed and maintenance scripts get it too.

- **Historical trap — database name with a space.** The original cPanel database was created as `c2862963c_ bleadin_db` (note the space). cPanel writes `pg_hba.conf` entries per database, so every connection attempt using the "logical" name failed with the misleading `no pg_hba.conf entry for host ... SSL off` — which was misdiagnosed (including by LWS support) as "external access disabled / no SSL support", and is what originally pushed this project onto Neon. The active database is now `c2862963c_bleadindb`. A cPanel PostgreSQL database only becomes reachable once a user is attached to it via `uapi Postgresql grant_all_privileges user=... database=...`; without that grant there is no `pg_hba.conf` entry and connections are refused regardless of credentials.
- `.env` (git-ignored) holds `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `UNIPILE_API_KEY`, `UNIPILE_DSN`, `UNIPILE_ACCOUNT_ID`. `.env.deploy` (see `.env.deploy.example`) holds SSH/cPanel deployment target config, separate from the app's own `.env`.
- In production, `SELF_PING_URL` (if set) triggers a self-ping every 4 minutes to keep the Passenger process from idling out.
