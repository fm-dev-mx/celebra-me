/**
 * database-sensitive-paths.ts — Deterministic path classifier for branch-lane handoff.
 *
 * Classifies changed paths as database-sensitive so /branch-lane can stop before
 * integration/promotion and hand off to the database-parity skill.
 *
 * Read-only. No database connections. Does not own migration or audit semantics.
 */

export const DATABASE_SENSITIVE_PREFIXES = [
	'supabase/migrations/',
	'supabase/test/',
	'supabase/tests/',
	'supabase/verification/',
	'scripts/db/',
	'scripts/manual/production-patches/',
	'scripts/sql/',
	'docs/domains/database/',
] as const;

export const DATABASE_SENSITIVE_EXACT_PATHS = new Set([
	'supabase/config.toml',
	'docs/database-workflow.md',
	'.agent/rules/database.md',
	'.agent/rules/manual-sql-manifest.md',
]);

/** Normalize to forward-slash repo-relative paths. */
export function normalizeRepoPath(filePath: string): string {
	return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

/**
 * Returns true when a path is database-sensitive for branch-lane gating.
 * App runtime / content Zod under `src/**` is intentionally excluded.
 */
export function isDatabaseSensitivePath(filePath: string): boolean {
	const normalized = normalizeRepoPath(filePath);
	if (!normalized || normalized.startsWith('src/')) {
		return false;
	}
	if (DATABASE_SENSITIVE_EXACT_PATHS.has(normalized)) {
		return true;
	}
	return DATABASE_SENSITIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function filterDatabaseSensitivePaths(filePaths: readonly string[]): string[] {
	const hits = new Set<string>();
	for (const filePath of filePaths) {
		if (isDatabaseSensitivePath(filePath)) {
			hits.add(normalizeRepoPath(filePath));
		}
	}
	return [...hits].sort();
}

export interface DatabaseSensitiveDetectionResult {
	sensitive: boolean;
	files: string[];
	totalCompared: number;
}

export function detectDatabaseSensitiveChanges(
	filePaths: readonly string[],
): DatabaseSensitiveDetectionResult {
	const files = filterDatabaseSensitivePaths(filePaths);
	return {
		sensitive: files.length > 0,
		files,
		totalCompared: filePaths.length,
	};
}
