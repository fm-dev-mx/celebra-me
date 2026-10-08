/**
 * Static SQL risk classification for schema migrations.
 *
 * Ordinary additive/neutral SQL needs no registry ceremony.
 * Destructive SQL (DROP / REVOKE / TRUNCATE / ALTER … DROP) fails closed unless the
 * rollout registry entry is phase=contract with contract metadata.
 * Initial ALL privilege revocation on an unconditionally new, schema-qualified table
 * in the same explicit transaction is additive; ambiguous SQL retains the guard.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type {
	MigrationRolloutEntry,
	MigrationRolloutRegistry,
} from './migration-deployment-compatibility.ts';

export type MigrationSqlRiskKind =
	| 'ordinary'
	| 'destructive_drop'
	| 'destructive_revoke'
	| 'destructive_truncate'
	| 'destructive_alter_drop'
	| 'unclassified_destructive';

export interface MigrationSqlRiskFinding {
	kind: MigrationSqlRiskKind;
	evidence: string;
}

export interface MigrationSqlRiskResult {
	version: string;
	filename: string;
	contentDigest: string;
	findings: MigrationSqlRiskFinding[];
	isDestructive: boolean;
}

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase', 'migrations');

/**
 * Migrations at or before this version may contain historical DROP/REVOKE patterns.
 * Static contract-metadata enforcement applies only to newer candidates.
 */
export const SQL_RISK_CONTRACT_ENFORCEMENT_AFTER = '20260806120000';

const DESTRUCTIVE_PATTERNS: Array<{ kind: MigrationSqlRiskKind; pattern: RegExp }> = [
	{ kind: 'destructive_truncate', pattern: /\btruncate\b/i },
	{ kind: 'destructive_revoke', pattern: /\brevoke\b/i },
	{
		kind: 'destructive_drop',
		pattern:
			/\bdrop\s+(table|view|materialized\s+view|schema|database|function|procedure|trigger|index|type|sequence|policy|extension|role|cast|domain|operator|rule|publication|subscription)\b/i,
	},
	{
		kind: 'destructive_alter_drop',
		pattern: /\balter\s+(table|view|type|index|sequence|policy)\b[\s\S]{0,240}\bdrop\b/i,
	},
];

export function normalizeSqlForRiskScan(sql: string): string {
	// Consume lexical units in source order: a comment marker inside a literal must
	// never swallow subsequent executable SQL (including a real REVOKE).
	return sql.replace(
		/--[^\r\n]*|\/\*[\s\S]*?\*\/|\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'/g,
		(token) => (token.startsWith("'") ? "''" : ' '),
	);
}

export function classifySqlText(sql: string): MigrationSqlRiskFinding[] {
	const scanned = normalizeSqlForRiskScan(sql);
	const revokeScan = excludeNewTablePermissionInitialization(sql, scanned);
	const findings: MigrationSqlRiskFinding[] = [];
	for (const { kind, pattern } of DESTRUCTIVE_PATTERNS) {
		const match = (kind === 'destructive_revoke' ? revokeScan : scanned).match(pattern);
		if (match) {
			findings.push({
				kind,
				evidence: match[0].replace(/\s+/g, ' ').slice(0, 80),
			});
		}
	}
	if (findings.length === 0) {
		return [{ kind: 'ordinary', evidence: 'no destructive DDL/DCL patterns detected' }];
	}
	return findings;
}

function matchCreatedObject(
	text: string,
	createTable: RegExp,
	createFunction: RegExp,
): string | undefined {
	return (text.match(createTable) ?? text.match(createFunction))?.[1]?.toLowerCase();
}

function matchRevokedObject(
	text: string,
	revokeTable: RegExp,
	revokeFunction: RegExp,
): string | undefined {
	return (text.match(revokeTable) ?? text.match(revokeFunction))?.[1]?.toLowerCase();
}

function matchPreservedObject(text: string, patterns: readonly RegExp[]): string | undefined {
	for (const pattern of patterns) {
		const matched = text.match(pattern)?.[1]?.toLowerCase();
		if (matched) return matched;
	}
	return undefined;
}

