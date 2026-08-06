/**
 * Shared --expected constraint parser for all migrate targets.
 */

import { parseMigrationVersionList } from './migration-pending-set.ts';

export interface ExpectedConstraintParseResult {
	/** Canonical pin, or null when unconstrained. */
	expectedPin: string[] | null;
	/** Reserved for transitional warnings (currently unused). */
	deprecationWarnings: string[];
}

/**
 * Parse expected subset constraint from argv.
 * Single parser for all environments — no per-target duplicate logic.
 */
export function parseExpectedConstraint(
	argv: readonly string[],
	env: NodeJS.ProcessEnv = process.env,
): ExpectedConstraintParseResult {
	const expectedIdx = argv.indexOf('--expected');
	if (argv.includes('--allowlist')) {
		throw new Error('Unsupported flag --allowlist. Use --expected <comma-separated-versions>.');
	}
	if (env.EXPECTED_MIGRATIONS?.trim()) {
		throw new Error(
			'Unsupported EXPECTED_MIGRATIONS. Pass --expected <comma-separated-versions>.',
		);
	}

	if (expectedIdx === -1) {
		return { expectedPin: null, deprecationWarnings: [] };
	}

	const raw = argv[expectedIdx + 1];
	if (!raw || raw.startsWith('-')) {
		throw new Error('Missing value for --expected <comma-separated-versions>.');
	}

	const versions = parseMigrationVersionList(raw);
	if (versions.length === 0) {
		throw new Error('Expected migrations list is empty.');
	}
	return { expectedPin: versions, deprecationWarnings: [] };
}
