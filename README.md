# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

Celebra-me is an Astro-based web platform for premium digital invitations. The repository contains
the public marketing site, invitation rendering engine, host dashboard, and the RSVP/admin APIs that
support event operations.

## Stack

- Astro 7
- TypeScript
- React islands
- SCSS
- Supabase
- Jest and Playwright
- pnpm
- Vercel

## Prerequisites

- Node.js within the `package.json` `engines` range
- pnpm at the exact `package.json` `packageManager` version
- Supabase CLI for local database workflows (`db:start`, `db:migrate -- --target local`,
  `db:local:restore-from-dump`, `db:local:backup-wip`, `db:local:bootstrap-admin`,
  `db:local:validate`, `db:disposable:reset`, `db:migrate:new`)
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

| Command                      | Purpose                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                   | start the Astro dev server                                                                                       |
| `pnpm build`                 | run type checks, then generate the production Astro/Vercel build                                                 |
| `pnpm preview`               | preview the Astro app locally                                                                                    |
| `pnpm type-check`            | run `astro check` and `tsc --noEmit`                                                                             |
| `pnpm lint`                  | run ESLint across the repository                                                                                 |
| `pnpm lint:styles`           | audit all SCSS sources with Stylelint                                                                            |
| `pnpm lint:styles:changed`   | lint only changed stylesheet files                                                                               |
| `pnpm test`                  | run the Jest suite                                                                                               |
| `pnpm test:coverage`         | run the Jest suite with coverage enabled                                                                         |
| `pnpm validate:structure`    | validate agent references, plans, documentation links, and forbidden tracked artifacts                           |
| `pnpm validate:event-parity` | compare content events against the Supabase `events` table                                                       |
| `pnpm run ci`                | static/build, Jest and certified browser checks; remote policy/DB checks and interactive Git Safety are separate |
| `pnpm ops <command>`         | run repository ops tooling through `scripts/cli.mjs`                                                             |

`pnpm ops` commands, invitation commands and the database command inventory are listed in
[`scripts/README.md`](scripts/README.md); `package.json` and `scripts/cli.mjs` remain the source of
truth.

## Repository Layout

```text
celebra-me/
├── docs/                    # Evergreen docs (`core/`, `domains/`, `invitations/`)
├── public/                  # Public static assets
├── scripts/                 # Operational CLI scripts and script docs
├── src/
│   ├── assets/              # Source images and icons consumed through the asset pipeline
│   ├── components/          # Astro components and React islands
│   ├── content/             # Astro content collection (`event-demos`)
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
reconciliation status must be read from the live, read-only audit; repository migration counts are
not evidence of hosted state. Direct production SQL is prohibited; all schema changes must be
introduced through versioned migrations.

Hosted Preview is the mandatory managed-invitation QA gate. It uses isolated synthetic data and
separate credentials (`PREVIEW_DB_URL`); migration and audit tooling are
`pnpm db:migrate -- --target preview` and `pnpm db:preview:audit`.

For local development, use local Supabase and keep `.env.local` pointed away from production.

| Command                         | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `pnpm db:start`                 | Start local Supabase                                                 |
| `pnpm db:local:validate`        | Check local DB health and super admin status                         |
| `pnpm db:migrate -- --target …` | Plan/apply schema migrations through the environment-targeted CLI    |
| `pnpm dbs`                      | Read-only managed content and schema status; prints the next command |
| `pnpm invitation:release`       | Managed invitation status, dry-run or apply for Local and Preview    |
| `pnpm prod:apply`               | Owner-only Production plan/apply (schema, invitation, patch)         |

`pnpm db:push`, `pnpm db:local:reset`, `pnpm db:local:refresh-from-prod`, and
`pnpm db:local:refresh-from-prod-preserve-local` are intentionally blocked safety rails, not
runnable workflows. Production is read-only for backups and audits; it mutates only through the
owner-gated `pnpm prod:apply` path (`pnpm db:migrate -- --target production` hands off to it).

See [`docs/database-workflow.md`](docs/database-workflow.md) for the full operational runbook,
command details, troubleshooting, and production safety rules. Environment source hierarchy and
variable categories live in [`docs/env-workflow.md`](docs/env-workflow.md).

## Documentation

- `docs/core/agent-interaction.md`
- `docs/core/architecture.md`
- `docs/core/git-governance.md`
- `docs/core/project-conventions.md`
- `docs/core/release-process.md`
- `docs/domains/content/collections.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/variant-system.md`
- `docs/domains/tracking/commercial-attribution.md`
- `docs/invitations/README.md`

## Maintainer

Francisco Mendoza

- GitHub: [fm-dev-mx](https://github.com/fm-dev-mx)
- LinkedIn: [francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)