/** Narrow proof, not a general SQL parser: unsupported syntax retains the original guard. */
function excludeNewTablePermissionInitialization(sql: string, scanned: string): string {
	// Strip function definition bodies (AS $tag$ ... $tag$) so standard function definitions
	// are not rejected merely for containing dollar quotes. Other dollar quotes (like DO $$ ... $$)
	// remain and fail closed.
	const sqlWithoutFunctionBodies = sql.replace(
		/\bas\s+\$([A-Za-z_][A-Za-z0-9_]*|)\$[\s\S]*?\$\1\$/gi,
		'as ',
	);
	// Do not infer object identity or statement boundaries through quoted/dynamic SQL.
	const literals = sqlWithoutFunctionBodies.match(/'(?:''|[^'])*'/g) ?? [];
	if (
		/"|\$[A-Za-z_]*\$|\/\*|\\/.test(sqlWithoutFunctionBodies) ||
		literals.some((literal) => /;|--|\/\*/.test(literal))
	) {
		return scanned;
	}
	const identifier = '[a-z_][a-z0-9_]*';
	const qualified = `(${identifier}\\.${identifier})`;
	const createTable = new RegExp(`^create\\s+table\\s+${qualified}\\s*\\([\\s\\S]*\\)$`, 'i');
	const createFunction = new RegExp(
		`^create\\s+(?:or\\s+replace\\s+)?function\\s+${qualified}\\s*\\([\\s\\S]*\\)\\s*returns\\b[\\s\\S]*$`,
		'i',
	);
	const revokeTable = new RegExp(
		`^revoke\\s+all(?:\\s+privileges)?\\s+on\\s+(?:table\\s+)?${qualified}\\s+from\\s+${identifier}(?:\\s*,\\s*${identifier})*$`,
		'i',
	);
	const revokeFunction = new RegExp(
		`^revoke\\s+all(?:\\s+privileges)?\\s+on\\s+function\\s+${qualified}(?:\\s*\\([^()]*\\))?\\s+from\\s+${identifier}(?:\\s*,\\s*${identifier})*$`,
		'i',
	);
	const alterRls = new RegExp(
		`^alter\\s+table\\s+${qualified}\\s+(?:enable|force)\\s+row\\s+level\\s+security$`,
		'i',
	);
	const createIndex = new RegExp(
		`^create\\s+(?:unique\\s+)?index\\s+${identifier}\\s+on\\s+${qualified}\\s*\\([^()]*\\)$`,
		'i',
	);
	const grantFunction = new RegExp(
		`^grant\\s+execute\\s+on\\s+function\\s+${qualified}(?:\\s*\\([^()]*\\))?\\s+to\\s+${identifier}(?:\\s*,\\s*${identifier})*$`,
		'i',
	);
	const commentFunction = new RegExp(
		`^comment\\s+on\\s+function\\s+${qualified}(?:\\s*\\([^()]*\\))?\\s+is\\s+.*$`,
		'i',
	);
	const preservedPatterns = [alterRls, createIndex, grantFunction, commentFunction] as const;
	let inTransaction = false;
	const created = new Set<string>();
	return scanned
		.split(';')
		.map((statement) => {
			const text = statement.trim();
			if (/^begin(?:\s+transaction)?$/i.test(text) && !inTransaction) {
				inTransaction = true;
				created.clear();
				return statement;
			}
			if (!inTransaction) return statement;

			const createdObj = matchCreatedObject(text, createTable, createFunction);
			if (createdObj) {
				created.add(createdObj);
				return statement;
			}
			const revokedObj = matchRevokedObject(text, revokeTable, revokeFunction);
			if (revokedObj && created.has(revokedObj)) return '';

			const preservedObj = matchPreservedObject(text, preservedPatterns);
			if (preservedObj && created.has(preservedObj)) return statement;

			// Includes COMMIT, ROLLBACK, savepoints, renames, dynamic calls and unknown operations.
			inTransaction = false;
			created.clear();
			return statement;
		})
		.join(';');
}

/**
 * Canonical text for content digests. Git stores migrations with LF, but `core.autocrlf` and
 * editors materialize them as CRLF, LF or mixed per worktree, and a leading BOM is equally
 * insignificant. Digests must identify the committed content, not one checkout's bytes.
 */
