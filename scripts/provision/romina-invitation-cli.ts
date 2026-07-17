#!/usr/bin/env node
/**
 * romina-invitation-cli.ts — CLI entrypoint for the Romina provisioner.
 *
 * This file is the package-script target (invitation:prod:provision).
 * It unconditionally calls main() and handles errors with redacted output
 * and non-zero exit codes.
 *
 * The implementation lives in romina-invitation.ts and is importable
 * without triggering any side effects.
 */

import { main, redactSecrets } from './romina-invitation.js';

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[31mFatal error:\x1b[0m ${redactSecrets(message)}`);
  process.exit(1);
});
