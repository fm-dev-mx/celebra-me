# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

Celebra-me is an Astro-based web platform for premium digital invitations. The repository contains
the public marketing site, invitation rendering engine, host dashboard, and the RSVP/admin APIs that
support event operations.

## Stack

- Astro 6
- TypeScript
- React islands
- SCSS
- Supabase
- Jest and Playwright
- pnpm
- Vercel

## Prerequisites

- Node.js `>=22.12.0 <25`
- pnpm `11.x`
- Supabase CLI for local database workflows (`db:start`, `db:local:refresh-from-prod`,
  `db:local:backup-wip`, `db:local:bootstrap-admin`, `db:local:validate`, `db:local:reset`,
  `db:migrate:new`)
- PostgreSQL client tools with `psql` installed and available on PATH for local DB workflow scripts.
  Verify with `psql --version`.

## Getting Started

```bash
pnpm install
pnpm dev
```

Use `.env` for local Supabase by default. Create `.env.local` only for local overrides, and never
point `.env.local` at production. See [`docs/env-workflow.md`](docs/env-workflow.md) for the
canonical environment workflow.

## Core Scripts

| Command                    | Purpose                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                 | start the Astro dev server                                                                                                    |
| `pnpm build`               | run `astro check`, then generate the production Astro/Vercel build                                                            |
| `pnpm preview`             | preview the Astro app locally                                                                                                 |
| `pnpm type-check`          | run `astro check`                                                                                                             |
| `pnpm lint`                | run ESLint across the repository                                                                                              |
| `pnpm lint:styles`         | audit all SCSS sources with Stylelint                                                                                         |
| `pnpm lint:styles:changed` | lint only changed stylesheet files                                                                                            |
| `pnpm test`                | run the Jest suite                                                                                                            |
| `pnpm run ci`              | canonical full gate: type-check, ESLint, full Stylelint, governance, parity, PII, unit, E2E, production build, and Git safety |
| `pnpm ops <command>`       | run repository ops tooling through `scripts/cli.mjs`                                                                          |

## Ops CLI

`pnpm ops` dispatches to the scripts under `scripts/`:

- `optimize-assets`
- `check-links`
- `validate-schema`
- `validate-event-parity`
- `validate-commits`
- `new-invitation` (disabled fail-closed; real/client invitations are DB-published)

## Repository Layout

```text
celebra-me/
├── docs/                    # Evergreen docs (`core/`, `domains/`) and `archive/`
├── public/                  # Public static assets
├── scripts/                 # Operational CLI scripts and script docs
├── src/
│   ├── assets/              # Source images and icons consumed through the asset pipeline
│   ├── components/          # Astro components and React islands
│   ├── content/             # Astro content collections (`event-demos`, `event-templates`)
│   ├── data/                # Static marketing and supporting data modules
│   ├── hooks/               # Shared React hooks
│   ├── interfaces/          # Shared TS interfaces
│   ├── layouts/             # Layout shells for public pages and dashboard pages
│   ├── lib/                 # Domain logic, adapters, services, repositories, theme contracts
│   ├── pages/               # Public routes, invitation routes, dashboard routes, and API routes
│   ├── styles/              # Global, dashboard, landing, invitation, and theme SCSS
│   ├── utils/               # Shared helpers
│   ├── env.d.ts             # Environment variable typings
│   └── middleware.ts        # Auth and request-boundary middleware
├── supabase/                # Migrations and local database support
└── tests/                   # Jest and Playwright test suites
```

## Application Surfaces

### Public Routes

- Marketing pages under `src/pages/*.astro`
- Invitation routes under `src/pages/[eventType]/[slug]*`

### Dashboard Routes

- `/dashboard/invitados`
- `/dashboard/admin`
- `/dashboard/usuarios`
- `/dashboard/claimcodes`
- `/dashboard/mfa-setup`
- `/dashboard/invitaciones`
- `/dashboard/invitaciones/[id]`
- `/dashboard/invitaciones/[id]/draft`
- `/dashboard/invitaciones/[id]/preview`
- `/dashboard/invitaciones/[id]/review`