export function normalizeSqlForDigest(sql: string): string {
	return sql.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function contentDigestOf(sql: string): string {
	return createHash('sha256').update(normalizeSqlForDigest(sql)).digest('hex');
}

export function resolveMigrationSqlPath(version: string): string | null {
	if (!/^\d{14}$/.test(version)) return null;
	if (!existsSync(MIGRATIONS_DIR)) return null;
	const match = readdirSync(MIGRATIONS_DIR).find((entry) => entry.startsWith(`${version}_`));
	return match ? resolve(MIGRATIONS_DIR, match) : null;
}

export function classifyMigrationFile(version: string, sqlPath?: string): MigrationSqlRiskResult {
	const path = sqlPath ?? resolveMigrationSqlPath(version);
	if (!path) {
		throw new Error(`Migration file not found for version ${version}`);
	}
	const sql = readFileSync(path, 'utf8');
	const findings = classifySqlText(sql);
	const isDestructive = findings.some((f) => f.kind !== 'ordinary');
	return {
		version,
		filename: basename(path),
		contentDigest: contentDigestOf(sql),
		findings,
		isDestructive,
	};
}

export function hasContractMetadata(entry: MigrationRolloutEntry | undefined): boolean {
	if (!entry || entry.phase !== 'contract') return false;
	const hasDeployedCaps = (entry.requiresDeployedAppCapabilities?.length ?? 0) > 0;
	const hasRevokes = (entry.revokes?.length ?? 0) > 0;
	return hasDeployedCaps || hasRevokes;
}

/**
 * Evaluate static SQL risk against the rollout registry.
 * Destructive SQL without contract metadata always blocks (all targets).
 * Ordinary SQL never requires a registry entry.
 */
export function evaluateMigrationSqlRisk(options: {
	version: string;
	registry: MigrationRolloutRegistry;
	sqlPath?: string;
	/** When true, skip contract-metadata enforcement (disposable proof path). */
	skipContractEnforcement?: boolean;
}): { blocked: boolean; reasons: string[]; risk: MigrationSqlRiskResult } {
	const risk = classifyMigrationFile(options.version, options.sqlPath);
	if (!risk.isDestructive) {
		return { blocked: false, reasons: [], risk };
	}

	if (options.skipContractEnforcement || options.version <= SQL_RISK_CONTRACT_ENFORCEMENT_AFTER) {
		return { blocked: false, reasons: [], risk };
	}

	const entry = options.registry.migrations[options.version];
	const reasons: string[] = [];
	const kinds = risk.findings
		.filter((f) => f.kind !== 'ordinary')
		.map((f) => f.kind)
		.join(', ');

	if (!entry) {
		reasons.push(
			`Migration ${options.version} contains destructive SQL (${kinds}) but has no rollout registry entry. ` +
				`Register it as phase=contract with requiresDeployedAppCapabilities and/or revokes.`,
		);
	} else if (entry.phase !== 'contract') {
		reasons.push(
			`Migration ${options.version} contains destructive SQL (${kinds}) but registry phase is "${entry.phase}". ` +
				`Destructive SQL must be phase=contract with deployed-app evidence metadata.`,
		);
	} else if (!hasContractMetadata(entry)) {
		reasons.push(
			`Migration ${options.version} is phase=contract but lacks contract metadata ` +
				`(requiresDeployedAppCapabilities and/or revokes) for destructive SQL (${kinds}).`,
		);
	}

	return { blocked: reasons.length > 0, reasons, risk };
}

/** Per-version content digests, used to detect in-place edits of already-applied migrations. */
export function computeMigrationFileDigests(
	files: readonly { version: string; filename: string }[],
	dir: string = MIGRATIONS_DIR,
): Record<string, string> {
	return Object.fromEntries(
		files.map((file) => [
			file.version,
			contentDigestOf(readFileSync(resolve(dir, file.filename), 'utf8')),
		]),
	);
}

/**
 * Digest of ordered migration file contents for disposable proof binding.
 */
export function computeMigrationSetDigest(
	files: readonly { version: string; filename: string }[],
	dir: string = MIGRATIONS_DIR,
): string {
	const hash = createHash('sha256');
	for (const file of files) {
		const path = resolve(dir, file.filename);
		const sql = readFileSync(path, 'utf8');
		hash.update(file.version);
		hash.update('\0');
		hash.update(file.filename);
		hash.update('\0');
		hash.update(contentDigestOf(sql));
		hash.update('\n');
	}
	return hash.digest('hex');
}
