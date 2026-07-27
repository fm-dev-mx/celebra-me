/**
 * branch-migration-parity.ts — Branch-to-branch migration identity & content compare.
 *
 * Read-only git + filesystem. No database connections.
 * Compares migration identity (14-digit version), duplicates, branch divergence,
 * and content hashes — not filename sort alone.
 *
 * Usage:
 *   tsx scripts/db/branch-migration-parity.ts --base <ref> --head <ref>
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
	detectDatabaseSensitiveChanges,
	type DatabaseSensitiveDetectionResult,
} from './database-sensitive-paths.ts';

export const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;
export const MIGRATIONS_TREE_PREFIX = 'supabase/migrations/';

export interface GitRunner {
	(args: string[]): { status: number; stdout: string; stderr: string };
}

export interface MigrationFileEntry {
	filename: string;
	version: string;
	contentHash: string;
}

export interface MigrationTreeParseResult {
	entries: MigrationFileEntry[];
	duplicates: Array<{ version: string; filenames: string[] }>;
	malformed: string[];
}

export interface BranchMigrationParityResult {
	baseRef: string;
	headRef: string;
	baseOnly: MigrationFileEntry[];
	headOnly: MigrationFileEntry[];
	contentMutations: Array<{
		version: string;
		baseFilename: string;
		headFilename: string;
		baseHash: string;
		headHash: string;
	}>;
	baseDuplicates: MigrationTreeParseResult['duplicates'];
	headDuplicates: MigrationTreeParseResult['duplicates'];
	baseMalformed: string[];
	headMalformed: string[];
	sensitiveDetection: DatabaseSensitiveDetectionResult;
	ok: boolean;
	errors: string[];
}

export function defaultGitRunner(args: string[]): {
	status: number;
	stdout: string;
	stderr: string;
} {
	const result = spawnSync('git', args, {
		cwd: process.cwd(),
		encoding: 'utf8',
	});
	if (result.error) {
		throw result.error;
	}
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

export function hashContent(content: string): string {
	return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function parseMigrationTree(
	files: ReadonlyArray<{ path: string; content: string }>,
): MigrationTreeParseResult {
	const byVersion = new Map<string, MigrationFileEntry[]>();
	const malformed: string[] = [];

	for (const file of files) {
		const normalized = file.path.replaceAll('\\', '/');
		const filename = normalized.includes('/')
			? normalized.slice(normalized.lastIndexOf('/') + 1)
			: normalized;
		const match = filename.match(MIGRATION_FILENAME_PATTERN);
		if (!match) {
			malformed.push(filename);
			continue;
		}
		const version = match[1]!;
		const entry: MigrationFileEntry = {
			filename,
			version,
			contentHash: hashContent(file.content),
		};
		const existing = byVersion.get(version) ?? [];
		existing.push(entry);
		byVersion.set(version, existing);
	}

	const duplicates: MigrationTreeParseResult['duplicates'] = [];
	const entries: MigrationFileEntry[] = [];
	for (const [version, group] of [...byVersion.entries()].sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	)) {
		if (group.length > 1) {
			duplicates.push({
				version,
				filenames: group.map((g) => g.filename).sort(),
			});
		}
		// Keep first by filename for comparison when duplicates exist; duplicates are errors.
		entries.push([...group].sort((a, b) => a.filename.localeCompare(b.filename))[0]!);
	}

	return { entries, duplicates, malformed };
}

export function listChangedFilesBetweenRefs(
	baseRef: string,
	headRef: string,
	git: GitRunner = defaultGitRunner,
): string[] {
	const result = git(['diff', '--name-only', '--diff-filter=ACMR', baseRef, headRef]);
	if (result.status !== 0) {
		throw new Error(
			`git diff --name-only failed for ${baseRef}..${headRef}:\n${result.stderr || result.stdout}`,
		);
	}
	return result.stdout
		.split(/\r?\n/u)
		.map((line) => line.trim().replaceAll('\\', '/'))
		.filter(Boolean);
}

export function listMigrationFilesAtRef(
	ref: string,
	git: GitRunner = defaultGitRunner,
): Array<{ path: string; content: string }> {
	const ls = git(['ls-tree', '-r', '--name-only', ref, '--', 'supabase/migrations']);
	if (ls.status !== 0) {
		throw new Error(
			`git ls-tree failed for ${ref} supabase/migrations:\n${ls.stderr || ls.stdout}`,
		);
	}
	const paths = ls.stdout
		.split(/\r?\n/u)
		.map((line) => line.trim().replaceAll('\\', '/'))
		.filter((p) => p.startsWith(MIGRATIONS_TREE_PREFIX) && p.endsWith('.sql'));

	const files: Array<{ path: string; content: string }> = [];
	for (const path of paths) {
		const show = git(['show', `${ref}:${path}`]);
		if (show.status !== 0) {
			throw new Error(`git show failed for ${ref}:${path}:\n${show.stderr || show.stdout}`);
		}
		files.push({ path, content: show.stdout });
	}
	return files;
}

export function compareMigrationTrees(
	base: MigrationTreeParseResult,
	head: MigrationTreeParseResult,
): Pick<
	BranchMigrationParityResult,
	'baseOnly' | 'headOnly' | 'contentMutations' | 'errors' | 'ok'
> {
	const errors: string[] = [];
	const baseByVersion = new Map(base.entries.map((e) => [e.version, e]));
	const headByVersion = new Map(head.entries.map((e) => [e.version, e]));

	const baseOnly: MigrationFileEntry[] = [];
	const headOnly: MigrationFileEntry[] = [];
	const contentMutations: BranchMigrationParityResult['contentMutations'] = [];

	for (const [version, entry] of baseByVersion) {
		const headEntry = headByVersion.get(version);
		if (!headEntry) {
			baseOnly.push(entry);
			continue;
		}
		if (entry.contentHash !== headEntry.contentHash) {
			contentMutations.push({
				version,
				baseFilename: entry.filename,
				headFilename: headEntry.filename,
				baseHash: entry.contentHash,
				headHash: headEntry.contentHash,
			});
			errors.push(
				`Migration version ${version} content differs between refs (${entry.filename} vs ${headEntry.filename})`,
			);
		}
	}

	for (const [version, entry] of headByVersion) {
		if (!baseByVersion.has(version)) {
			headOnly.push(entry);
		}
	}

	const ok =
		errors.length === 0 &&
		base.malformed.length === 0 &&
		head.malformed.length === 0 &&
		base.duplicates.length === 0 &&
		head.duplicates.length === 0 &&
		contentMutations.length === 0;

	return { baseOnly, headOnly, contentMutations, errors, ok };
}

export function runBranchMigrationParity(options: {
	baseRef: string;
	headRef: string;
	git?: GitRunner;
}): BranchMigrationParityResult {
	const git = options.git ?? defaultGitRunner;
	const { baseRef, headRef } = options;

	const changedFiles = listChangedFilesBetweenRefs(baseRef, headRef, git);
	const sensitiveDetection = detectDatabaseSensitiveChanges(changedFiles);

	const baseTree = parseMigrationTree(listMigrationFilesAtRef(baseRef, git));
	const headTree = parseMigrationTree(listMigrationFilesAtRef(headRef, git));
	const compared = compareMigrationTrees(baseTree, headTree);

	// Sensitive paths are informational for the gate; migration identity failures are hard errors.
	// The CLI exits non-zero when migration identity/content checks fail OR when caller
	// requests fail-on-sensitive (branch-lane treats sensitive as a stop regardless).

	return {
		baseRef,
		headRef,
		baseOnly: compared.baseOnly,
		headOnly: compared.headOnly,
		contentMutations: compared.contentMutations,
		baseDuplicates: baseTree.duplicates,
		headDuplicates: headTree.duplicates,
		baseMalformed: baseTree.malformed,
		headMalformed: headTree.malformed,
		sensitiveDetection,
		ok: compared.ok,
		errors: compared.errors,
	};
}

export function formatBranchMigrationParityReport(result: BranchMigrationParityResult): string {
	const lines: string[] = [];
	lines.push('============================================================');
	lines.push('Branch Migration Parity');
	lines.push(`Base: ${result.baseRef}`);
	lines.push(`Head: ${result.headRef}`);
	lines.push('============================================================');
	lines.push('');
	lines.push('--- Database-sensitive path detection ---');
	lines.push(`Compared files: ${result.sensitiveDetection.totalCompared}`);
	lines.push(`Sensitive: ${result.sensitiveDetection.sensitive ? 'YES' : 'no'}`);
	if (result.sensitiveDetection.files.length > 0) {
		for (const file of result.sensitiveDetection.files) {
			lines.push(`  - ${file}`);
		}
	}
	lines.push('');
	lines.push('--- Migration identity / content ---');
	lines.push(`Head-only versions: ${result.headOnly.length}`);
	for (const entry of result.headOnly) {
		lines.push(`  + ${entry.filename} (${entry.contentHash.slice(0, 12)}…)`);
	}
	lines.push(`Base-only versions: ${result.baseOnly.length}`);
	for (const entry of result.baseOnly) {
		lines.push(`  - ${entry.filename} (${entry.contentHash.slice(0, 12)}…)`);
	}
	lines.push(`Content mutations: ${result.contentMutations.length}`);
	for (const mutation of result.contentMutations) {
		lines.push(
			`  !~ ${mutation.version}: ${mutation.baseFilename} (${mutation.baseHash.slice(0, 12)}…) → ${mutation.headFilename} (${mutation.headHash.slice(0, 12)}…)`,
		);
	}
	if (result.baseDuplicates.length > 0 || result.headDuplicates.length > 0) {
		lines.push('Duplicates:');
		for (const dup of result.baseDuplicates) {
			lines.push(`  base ${dup.version}: ${dup.filenames.join(', ')}`);
		}
		for (const dup of result.headDuplicates) {
			lines.push(`  head ${dup.version}: ${dup.filenames.join(', ')}`);
		}
	}
	if (result.baseMalformed.length > 0 || result.headMalformed.length > 0) {
		lines.push('Malformed:');
		for (const name of result.baseMalformed) {
			lines.push(`  base: ${name}`);
		}
		for (const name of result.headMalformed) {
			lines.push(`  head: ${name}`);
		}
	}
	if (result.errors.length > 0) {
		lines.push('');
		lines.push('Errors:');
		for (const error of result.errors) {
			lines.push(`  - ${error}`);
		}
	}
	lines.push('');
	lines.push(
		result.ok
			? '✅ Migration identity/content checks passed.'
			: '❌ Migration identity/content checks failed.',
	);
	if (result.sensitiveDetection.sensitive) {
		lines.push(
			'⛔ Database-sensitive changes detected — run database-parity before remote integration/promotion.',
		);
	}
	return lines.join('\n');
}

function parseArgs(argv: string[]): { baseRef?: string; headRef?: string; help: boolean } {
	let baseRef: string | undefined;
	let headRef: string | undefined;
	let help = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			help = true;
		} else if (arg === '--base') {
			baseRef = argv[++i];
		} else if (arg === '--head') {
			headRef = argv[++i];
		}
	}
	return { baseRef, headRef, help };
}

export function main(argv = process.argv.slice(2), git: GitRunner = defaultGitRunner): number {
	const { baseRef, headRef, help } = parseArgs(argv);
	if (help || !baseRef || !headRef) {
		console.log(
			'Usage: tsx scripts/db/branch-migration-parity.ts --base <ref> --head <ref>\n' +
				'Read-only. Compares migration identity/content and detects database-sensitive path changes.\n' +
				'Exit 1 when migration identity/content checks fail OR database-sensitive paths are present.',
		);
		return help ? 0 : 1;
	}

	try {
		const result = runBranchMigrationParity({ baseRef, headRef, git });
		console.log(formatBranchMigrationParityReport(result));
		// Fail closed for branch-lane: sensitive paths OR migration identity failures.
		if (!result.ok || result.sensitiveDetection.sensitive) {
			return 1;
		}
		return 0;
	} catch (err) {
		console.error('Fatal branch migration parity error:', err instanceof Error ? err.message : String(err));
		return 1;
	}
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('branch-migration-parity.ts')) {
	process.exit(main());
}
