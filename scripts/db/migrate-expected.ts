/**
 * Shared --expected constraint parser for all migrate targets.
 * Preview temporarily accepts --allowlist / EXPECTED_MIGRATIONS with a deprecation warning.
 */

import { parseMigrationVersionList } from './migration-pending-set.ts';

export interface ExpectedConstraintParseResult {
	/** Canonical pin, or null when unconstrained. */
	expectedPin: string[] | null;
	/** Human-readable deprecation warnings (stderr). */
	deprecationWarnings: string[];
}

/**
 * Parse expected-set constraint from argv + env.
 * Single parser for all environments — no per-target duplicate logic.
 */
export function parseExpectedConstraint(
	argv: readonly string[],
	env: NodeJS.ProcessEnv = process.env,
): ExpectedConstraintParseResult {
	const warnings: string[] = [];
	const expectedIdx = argv.indexOf('--expected');
	const allowlistIdx = argv.indexOf('--allowlist');

	let raw: string | undefined;
	if (expectedIdx !== -1) {
		raw = argv[expectedIdx + 1];
		if (!raw || raw.startsWith('-')) {
			throw new Error('Missing value for --expected <comma-separated-versions>.');
		}
	}

	if (allowlistIdx !== -1) {
		const allowlistRaw = argv[allowlistIdx + 1];
		if (!allowlistRaw || allowlistRaw.startsWith('-')) {
			throw new Error(
				'Missing value for deprecated --allowlist <comma-separated-versions>. Use --expected.',
			);
		}
		warnings.push(
			'DEPRECATED: --allowlist is an alias of --expected and will be removed. Use --expected <versions>.',
		);
		if (raw !== undefined && raw !== allowlistRaw) {
			throw new Error('Conflicting --expected and --allowlist values. Use only --expected.');
		}
		raw = raw ?? allowlistRaw;
	}

	if (raw === undefined && env.EXPECTED_MIGRATIONS?.trim()) {
		warnings.push(
			'DEPRECATED: EXPECTED_MIGRATIONS is an alias of --expected and will be removed. Pass --expected <versions>.',
		);
		raw = env.EXPECTED_MIGRATIONS.trim();
	}

	if (raw === undefined) {
		return { expectedPin: null, deprecationWarnings: warnings };
	}

	const versions = parseMigrationVersionList(raw);
	if (versions.length === 0) {
		throw new Error('Expected migrations list is empty.');
	}
	return { expectedPin: versions, deprecationWarnings: warnings };
}
