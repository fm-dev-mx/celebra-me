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
point `.env.local` at production.

## Core Scripts

| Command                    | Purpose                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                 | start the Astro dev server                                                          |
| `pnpm build`               | run event parity validation, `astro check`, and build output                        |
| `pnpm start`               | preview the Astro app locally                                                       |
| `pnpm preview`             | preview the Astro app locally                                                       |
| `pnpm type-check`          | run `astro check`                                                                   |
| `pnpm lint`                | run ESLint across the repository                                                    |
| `pnpm lint:styles`         | audit all SCSS sources with Stylelint                                               |
| `pnpm lint:styles:changed` | lint only changed stylesheet files                                                  |
| `pnpm test`                | run the Jest suite                                                                  |
| `pnpm run ci`              | run type-check, ESLint, changed-stylelint, governance, parity, unit, and e2e checks |
| `pnpm ops <command>`       | run repository ops tooling through `scripts/cli.mjs`                                |

## Ops CLI

`pnpm ops` dispatches to the scripts under `scripts/`:

- `optimize-assets`
- `check-links`
- `validate-schema`
- `validate-event-parity`
- `validate-commits`
- `new-invitation`

## Repository Layout

```text
celebra-me/
├── docs/                    # Evergreen docs (`core/`, `domains/`) and `archive/`
├── public/                  # Public static assets
├── scripts/                 # Operational CLI scripts and script docs
├── src/
│   ├── assets/              # Source images and icons consumed through the asset pipeline
│   ├── components/          # Astro components and React islands
│   ├── content/             # Astro content collections (`events`, `event-demos`, `event-templates`)
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
- `/dashboard/eventos`
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

Supabase schema changes are versioned under `supabase/migrations`.

| Command                                           | Purpose                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm db:start`                                   | Start local Supabase                                          |
| `PROD_DB_URL=... pnpm db:local:refresh-from-prod` | Destructive local reset + production import + admin bootstrap |
| `pnpm db:local:backup-wip`                        | Dump selected local tables before refresh                     |
| `pnpm db:local:reset`                             | Schema-only local reset (no admin)                            |
| `pnpm db:local:reset-ready`                       | Reset + bootstrap local super admin                           |
| `pnpm db:local:bootstrap-admin`                   | Create/repair local super admin without resetting             |
| `pnpm db:local:validate`                          | Check local DB health                                         |
| `pnpm db:prod:backup`                             | Read-only production data dump                                |
| `pnpm db:prod:migrate`                            | Apply reviewed migrations to production                       |
| `pnpm db:migrate:new <name>`                      | Scaffold a new migration                                      |

Production is read-only for backups and local refreshes; it can only be mutated via
`pnpm db:prod:migrate`. See `docs/database-workflow.md` for the full operational workflow,
troubleshooting, and safety rules.

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
