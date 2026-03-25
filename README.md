# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

Celebra-me is an Astro-based web platform for premium digital invitations. The repository contains
the public marketing site, invitation rendering engine, host dashboard, and the RSVP/admin APIs that
support event operations.

## Stack

- Astro 5
- TypeScript
- React islands
- SCSS
- Supabase
- Jest and Playwright
- pnpm
- Vercel

## Prerequisites

- Node.js `>=20.19.0`
- pnpm `10.x`

## Getting Started

```bash
pnpm install
pnpm dev
```

Create `.env.local` from `.env.example` before using auth, email, or Supabase-backed flows.

## Core Scripts

| Command              | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | start the Astro dev server                           |
| `pnpm build`         | run `astro check` and build production output        |
| `pnpm start`         | preview the Astro app locally                        |
| `pnpm preview`       | serve the Vercel static output                       |
| `pnpm type-check`    | run `astro check`                                    |
| `pnpm lint`          | run ESLint across the repository                     |
| `pnpm test`          | run the Jest suite                                   |
| `pnpm ci`            | run type-check, lint, and tests                      |
| `pnpm ops <command>` | run repository ops tooling through `scripts/cli.mjs` |

## Ops CLI

`pnpm ops` dispatches to the scripts under `scripts/`:

- `optimize-assets`
- `validate-schema`
- `validate-event-parity`
- `validate-commits`
- `new-invitation`

## Repository Layout

```text
celebra-me/
├── .agent/                  # Agent entrypoints, workflows, plan governance, governance config
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

### API Routes

- Auth APIs under `src/pages/api/auth/**`
- Dashboard APIs under `src/pages/api/dashboard/**`
- Guest invitation APIs under `src/pages/api/invitacion/[inviteId]/**`

## Database Workflow

Supabase schema changes are versioned under `supabase/migrations`.

Useful commands:

```bash
pnpm db:start
pnpm db:push
pnpm db:reset:local
pnpm db:migrate:new <migration_name>
```

See `docs/domains/rsvp/database.md` for operational details.

## Documentation

- `docs/core/architecture.md`
- `docs/core/project-conventions.md`
- `docs/core/testing-strategy.md`
- `docs/domains/content/collections.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/theme/architecture.md`
- `docs/archive/` for historical material

## Agent Entry Points

- `.agent/README.md`
- `.agent/index.md`
- `.agent/GATEKEEPER_RULES.md`
- `.agent/workflows/system-doc-alignment.md`

## Maintainer

Francisco Mendoza

- GitHub: [fm-dev-mx](https://github.com/fm-dev-mx)
- LinkedIn: [francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)