### Public Utility Routes

- `/captura/[token]`

### API Routes

- Auth APIs under `src/pages/api/auth/**`
- Dashboard APIs under `src/pages/api/dashboard/**`
  - Guest management: `/api/dashboard/guests`, `/api/dashboard/guests/bulk`,
    `/api/dashboard/guests/:guestId`, etc.
  - Intake: `/api/dashboard/intake`, `/api/dashboard/intake/:id`
  - Events, claim codes, admin
- Guest invitation APIs under `src/pages/api/invitacion/[inviteId]/**`
- Public RSVP: `/api/invitacion/public/[eventType]/[slug]/rsvp`
- Intake capture: `/api/captura/[token]`
- Health: `/api/health`
- Contact: `/api/contact`

## Database Workflow

Supabase schema changes are versioned under `supabase/migrations`. Production migration-history
reconciliation is complete (`59/59` migrations active, 0 pending). Direct production SQL is
prohibited; all schema changes must be introduced through versioned migrations.

Hosted Preview is the mandatory managed-invitation QA gate. It uses isolated synthetic data and
separate credentials (`PREVIEW_DB_URL`); migration and audit tooling are `pnpm db:preview:migrate`
and `pnpm db:preview:audit`.

For local development, use local Supabase and keep `.env.local` pointed away from production.

| Command                           | Purpose                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm db:start`                   | Start local Supabase                                                                      |
| `pnpm db:local:restore-from-dump` | Import a production dump into the persistent local database without destroying it         |
| `pnpm db:local:backup-wip`        | Dump selected local tables before data-dependent operations                               |
| `pnpm db:local:bootstrap-admin`   | Create/repair local super admin without resetting                                         |
| `pnpm db:local:validate`          | Check local DB health and super admin status                                              |
| `pnpm db:disposable:reset`        | Reset the isolated disposable test database (destructive testing)                         |
| `pnpm db:validate:pipeline`       | Run full database pipeline validation (baseline, latest, pgTAP, application flows)        |
| `pnpm db:prod:backup`             | Read-only production data dump                                                            |
| `pnpm db:prod:audit`              | Read-only production migration history & schema audit (reports `59/59`, zero pending)     |
| `pnpm db:prod:migrate`            | Apply reviewed migrations to production (runs preflight checks, backup, and confirmation) |
| `pnpm db:preview:migrate`         | Apply pending migrations to Preview (`PREVIEW_DB_URL`)                                    |
| `pnpm db:preview:audit`           | Read-only Preview schema drift audit (`PREVIEW_DB_URL`)                                   |
| `pnpm invitation:update`          | Unified managed invitation update, package, Preview approval, and Production resume       |
| `pnpm db:prod:patch`              | Dry-run lint for manifest-bearing production patches                                      |
| `pnpm db:sql:lint`                | Lint a production SQL patch file                                                          |
| `pnpm db:migrate:new <name>`      | Scaffold a new migration                                                                  |

`pnpm db:push`, `pnpm db:local:reset`, and `pnpm db:local:refresh-from-prod` are intentionally
blocked to protect persistent databases. Production is read-only for backups and audits; it can only
be mutated via `pnpm db:prod:migrate`.

See [`docs/database-workflow.md`](docs/database-workflow.md) for the full operational runbook,
command details, troubleshooting, and production safety rules. Environment source hierarchy and
variable categories live in [`docs/env-workflow.md`](docs/env-workflow.md).

## Documentation

- `docs/core/agent-interaction.md`
- `docs/core/architecture.md`
- `docs/core/project-conventions.md`
- `docs/core/release-process.md`
- `docs/domains/content/collections.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/theme/architecture.md`
- `docs/archive/` for historical material

## Maintainer

Francisco Mendoza

- GitHub: [fm-dev-mx](https://github.com/fm-dev-mx)
- LinkedIn: [francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)
