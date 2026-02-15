# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

**Celebra-me** is a web platform for the **creation and sale of custom digital invitations**. It
provides a **fully managed service**: clients share their event details, and Celebra-me handles the
design, customization, and delivery of a polished digital invitation.

The platform is built to deliver **high-performance, responsive invitations** that can be easily
shared across digital channels.

---

## About Celebra-me

Celebra-me is not a DIY invitation builder.

Instead, it operates as a **design-led, curated service** where each invitation is created and
customized by the Celebra-me team. This approach ensures consistent quality, visual coherence, and a
professional result for every event.

---

## Features

- **Custom Digital Invitations** Personalized invitations for events such as weddings, quinceañeras,
  birthdays, and more.

- **Fully Managed Process** Design and customization are handled by Celebra-me, not end users.

- **Responsive by Default** Invitations are optimized for mobile, tablet, and desktop.

- **Digital Delivery** Invitations are shared easily via messaging apps, email, or social platforms.

---

## Tech Stack

The project uses a modern, performance-oriented stack:

- **Framework**: [Astro](https://astro.build/) — component-based, island architecture.
- **Language**: [TypeScript](https://www.typescriptlang.org/) — static typing for reliability.
- **Styling**: **SCSS** — the only supported styling system (no Tailwind).
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Linting**: ESLint
- **Formatting**: Prettier
- **Deployment**: Vercel

---

## Project Structure

The repository follows standard Astro conventions:

```plaintext
celebra-me/
├── public/
│   ├── icons/                # Favicons and shared icons
│   └── images/               # Static images
├── src/
│   ├── components/           # Reusable UI components (presentation-only)
│   ├── layouts/              # Page layouts
│   ├── pages/                # File-based routing and API endpoints
│   ├── content/              # Astro content collections
│   ├── lib/                  # Core libraries (Universal Asset Registry)
│   ├── styles/               # SCSS (tokens/, themes/, components/)
│   ├── utils/                # Shared utilities
│   └── env.d.ts              # Environment variable typings
├── .agent/                   # Agent rules and conventions
├── docs/                     # Architecture and technical documentation
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

The structure prioritizes **clarity, simplicity, and deploy safety**, avoiding unnecessary
architectural layers.

---

## Automation & Agents

This project uses **automated agents** (e.g. a Gatekeeper) as part of the development workflow.

- Operational rules and conventions live in `.agent/`.
- These documents are **versioned and authoritative** for agent behavior.
- Agents are expected to follow existing conventions and apply **safe, pragmatic fixes**.

Start here if you are using agents:

- `.agent/README.md`
- `.agent/GATEKEEPER_RULES.md`
- `.agent/PROJECT_CONVENTIONS.md`

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **pnpm**

### Installation

```bash
git clone https://github.com/fm-dev-mx/celebra-me.git
cd celebra-me
pnpm install
```

### Environment Variables

```bash
cp .env.example .env.local
```

Update `.env.local` with the required values. All environment variables must be typed in
`src/env.d.ts`.

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Build & Deployment

### Production Build

```bash
pnpm build
```

### Deployment

The project is deployed on **Vercel**. Configuration lives in `vercel.json`.

For manual deployment:

```bash
pnpm add -g vercel
vercel --prod
```

---

## Code Quality

Run checks locally before committing:

```bash
pnpm lint
pnpm format
pnpm type-check
```

---

## Testing

Run the test suite:

```bash
pnpm test
```

### Coverage Report

```bash
pnpm test -- --coverage
```

### Smoke Test (post-build)

```bash
pnpm build
node scripts/smoke-test.js
```

For detailed testing documentation, see [`docs/TESTING.md`](docs/TESTING.md).

---

## Database Migrations (Supabase)

RSVP database schema is managed with versioned Supabase migrations in `supabase/migrations`.

Useful commands:

```bash
pnpm db:start
pnpm db:push
pnpm db:reset:local
pnpm db:migrate:new <migration_name>
```

Operational guide: [`docs/DB_RSVP.md`](docs/DB_RSVP.md)

Remote runbook helper:

```powershell
pwsh -File scripts/rsvp-db-remote-runbook.ps1
```

---

## Documentation

- **Architecture**: `docs/ARCHITECTURE.md`
- **RSVP DB Operations**: `docs/DB_RSVP.md`
- **RSVP UI Operation (Admin Panel)**: `docs/DB_RSVP.md#client-facing-ui-operation`
- **RSVP Operational Status**: `docs/RSVP_STATUS.md`
- **Agent Rules**: `.agent/`

Documentation is expected to evolve alongside the codebase.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Maintainer

Francisco Mendoza

- GitHub: [https://github.com/fm-dev-mx](https://github.com/fm-dev-mx)
- LinkedIn:
  [https://www.linkedin.com/in/francisco-mendoza-ordn/](https://www.linkedin.com/in/francisco-mendoza-ordn/)
