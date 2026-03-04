# Plan: Ops Automation & Clean-up

## Objective

Unify the tooling ecosystem, eradicate temporary or orphan scripts, and improve the usability and
cross-platform portability of critical operation workflows.

## Phase 1: Immediate Clean-up [100%]

- [x] Delete temporary testing scripts at the project root (`test_empty_body.js`,
      `test_json_error.js`, `test-error-mapper.js`).
- [x] Delete residual output logs at the project root (e.g., `test_output.txt`).
- [x] Audit the `scripts/` directory to map orphan scripts. Integrate required scripts into
      `package.json` and delete obsolete ones.
- [x] Remove vacant or deprecated folders like `scripts/config` if absolutely unused.

## Phase 2: Language Standardization [100%]

- [x] Convert Bash utilities (`rotate-credentials.sh`, `remove-env-from-history.sh`) to unified
      **Node.js** (`.mjs`). This ensures perfect cross-platform compatibility across Linux, macOS,
      and Windows.
- [x] Migrate PowerShell scripts (`rsvp-db-remote-runbook.ps1`) to the new Node.js standard.
- [x] Standardize the chaotic mix of file extensions in `scripts/` (`.cjs`, `.mjs`, `.js`, `.ts`).
      Enforce a single strict convention (everything was renamed explicitly to `.mjs`).
- [x] Safely remove the legacy `.sh` and `.ps1` files after verification.

## Phase 3: Robustness & Usability Hardening [100%]

- [x] **Centralized CLI Dispatcher:** Build a unified entry point (`scripts/cli.mjs`) to act as a
      command hub (so developers can run `pnpm ops <command>`).
- [x] Implement standardized argument parsing (e.g., using `util.parseArgs`) in all critical
      regenerated operation scripts to unify API consumption.
- [x] Add a `--dry-run` flag to any script that mutates the local environment, database, or CI/CD
      pipelines.
- [x] Implement a universal `--help` flag for all tooling scripts to improve internal documentation
      and developer discoverability.

## Phase 4: Environment Variables Synchronization [100%]

- [x] Update `src/lib/env-validation.ts` to include missing validations for variables defined in
      `.env.example` (`ENABLE_MFA`, `SENTRY_AUTH_TOKEN`, `SENDGRID_API_KEY`,
      `TRUST_DEVICE_MAX_AGE_DAYS`).
- [x] Purge any deprecated attributes exposed in `.env.example` that are no longer referenced in the
      codebase.
- [x] Test the environment validation script locally to guarantee 1-to-1 coherence.
