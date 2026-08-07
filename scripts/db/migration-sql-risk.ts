/**
 * Static SQL risk classification for schema migrations.
 *
 * Ordinary additive/neutral SQL needs no registry ceremony.
 * Destructive SQL (DROP / REVOKE / TRUNCATE / ALTER … DROP) fails closed unless the
 * rollout registry entry is phase=contract with contract metadata.
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

function stripSqlComments(sql: string): string {
	const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
	return withoutBlock
		.split(/\r?\n/)
		.map((line) => line.replace(/--.*$/, ''))
		.join('\n');
}

function stripDollarQuotedBodies(sql: string): string {
	// Ignore bodies inside $$…$$ / $tag$…$tag$ so DROP language inside function source is not flagged.
	return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ');
}

function stripSingleQuotedLiterals(sql: string): string {
	return sql.replace(/'(?:''|[^'])*'/g, "''");
}

export function normalizeSqlForRiskScan(sql: string): string {
	return stripSingleQuotedLiterals(stripDollarQuotedBodies(stripSqlComments(sql)));
}

export function classifySqlText(sql: string): MigrationSqlRiskFinding[] {
	const scanned = normalizeSqlForRiskScan(sql);
	const findings: MigrationSqlRiskFinding[] = [];
	for (const { kind, pattern } of DESTRUCTIVE_PATTERNS) {
		const match = scanned.match(pattern);
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

export function contentDigestOf(sql: string): string {
	return createHash('sha256').update(sql).digest('hex');
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

	if (
		options.skipContractEnforcement ||
		options.version <= SQL_RISK_CONTRACT_ENFORCEMENT_AFTER
	) {
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

/**
 * Digest of ordered migration file contents for disposable proof binding.
 */
export function computeMigrationSetDigest(
	files: readonly { version: string; filename: string }[],
): string {
	const hash = createHash('sha256');
	for (const file of files) {
		const path = resolve(MIGRATIONS_DIR, file.filename);
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
