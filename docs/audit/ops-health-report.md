# Operations Health Report

## 1. Script Inventory (Phase 1)

### Orphan Scripts

The following scripts exist in the repository but are not registered in `package.json`, or are
temporary and not maintained in the standard workflow:

```text
pnpm ops check-links
pnpm ops find-stale <days>
pnpm ops sync-runner
```

- `scripts/generate-rsvp-token.mjs`
- `scripts/optimize-assets.js`
- `scripts/optimize-event-images.mjs`
- `scripts/remove-env-from-history.sh`
- `scripts/rotate-credentials.sh`
- `scripts/rsvp-db-remote-runbook.ps1`
- `scripts/smoke-test.js`
- `scripts/sync-runner.sh`
- `scripts/test-email.ts`
- `scripts/validate-commits.cjs`
- `scripts/validate-schema.js`

**Temporary scripts marked for immediate removal:**

- `test_empty_body.js`
- `test_json_error.js`
- `test-error-mapper.js`

### Multi-Language Scripting Problem

There is currently a high mix of scripting languages, which impacts operations portability: Bash
(`.sh`), PowerShell (`.ps1`), JavaScript (`.js`, `.mjs`, `.cjs`), and TypeScript (`.ts`).
**Recommendation:** Unify all automation scripts using exclusively Node.js (preferably TypeScript or
ESM modules `.mjs`) to guarantee seamless cross-platform portability between Linux/macOS and Windows
environments.

## 2. Configuration and Security Audit (Phase 2)

### Environment Validation

There are discrepancies between `.env.example` and the core code validation in
`src/lib/env-validation.ts`. Variables defined in `.env.example` but NOT robustly validated at the
code level:

- `BASE_URL`, `TRUST_DEVICE_MAX_AGE_DAYS`
- `SUPER_ADMIN_EMAILS`, `RSVP_ADMIN_USER`, `RSVP_ADMIN_PASSWORD`
- `SENDGRID_API_KEY`, `SENTRY_AUTH_TOKEN`
- `ENABLE_MFA`, `ENABLE_AUDIT_LOGS`

### Configuration Hardening

- `tsconfig.json`: Properly protected with `"strict": true`. Excellent.
- `vercel.json`: Excellent security headers introduced to prevent web vulnerabilities (e.g.,
  `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Permissions-Policy`).
- `astro.config.mjs`: Clean configuration, server system adapters with good structure, no residual
  debugging flags.
- `package.json`: Maintains consistency in script categorization.

### Git Controls

- `.gitignore`: Well configured. Critical directories such as `logs/`, `.env*`, `dist/`, `.vercel/`,
  `.eslintcache`, and OS-generated hidden files (`.DS_Store`) are explicitly ignored. Solid leak
  prevention.
- `.husky/` hooks: Correct and pointing to standardized processes like `lint-staged` and
  `gatekeeper` with secret scanning to prevent password commits.

## 3. Robustness Analysis (Phase 3)

### `scripts/rotate-credentials.sh`

- **Fault tolerance:** Uses `set -e` to abort on unhandled failures and `exit 1` when receiving
  negative user input responses.
- **Dry-run mode:** Nonexistent. Mutates repositories or Vercel flows directly.
- **Documentation / Help:** Does not implement a `--help` CLI flag.

### `scripts/validate-schema.js`

- **Fault tolerance:** Catches errors globally via `.catch()` or `main()` try-block control,
  returning a clean state with standardized CI exit codes `process.exit(ERRORS.length > 0 ? 1 : 0)`.
- **Dry-run mode:** By nature it is a passive assertion script, acting as a dry-run by avoiding
  mutations.
- **Documentation / Help:** Maintains explanations throughout the code via comments, but does not
  implement `--help`.

### `.agent/governance/bin/gatekeeper.js`

- **Fault tolerance:** Highly advanced under try/catch and wrapper utilities. Terminates with an
  explicit `process.exit(1)`.
- **Dry-run mode:** The gatekeeper incorporates the ability to only query and parse harmlessly with
  JSON reports `--report-json --mode strict`.
- **Documentation / Help:** Extensive internal parameter fragments but no exposure of a classic
  `--help` in the terminal.
