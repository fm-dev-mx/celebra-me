/**
 * Shared pending-migration set comparison for hosted migrate runners.
 */

export function parseMigrationVersionList(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(/[,\s]+/)
		.map((version) => version.trim())
		.filter(Boolean);
}

/** Extract unique 14-digit migration versions from supabase dry-run output, first-seen order. */
export function extractPendingMigrationVersions(dryRunOutput: string): string[] {
	return [
		...new Set(
			Array.from(dryRunOutput.matchAll(/\b(\d{14})_/g)).map((match) => match[1] as string),
		),
	];
}

export type PendingSetComparison =
	{ ok: true; alreadyApplied: string[] } | { ok: false; errors: string[] };

/**
 * Compare the live pending set to an explicit --expected pin.
 *
 * Re-running the same pinned command after a successful apply is idempotent: expected versions that
 * are already recorded in the target's migration history are reported as `alreadyApplied` instead
 * of failing. A pending version outside the pin, or an expected version that is neither pending nor
 * applied, still fails closed. `none` pins an empty pending set.
 */
export function comparePendingSetToExpected(
	pendingVersions: readonly string[],
	expectedVersions: readonly string[],
	appliedVersions: readonly string[] = [],
): PendingSetComparison {
	const errors: string[] = [];
	const expectedSet = new Set(expectedVersions.filter((version) => version !== 'none'));
	const pendingSet = new Set(pendingVersions);
	const appliedSet = new Set(appliedVersions);
	const alreadyApplied: string[] = [];

	for (const version of pendingVersions) {
		if (!expectedSet.has(version)) {
			errors.push(`Dry-run pending migration "${version}" is not in the expected set.`);
		}
	}
	for (const version of expectedSet) {
		if (pendingSet.has(version)) continue;
		if (appliedSet.has(version)) {
			alreadyApplied.push(version);
			continue;
		}
		errors.push(
			`Expected migration "${version}" is neither pending in the dry-run nor recorded as applied.`,
		);
	}
	return errors.length === 0 ? { ok: true, alreadyApplied } : { ok: false, errors };
}
