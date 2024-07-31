# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

Celebra-me is a high-performance web application for creating and managing digital invitations, leveraging modern web technologies and best practices.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Getting Started](#getting-started)
- [License](#license)
- [Contact](#contact)

## Tech Stack

- **Framework**: [Astro](https://astro.build/) (v4.12) - Static site generator with component islands
- **Language**: [TypeScript](https://www.typescriptlang.org/) (v5.x) - Typed superset of JavaScript
- **Styling**: [TailwindCSS](https://tailwindcss.com/) (v3.x) - Utility-first CSS framework
- **State Management**: [Nanostores](https://github.com/nanostores/nanostores) - Lightweight state management
- **Package Manager**: [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- **Linting**: [ESLint](https://eslint.org/) with custom configuration
- **Formatting**: [Prettier](https://prettier.io/) for consistent code style
- **Spell Checking**: [CSpell](https://cspell.org/) for catching typos in code and comments
- **Deployment**: [Vercel](https://vercel.com/) - Platform for serverless deployment

## Project Architecture

```plaintext
celebra-me
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/         # Shared components (buttons, inputs, etc.)
│   │   ├── icons/          # SVG icons as components
│   │   ├── layout/         # Layout components (grids, containers)
│   │   ├── typography/     # Text-related components
│   │   └── ui/             # Complex UI components (cards, modals)
│   ├── config/             # Configuration files and constants
│   ├── data/               # JSON data files and data fetching utilities
│   ├── layouts/            # Astro layout templates
│   ├── pages/              # Astro page components (file-based routing)
│   ├── sections/           # Page section components
│   ├── services/           # API services and business logic
│   ├── styles/             # Global styles and Tailwind utilities
│   └── utilities/              # Utility functions and helpers
├── public/                 # Static assets (fonts, images, etc.)
├── .astro/                 # Astro build output (gitignored)
├── .vscode/                # VS Code settings for consistent developer experience (gitignored)
└── [Config Files]          # Root configuration files (.eslintrc, tsconfig.json, etc.)
```

## Getting Started

### Prerequisites

- Node.js (v18.x or later)
- pnpm (v7.x or later)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/fm-dev-mx/celebra-me.git
   cd celebra-me
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your specific configuration.

4. Start the development server:

   ```bash
   pnpm dev
   ```

   The site will be available at `http://localhost:3000`.

### Local Production Build

To create a production build locally:

```bash
pnpm build
```

This generates static files in the `.astro` directory.

### Deployment

We use Vercel for deployment. The `vercel.json` file in the root configures the deployment settings.

To deploy manually:

1. Install Vercel CLI: `pnpm add -g vercel`
2. Run: `vercel --prod`

## Code Quality and Best Practices

- Run linting: `pnpm lint`
- Format code: `pnpm format`
- Type checking: `pnpm type-check`

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For technical queries or contributions, please open an issue on this repository.

Maintainer: Francisco Mendoza

- GitHub: [fm-dev-mx](https://github.com/fm-dev-mx)
- LinkedIn: [francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)
