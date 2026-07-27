/**
 * branch-migration-parity.ts — Branch-to-branch migration identity & content compare.
 *
 * Read-only git + filesystem. No database connections.
 * Compares migration identity (14-digit version), duplicates, branch divergence,
 * and content hashes — not filename sort alone.
 *
 * Usage:
 *   tsx scripts/db/branch-migration-parity.ts --base <ref> --head <ref> [--json]
 *
 * Exit codes:
 *   0 — analysis completed and result is trustworthy (even if requiresParityAudit)
 *   1 — invalid input, technical failure, or identity violation that prevents trust
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
	detectDatabaseSensitiveChanges,
	type DatabaseSensitiveDetectionResult,
} from './database-sensitive-paths.ts';
import { createFinding, type Finding } from './branch-lane-status.ts';

export const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;
export const MIGRATIONS_TREE_PREFIX = 'supabase/migrations/';

export interface GitRunner {
	(args: string[]): { status: number; stdout: string; stderr: string };
}

export interface MigrationFileEntry {
	filename: string;
	version: string;
	name: string;
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
	/** True when migration identity/content checks pass (duplicates/malformed/mutations absent). */
	identityOk: boolean;
	/** @deprecated use identityOk — kept for older call sites */
	ok: boolean;
	errors: string[];
	findings: Finding[];
	requiresParityAudit: boolean;
}

/** Machine-readable contract for orchestrators and tests. */
export interface BranchParityJsonResult {
	identityStatus: 'pass' | 'fail';
	sensitiveChanges: boolean;
	sensitiveFiles: string[];
	findings: Finding[];
	requiresParityAudit: boolean;
	baseRef: string;
	headRef: string;
	headOnlyVersions: string[];
	baseOnlyVersions: string[];
	contentMutations: string[];
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
		const name = match[2]!;
		const entry: MigrationFileEntry = {
			filename,
			version,
			name,
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
	'baseOnly' | 'headOnly' | 'contentMutations' | 'errors' | 'identityOk' | 'findings'
> {
	const errors: string[] = [];
	const findings: Finding[] = [];
	const baseByVersion = new Map(base.entries.map((e) => [e.version, e]));
	const headByVersion = new Map(head.entries.map((e) => [e.version, e]));

	if (base.malformed.length > 0) {
		const msg = `Base has malformed migration filename(s): ${base.malformed.join(', ')}`;
		errors.push(msg);
		findings.push(
			createFinding({
				id: 'migration-malformed-base',
				status: 'Hard blocked',
				cause: msg,
				impact: 'Migration ordering is untrustworthy.',
				owner: 'human',
				remediation: 'Rename to <14-digit-timestamp>_<name>.sql and re-run parity.',
				nextStep: 'Fix malformed filenames on base, then resume branch-lane.',
				paths: base.malformed.map((f) => `supabase/migrations/${f}`),
			}),
		);
	}
	if (head.malformed.length > 0) {
		const msg = `Head has malformed migration filename(s): ${head.malformed.join(', ')}`;
		errors.push(msg);
		findings.push(
			createFinding({
				id: 'migration-malformed-head',
				status: 'Hard blocked',
				cause: msg,
				impact: 'Migration ordering is untrustworthy.',
				owner: 'human',
				remediation: 'Rename to <14-digit-timestamp>_<name>.sql and re-run parity.',
				nextStep: 'Fix malformed filenames on head, then resume branch-lane.',
				paths: head.malformed.map((f) => `supabase/migrations/${f}`),
			}),
		);
	}
	if (base.duplicates.length > 0) {
		const msg = `Base has duplicate migration version(s): ${base.duplicates
			.map((d) => `${d.version} (${d.filenames.join(', ')})`)
			.join('; ')}`;
		errors.push(msg);
		findings.push(
			createFinding({
				id: 'migration-duplicate-base',
				status: 'Hard blocked',
				cause: msg,
				impact: 'Ambiguous migration ordering.',
				owner: 'human',
				remediation: 'Remove or renumber duplicate versions on base.',
				nextStep: 'Resolve duplicates, then resume branch-lane.',
			}),
		);
	}
	if (head.duplicates.length > 0) {
		const msg = `Head has duplicate migration version(s): ${head.duplicates
			.map((d) => `${d.version} (${d.filenames.join(', ')})`)
			.join('; ')}`;
		errors.push(msg);
		findings.push(
			createFinding({
				id: 'migration-duplicate-head',
				status: 'Hard blocked',
				cause: msg,
				impact: 'Ambiguous migration ordering.',
				owner: 'human',
				remediation: 'Remove or renumber duplicate versions on head.',
				nextStep: 'Resolve duplicates, then resume branch-lane.',
			}),
		);
	}

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
			const msg = `Migration version ${version} content differs between refs (${entry.filename} vs ${headEntry.filename})`;
			errors.push(msg);
			findings.push(
				createFinding({
					id: `migration-content-mutation-${version}`,
					status: 'Hard blocked',
					cause: msg,
					impact: 'Applied migration content must not change; accepting this exception is forbidden.',
					owner: 'human',
					remediation:
						'Restore the original migration file content and add a new corrective migration.',
					nextStep:
						'Restore original file, add corrective migration, resume branch-lane.',
					paths: [
						`supabase/migrations/${entry.filename}`,
						`supabase/migrations/${headEntry.filename}`,
					],
				}),
			);
		}
	}

