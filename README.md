# Celebra-me

![Celebra-me Logo](public/icons/favicon.svg)

**Celebra-me** is a high-performance web application designed for the **creation and sale of custom digital invitations**. While users can easily order invitations for their special events—like weddings, quinceañeras, and more—the actual design and customization are handled by **Celebra-me**, ensuring a seamless and professional process from start to finish.

Our platform leverages modern web technologies to deliver visually stunning, responsive invitations directly to clients, enabling them to effortlessly share them with their guests via digital channels.

## Table of Contents

-   [About Celebra-me](#about-celebra-me)
-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Project Structure](#project-structure)
-   [Getting Started](#getting-started)
-   [Code Quality](#code-quality)
-   [License](#license)
-   [Contact](#contact)

## About Celebra-me

Celebra-me.com is not just another "DIY" invitation platform. Instead, it offers a **fully managed service** where we create **custom digital invitations** tailored to each client's event. From initial inquiry to final delivery, we handle all aspects of design and customization. Clients simply provide details about their event, and we create the invitations for them, ensuring they receive a polished, professional product.

## Features

-   **Custom Digital Invitations**: We design personalized invitations for a variety of events (e.g., weddings, quinceañeras, birthdays).
-   **Full-Service Approach**: The Celebra-me team handles all aspects of design, ensuring consistency, quality, and brand alignment.
-   **Responsive Design**: All invitations are optimized for viewing on any device, including mobile, tablet, and desktop.
-   **Easy Sharing**: Invitations are delivered digitally and can be shared easily via social media, email, or messaging apps.
-   **Event Analytics**: Track invitation views and RSVPs through a custom dashboard (coming soon).

## Tech Stack

Celebra-me is built with a modern tech stack to ensure performance, scalability, and maintainability:

-   **Framework**: [Astro](https://astro.build/) (v4.x) - Static site generator leveraging component islands architecture for optimized performance.
-   **Language**: [TypeScript](https://www.typescriptlang.org/) (v5.x) - Strongly typed JavaScript for better maintainability.
-   **Styling**: [CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) - Used for core styles, allowing precise control over the look and feel of the application.
-   **Utility Styling**: [TailwindCSS](https://tailwindcss.com/) (v3.x) - Utility-first CSS framework for fast, responsive UI design.
-   **Package Manager**: [pnpm](https://pnpm.io/) - Fast, efficient package manager designed to save disk space.
-   **Linting**: [ESLint](https://eslint.org/) - Configured to enforce code quality and catch potential issues.
-   **Formatting**: [Prettier](https://prettier.io/) - Automatic code formatting to maintain consistent style.
-   **Deployment**: [Vercel](https://vercel.com/) - Serverless deployment platform optimized for static and dynamic sites.

## Project Structure

```plaintext
celebra-me/
├── public/
│   ├── icons/               # Favicon and icons used across the platform.
│   └── images/              # Static images for marketing and design.
├── src/
│   ├── components/          # Reusable UI components such as buttons, modals, and forms.
│   ├── config/              # Configuration files and constants.
│   ├── data/                # Static data or fetch utilities.
│   ├── hooks/               # Custom React hooks for various logic (state management, side effects).
│   ├── layouts/             # Layout components used to structure pages.
│   ├── pages/               # Astro pages with file-based routing.
│   ├── sections/            # Reusable sections of the site (e.g., headers, footers).
│   ├── services/            # Business logic and API service handlers.
│   ├── styles/              # Global styles and Tailwind configurations.
│   ├── types/               # TypeScript types and interfaces.
│   └── utilities/           # Utility functions shared across the application.
├── .editorconfig            # Configures consistent editor behavior for contributors.
├── .env                     # Environment variables for API keys, credentials, and runtime settings.
├── .eslintrc.cjs            # ESLint configuration to enforce code quality.
├── .gitignore               # Defines files and directories to ignore in version control.
├── .prettierignore          # Files to be ignored by Prettier when formatting.
├── .prettierrc.mjs          # Configuration for Prettier to enforce consistent formatting.
├── astro.config.mjs         # Astro configuration file defining project-specific settings.
├── CONTRIBUTING.md          # Contribution guidelines for developers.
├── cspell.json              # CSpell configuration for spell checking.
├── env.d.ts                 # TypeScript type definitions for environment variables.
├── LICENSE                  # License information for the project.
├── package.json             # Project metadata and dependencies.
├── pnpm-lock.yaml           # Lockfile for consistent package installations.
├── README.md                # Project overview and documentation (this file).
├── tailwind.config.mjs      # Tailwind CSS configuration file.
├── tsconfig.json            # TypeScript configuration for the project.
└── vercel.json              # Vercel deployment configuration.
```

This structure is designed to maintain a **clear separation of concerns** and make the codebase easy to navigate and extend. Each section has a specific responsibility, from components to business logic, ensuring scalability as the platform evolves.

## Getting Started

### Prerequisites

To work on Celebra-me, you'll need:

-   **Node.js** (v18.x or later)
-   **pnpm** (v7.x or later)

### Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/fm-dev-mx/celebra-me.git
    cd celebra-me
    ```

2. **Install dependencies**:

    ```bash
    pnpm install
    ```

3. **Set up environment variables**:

    ```bash
    cp .env.example .env.local
    ```

    Edit `.env.local` with your specific configuration (e.g., API keys, Vercel tokens).

4. **Start the development server**:

    ```bash
    pnpm dev
    ```

    The site will be available at [`http://localhost:3000`](http://localhost:3000).

### Production Build

To create a production build locally:

```bash
pnpm build
```

This generates static files in the `.astro` directory, ready for deployment.

### Deployment

We deploy the platform to **Vercel**. The `vercel.json` file configures deployment settings.

For manual deployment:

1. Install Vercel CLI:

    ```bash
    pnpm add -g vercel
    ```

2. Run:

    ```bash
    vercel --prod
    ```

## Code Quality

-   **Linting**: Ensure the code adheres to defined quality standards.

    ```bash
    pnpm lint
    ```

-   **Formatting**: Automatically format the codebase.

    ```bash
    pnpm format
    ```

-   **Type Checking**: Run TypeScript type checks.

    ```bash
    pnpm type-check
    ```

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For inquiries or contributions, please open an issue on this repository.

Maintainer: Francisco Mendoza

-   **GitHub**: [fm-dev-mx](https://github.com/fm-dev-mx)
-   **LinkedIn**: [francisco-mendoza-ordn](https://www.linkedin.com/in/francisco-mendoza-ordn/)
