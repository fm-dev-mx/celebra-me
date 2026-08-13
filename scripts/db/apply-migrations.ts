/**
 * Shared migration file helpers and guarded psql execution for disposable-test
 * and persistent-local. Not a public apply CLI.
 *
 * Canonical apply: `pnpm db:migrate -- --target <disposable-test|local|preview|production>`.
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyDbTarget, redactDbUrl } from './db-target-config.ts';
import { runPsql } from './db-workflow-lib.ts';

export const PROJECT_ROOT = process.cwd();
export const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');
const SAFE_FILENAME_PATTERN = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;

export function runPsqlCommand(dbUrl: string, sqlInput: string): { ok: boolean; output: string } {
	const classification = classifyDbTarget(dbUrl);
	if (
		classification.target === 'production' ||
		classification.target === 'preview' ||
		classification.target === 'unknown'
	) {
		return {
			ok: false,
			output: `ERROR: apply-migrations psql runner cannot target ${classification.target}. Use \`pnpm db:migrate -- --target <local|preview|production|disposable-test>\`.`,
		};
	}
	const result = runPsql(sqlInput, dbUrl, {
		throwOnError: false,
		tuplesOnly: false,
		redact: [dbUrl],
	});
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';
	return {
		ok: result.status === 0,
		output: (stdout + stderr).trim(),
	};
}

export function runPsqlFileCommand(
	dbUrl: string,
	filePath: string,
): { ok: boolean; output: string } {
	const classification = classifyDbTarget(dbUrl);
	if (
		classification.target === 'production' ||
		classification.target === 'preview' ||
		classification.target === 'unknown'
	) {
		return {
			ok: false,
			output: `ERROR: apply-migrations psql runner cannot target ${classification.target}. Use \`pnpm db:migrate -- --target <local|preview|production|disposable-test>\`.`,
		};
	}
	const result = runPsql(filePath, dbUrl, {
		throwOnError: false,
		tuplesOnly: false,
		isFile: true,
		redact: [dbUrl],
	});
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';
	return {
		ok: result.status === 0,
		output: (stdout + stderr).trim(),
	};
}

type ValidatedMigrationFile = { filename: string; version: string; name: string };

let validatedMigrationFilesCache: {
	files: ValidatedMigrationFile[];
	seenVersions: Map<string, string>;
} | null = null;

function loadValidatedMigrationFiles(): {
	files: ValidatedMigrationFile[];
	seenVersions: Map<string, string>;
} {
	if (validatedMigrationFilesCache) return validatedMigrationFilesCache;
	if (!existsSync(MIGRATIONS_DIR)) {
		console.error(`ERROR: Migrations directory not found: ${MIGRATIONS_DIR}`);
		process.exit(1);
	}

	const allEntries = readdirSync(MIGRATIONS_DIR);
	const seenVersions = new Map<string, string>();
	const validFiles: ValidatedMigrationFile[] = [];

	for (const entry of allEntries) {
		if (entry.startsWith('.')) continue;

		const match = entry.match(SAFE_FILENAME_PATTERN);
		if (!match) {
			console.error(
				`ERROR: Malformed migration filename or non-conforming file found: "${entry}".`,
			);
			console.error(
				`All migration files must strictly follow the format: <14-digit-timestamp>_<name>.sql`,
			);
			process.exit(1);
		}

		const version = match[1]!;
		const name = match[2]!;

		if (seenVersions.has(version)) {
			console.error(`ERROR: Duplicate migration version timestamp "${version}" found in:`);
			console.error(`  - ${seenVersions.get(version)}`);
			console.error(`  - ${entry}`);
			console.error(`Ambiguous ordering detected.`);
			process.exit(1);
		}

		seenVersions.set(version, entry);
		validFiles.push({ filename: entry, version, name });
	}

	validFiles.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
	validatedMigrationFilesCache = { files: validFiles, seenVersions };
	return validatedMigrationFilesCache;
}

export function getValidatedMigrationFiles(maxVersion?: string): ValidatedMigrationFile[] {
	const { files, seenVersions } = loadValidatedMigrationFiles();

	if (maxVersion) {
		if (!/^\d{14}$/.test(maxVersion)) {
			console.error(
				`ERROR: Requested max version cutoff "${maxVersion}" is malformed. Must be a 14-digit timestamp.`,
			);
			process.exit(1);
		}
		if (!seenVersions.has(maxVersion)) {
			console.error(
				`ERROR: Requested baseline cutoff version "${maxVersion}" is not a known migration timestamp in the repository.`,
			);
			process.exit(1);
		}
		return files.filter((f) => f.version <= maxVersion);
	}

	return [...files];
}

export function enforceDisposableTargetOnly(dbUrl: string): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'disposable-test') {
		console.error(
			`ERROR: apply-migrations helpers are strictly restricted to the disposable-test environment when enforceDisposableTargetOnly is used.`,
		);
		console.error(
			`Target evaluated as "${classification.target}" for ${redactDbUrl(dbUrl)}. Operation blocked.`,
		);
		process.exit(1);
	}
}