	for (const [version, entry] of headByVersion) {
		if (!baseByVersion.has(version)) {
			headOnly.push(entry);
		}
	}

	if (baseOnly.length > 0) {
		findings.push(
			createFinding({
				id: 'migration-base-only',
				status: 'Needs decision',
				cause: `Base-only migration version(s): ${baseOnly.map((e) => e.version).join(', ')}`,
				impact: 'Branch migration histories diverge; investigate before promote/sync.',
				owner: 'human',
				remediation: 'Confirm intentional divergence or restore missing files on head.',
				nextStep: 'Disposition base-only versions during database-parity.',
				paths: baseOnly.map((e) => `supabase/migrations/${e.filename}`),
			}),
		);
	}

	if (headOnly.length > 0) {
		findings.push(
			createFinding({
				id: 'migration-head-only',
				status: 'Pass',
				severity: 'info',
				cause: `Head-only migration version(s): ${headOnly.map((e) => e.version).join(', ')}`,
				impact: 'New migrations relative to base; database-parity must validate remotes.',
				owner: 'agent',
				remediation: 'Continue with database-parity remote audits before promote.',
				nextStep: 'Run database-parity checklist.',
				paths: headOnly.map((e) => `supabase/migrations/${e.filename}`),
			}),
		);
	}

	const identityOk =
		base.malformed.length === 0 &&
		head.malformed.length === 0 &&
		base.duplicates.length === 0 &&
		head.duplicates.length === 0 &&
		contentMutations.length === 0;

	return { baseOnly, headOnly, contentMutations, errors, identityOk, findings };
}

export function toBranchParityJson(result: BranchMigrationParityResult): BranchParityJsonResult {
	return {
		identityStatus: result.identityOk ? 'pass' : 'fail',
		sensitiveChanges: result.sensitiveDetection.sensitive,
		sensitiveFiles: result.sensitiveDetection.files,
		findings: result.findings,
		requiresParityAudit: result.requiresParityAudit,
		baseRef: result.baseRef,
		headRef: result.headRef,
		headOnlyVersions: result.headOnly.map((e) => e.version),
		baseOnlyVersions: result.baseOnly.map((e) => e.version),
		contentMutations: result.contentMutations.map((m) => m.version),
	};
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

	const findings = [...compared.findings];
	if (sensitiveDetection.sensitive) {
		findings.push(
			createFinding({
				id: 'database-sensitive-paths',
				status: 'Pass',
				severity: 'info',
				cause: `Database-sensitive path changes detected (${sensitiveDetection.files.length}).`,
				impact: 'branch-lane must automatically invoke database-parity before Git writes.',
				owner: 'agent',
				remediation: 'Continue into database-parity; do not treat as CLI failure.',
				nextStep: 'Invoke database-parity with this range.',
				paths: sensitiveDetection.files,
			}),
		);
	}

	const requiresParityAudit =
		sensitiveDetection.sensitive ||
		!compared.identityOk ||
		compared.headOnly.length > 0 ||
		compared.baseOnly.length > 0;

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
		identityOk: compared.identityOk,
		ok: compared.identityOk,
		errors: compared.errors,
		findings,
		requiresParityAudit,
	};
}

function appendNamedList(lines: string[], label: string, values: string[], prefix: string): void {
	if (values.length === 0) return;
	lines.push(label);
	for (const value of values) {
		lines.push(`  ${prefix}${value}`);
	}
}

function formatSensitiveSection(result: BranchMigrationParityResult): string[] {
	const lines = [
		'--- Database-sensitive path detection ---',
		`Compared files: ${result.sensitiveDetection.totalCompared}`,
		`Sensitive: ${result.sensitiveDetection.sensitive ? 'YES' : 'no'}`,
	];
	for (const file of result.sensitiveDetection.files) {
		lines.push(`  - ${file}`);
	}
	return lines;
}

function formatIdentitySection(result: BranchMigrationParityResult): string[] {
	const lines = [
		'--- Migration identity / content ---',
		`Head-only versions: ${result.headOnly.length}`,
	];
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
	appendNamedList(
		lines,
		'Duplicates:',
		[
			...result.baseDuplicates.map((d) => `base ${d.version}: ${d.filenames.join(', ')}`),
			...result.headDuplicates.map((d) => `head ${d.version}: ${d.filenames.join(', ')}`),
		],
		'',
	);
	appendNamedList(
		lines,
		'Malformed:',
		[
			...result.baseMalformed.map((name) => `base: ${name}`),
			...result.headMalformed.map((name) => `head: ${name}`),
		],
		'',
	);
	return lines;
}

