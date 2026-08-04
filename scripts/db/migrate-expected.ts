/**
 * Shared --expected constraint parser for all migrate targets.
 * Deprecated --allowlist / EXPECTED_MIGRATIONS are Preview-only transition shims.
 */

import { parseMigrationVersionList } from './migration-pending-set.ts';

export interface ExpectedConstraintParseResult {
	/** Canonical pin, or null when unconstrained. */
	expectedPin: string[] | null;
	/** Human-readable deprecation warnings (stderr). */
	deprecationWarnings: string[];
}

export interface ParseExpectedConstraintOptions {
	/**
	 * When true, accept deprecated `--allowlist` and `EXPECTED_MIGRATIONS`.
	 * Preview transition only — Production/Local/Disposable must stay false.
	 */
	allowDeprecatedAliases?: boolean;
}

/**
 * Parse expected subset constraint from argv + env.
 * Single parser for all environments — no per-target duplicate logic.
 */
export function parseExpectedConstraint(
	argv: readonly string[],
	env: NodeJS.ProcessEnv = process.env,
	options: ParseExpectedConstraintOptions = {},
): ExpectedConstraintParseResult {
	const allowDeprecated = options.allowDeprecatedAliases === true;
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
		if (!allowDeprecated) {
			throw new Error(
				'Unsupported flag --allowlist. Use --expected <comma-separated-versions>. ' +
					'(Deprecated --allowlist remains Preview-only during the transition window.)',
			);
		}
		const allowlistRaw = argv[allowlistIdx + 1];
		if (!allowlistRaw || allowlistRaw.startsWith('-')) {
			throw new Error(
				'Missing value for deprecated --allowlist <comma-separated-versions>. Use --expected.',
			);
		}
		warnings.push(
			'DEPRECATED: --allowlist is a Preview-only alias of --expected and will be removed after the transition window (no remaining scripts/docs callers). Use --expected <versions>.',
		);
		if (raw !== undefined && raw !== allowlistRaw) {
			throw new Error('Conflicting --expected and --allowlist values. Use only --expected.');
		}
		raw = raw ?? allowlistRaw;
	}

	if (raw === undefined && env.EXPECTED_MIGRATIONS?.trim()) {
		if (!allowDeprecated) {
			throw new Error(
				'Unsupported EXPECTED_MIGRATIONS. Pass --expected <comma-separated-versions>. ' +
					'(EXPECTED_MIGRATIONS remains Preview-only during the transition window.)',
			);
		}
		warnings.push(
			'DEPRECATED: EXPECTED_MIGRATIONS is a Preview-only alias of --expected and will be removed after the transition window (no remaining scripts/docs callers). Pass --expected <versions>.',
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
