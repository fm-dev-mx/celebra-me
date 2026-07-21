#!/usr/bin/env node
/**
 * romina-invitation-cli.ts — Deprecated Romina CLI wrapper.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DEPRECATED — Use pnpm invitation:apply:local instead via:
 *   pnpm invitation:apply:local -- --slug romina-rios-chaparro --source-dir <PATH> [--apply]
 * ═══════════════════════════════════════════════════════════════════════
 */

import { main, redactSecrets } from './romina-invitation.ts';

console.warn(
	'\x1b[33m[DEPRECATION NOTICE] invitation:prod:provision is deprecated. Use pnpm invitation:apply:local -- --slug romina-rios-chaparro instead.\x1b[0m',
);

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`\x1b[31mFatal error:\x1b[0m ${redactSecrets(message)}`);
	process.exit(1);
});
