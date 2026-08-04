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

export function comparePendingSetToExpected(
	pendingVersions: readonly string[],
	expectedVersions: readonly string[],
): { ok: true } | { ok: false; errors: string[] } {
	const errors: string[] = [];
	const expectedSet = new Set(expectedVersions);
	const pendingSet = new Set(pendingVersions);

	if (pendingVersions.length === 0) {
		if (expectedVersions.length > 0 && expectedVersions[0] !== 'none') {
			errors.push(
				`Expected migrations to apply: ${expectedVersions.join(', ')}, but dry-run shows 0 migrations.`,
			);
		}
		return errors.length === 0 ? { ok: true } : { ok: false, errors };
	}

	for (const version of expectedVersions) {
		if (!pendingSet.has(version)) {
			errors.push(`Expected migration "${version}" is not in the dry-run pending set.`);
		}
	}
	for (const version of pendingVersions) {
		if (!expectedSet.has(version)) {
			errors.push(`Dry-run pending migration "${version}" is not in the expected set.`);
		}
	}
	return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
