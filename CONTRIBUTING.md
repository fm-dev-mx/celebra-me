# Contributing to Celebra-me.com

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Celebra-me.com, which is hosted on
[GitHub](https://github.com/fm-dev-mx/celebra-me). These are mostly guidelines, not rules. Use your
best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Celebra-me.com. Following these
guidelines helps maintainers and the community understand your report, reproduce the behavior, and
find related reports.

Before creating a bug report, please check if the issue has already been reported by searching the
[issues](https://github.com/fm-dev-mx/celebra-me/issues). When you create a bug report, provide as
much detail as possible.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Celebra-me.com, including
completely new features and minor improvements to existing functionality. When you are creating an
enhancement suggestion, please include as much detail as possible.

### Pull Requests

The process described here has several goals:

- Maintain Celebra-me.com's quality.
- Fix problems that are important to users.
- Engage the community in working toward the best possible product.

Please follow these steps to have your contribution considered by the maintainers:

1. Fork the repository.
2. Create a branch from `develop` (`git switch -c feat/short-description develop`). Branch creation
   SSOT: [`docs/core/git-governance.md`](docs/core/git-governance.md).
3. Make your changes, ensuring that you follow the coding style guidelines (below).
4. Commit your changes (for example,
   `git commit -m 'fix(validation): preserve mixed input checks'`).
   > [!NOTE] We use **Conventional Commits** with a required scope. See
   > [`docs/core/git-governance.md`](docs/core/git-governance.md) for the full commit policy,
   > including atomic-commit expectations and commit-body guidance.
5. Push to the branch (`git push origin feature-name`).
   > [!TIP] A `pre-push` hook runs audit-only commit validation so you can review commit-quality
   > warnings before opening a pull request.
6. Create a new pull request, following the pull request template provided.

> [!NOTE] This project uses **Husky** and **lint-staged** to ensure code quality. A pre-commit hook
> blocks direct commits to protected branches and runs staged-file checks before the commit is
> created.

### Sensitive Data

> [!CAUTION] This repository may contain **Personally Identifiable Information (PII)** if care is
> not taken. Before committing, review your changes against the
> [`docs/core/sensitive-data-guide.md`](docs/core/sensitive-data-guide.md) to ensure no real client
> names, phone numbers, addresses, or asset URLs are hardcoded in source files.

### Coding Style

Please follow these coding standards:

- **Code Formatting**: Use Prettier for code formatting. The configuration is already set up in
  `.prettierrc.mjs`.
- **Linting**: Use ESLint for identifying and reporting on patterns in JavaScript. The configuration
  is already set up in `eslint.config.js` (ESLint flat config).
- **SCSS Linting**: Use `pnpm lint:styles:changed` for required changed-file checks and
  `pnpm lint:styles` for full-repository audits.
- **Type Safety**: Ensure type safety with TypeScript.
- **Commit Messages**: Follow the commit policy in
  [`docs/core/git-governance.md`](docs/core/git-governance.md).

### Development Environment

To set up the development environment:

1. Install Node.js within the range in `package.json` → `engines`.
2. Use the exact pnpm version declared in `package.json` → `packageManager`.

3. Install the Supabase CLI if you plan to run the local database workflows (`pnpm db:start`,
   `pnpm db:migrate -- --target local`, `pnpm db:local:validate`, `pnpm db:disposable:reset`,
   `pnpm db:migrate:new`). Persistent-local reset and refresh aliases are blocked safety rails, not
   runnable setup commands.

4. Clone the repository:

   ```bash
   git clone https://github.com/fm-dev-mx/celebra-me.git
   cd celebra-me
   ```

5. Install dependencies:

   ```bash
   pnpm install
   ```

6. Run the development server:

   ```bash
   pnpm dev
   ```

### Testing Requirements

Follow the A/B/C tiers and commands in the canonical
[validation procedures](docs/core/validation-procedures.md). Start with `pnpm validate:changed` and
the focused checks required by the change; do not repeat related Jest against unchanged inputs. The
commit hook independently checks staged paths. Add behavior tests where a changed contract needs
them; coverage runs are useful when investigating a coverage gap, not an extra mandatory full-suite
repetition for every PR.

For Markdown changes, run `pnpm ops check-links` and the Markdown table check. Full `pnpm run ci`
runs static/build, Jest and browser checks, including full Stylelint; it does not run interactive
Git Safety, Repository Policy or disposable database contracts. Complete remote CI and correlated
Preview smoke on the final SHA remain release requirements. Use
[release process](docs/core/release-process.md) for certification and promotion.

For detailed repository conventions, see
[`docs/core/project-conventions.md`](docs/core/project-conventions.md).

## Thank You

Thank you for considering contributing to Celebra-me.com! Your contributions help make it an even
better platform for creating beautiful, personalized digital invitations.