export function formatBranchMigrationParityReport(result: BranchMigrationParityResult): string {
	const lines: string[] = [
		'============================================================',
		'Branch Migration Parity',
		`Base: ${result.baseRef}`,
		`Head: ${result.headRef}`,
		`identityStatus: ${result.identityOk ? 'pass' : 'fail'}`,
		`sensitiveChanges: ${result.sensitiveDetection.sensitive}`,
		`requiresParityAudit: ${result.requiresParityAudit}`,
		'============================================================',
		'',
		...formatSensitiveSection(result),
		'',
		...formatIdentitySection(result),
	];
	if (result.findings.length > 0) {
		lines.push('');
		lines.push('Findings:');
		for (const finding of result.findings) {
			lines.push(`  [${finding.status}] ${finding.id}: ${finding.cause}`);
		}
	}
	lines.push('');
	lines.push(
		result.identityOk
			? 'Migration identity/content: Pass'
			: 'Migration identity/content: Hard blocked / Fail — result not fully trustworthy for promotion.',
	);
	if (result.requiresParityAudit && result.identityOk) {
		lines.push(
			'Parity routing required — invoke database-parity (not a CLI execution failure).',
		);
	}
	return lines.join('\n');
}

function parseArgs(argv: string[]): {
	baseRef?: string;
	headRef?: string;
	help: boolean;
	json: boolean;
} {
	let baseRef: string | undefined;
	let headRef: string | undefined;
	let help = false;
	let json = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			help = true;
		} else if (arg === '--json') {
			json = true;
		} else if (arg === '--base') {
			baseRef = argv[++i];
		} else if (arg === '--head') {
			headRef = argv[++i];
		}
	}
	return { baseRef, headRef, help, json };
}

export function main(argv = process.argv.slice(2), git: GitRunner = defaultGitRunner): number {
	const { baseRef, headRef, help, json } = parseArgs(argv);
	if (help || !baseRef || !headRef) {
		const usage =
			'Usage: tsx scripts/db/branch-migration-parity.ts --base <ref> --head <ref> [--json]\n' +
			'Read-only. Compares migration identity/content and detects database-sensitive path changes.\n' +
			'Exit 0: analysis trustworthy (requiresParityAudit may still be true).\n' +
			'Exit 1: invalid input, technical failure, or identity violation.';
		if (json && !help) {
			console.log(
				JSON.stringify({
					identityStatus: 'fail',
					sensitiveChanges: false,
					sensitiveFiles: [],
					findings: [
						createFinding({
							id: 'cli-invalid-args',
							status: 'Fail',
							cause: 'Missing --base and/or --head.',
							impact: 'Cannot produce a trustworthy parity result.',
							owner: 'agent',
							remediation: 'Pass --base <ref> --head <ref>.',
							nextStep: 'Re-run with required flags.',
						}),
					],
					requiresParityAudit: false,
					baseRef: baseRef ?? '',
					headRef: headRef ?? '',
					headOnlyVersions: [],
					baseOnlyVersions: [],
					contentMutations: [],
				} satisfies BranchParityJsonResult),
			);
		} else {
			console.log(usage);
		}
		return help ? 0 : 1;
	}

	try {
		const result = runBranchMigrationParity({ baseRef, headRef, git });
		if (json) {
			console.log(JSON.stringify(toBranchParityJson(result), null, 2));
		} else {
			console.log(formatBranchMigrationParityReport(result));
		}
		// Healthy sensitive changes → exit 0 with requiresParityAudit true.
		// Identity violations → exit 1 (result not trustworthy for promote).
		return result.identityOk ? 0 : 1;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (json) {
			console.log(
				JSON.stringify({
					identityStatus: 'fail',
					sensitiveChanges: false,
					sensitiveFiles: [],
					findings: [
						createFinding({
							id: 'cli-technical-failure',
							status: 'Fail',
							cause: message,
							impact: 'Parity analysis did not complete.',
							owner: 'agent',
							remediation: 'Fix git/refs/network issue and re-run.',
							nextStep: 'Re-run db:branch:parity after remediation.',
						}),
					],
					requiresParityAudit: false,
					baseRef,
					headRef,
					headOnlyVersions: [],
					baseOnlyVersions: [],
					contentMutations: [],
				} satisfies BranchParityJsonResult),
			);
		} else {
			console.error('Fatal branch migration parity error:', message);
		}
		return 1;
	}
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('branch-migration-parity.ts')) {
	process.exit(main());
}
