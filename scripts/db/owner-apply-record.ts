/**
 * Durable owner-apply evidence for Production schema migrations.
 *
 * Local ledger under .backups/prod/owner-apply/ (gitignored). Distinguishes
 * owner authorization from schema_migrations parity. Does not store secrets.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export const OWNER_APPLY_RECORD_SCHEMA_VERSION = 1 as const;
export const OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH = '20260806120000';

export interface OwnerApplyRecord {
	schemaVersion: typeof OWNER_APPLY_RECORD_SCHEMA_VERSION;
	recordedAt: string;
	operationType: string;
	operationVerb: string;
	result: 'authorized_applied';
	authorized: true;
	migrationVersions: string[];
	planId: string;
	releaseSha: string;
	projectRef: string;
	gitHead?: string;
	worktree?: string;
}

const VERSION_RE = /^\d{14}$/;

export function defaultOwnerApplyLedgerDir(cwd: string = process.cwd()): string {
	return resolve(cwd, '.backups', 'prod', 'owner-apply');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseOwnerApplyRecord(value: unknown): OwnerApplyRecord | null {
	if (!isRecord(value)) return null;
	if (value.schemaVersion !== OWNER_APPLY_RECORD_SCHEMA_VERSION) return null;
	if (value.result !== 'authorized_applied' || value.authorized !== true) return null;
	if (typeof value.recordedAt !== 'string' || !value.recordedAt) return null;
	if (typeof value.operationType !== 'string' || typeof value.operationVerb !== 'string') {
		return null;
	}
	if (typeof value.planId !== 'string' || typeof value.releaseSha !== 'string') return null;
	if (typeof value.projectRef !== 'string' || !value.projectRef) return null;
	if (!Array.isArray(value.migrationVersions)) return null;
	const migrationVersions = value.migrationVersions.filter(
		(version): version is string => typeof version === 'string' && VERSION_RE.test(version),
	);
	if (migrationVersions.length !== value.migrationVersions.length) return null;
	const record: OwnerApplyRecord = {
		schemaVersion: OWNER_APPLY_RECORD_SCHEMA_VERSION,
		recordedAt: value.recordedAt,
		operationType: value.operationType,
		operationVerb: value.operationVerb,
		result: 'authorized_applied',
		authorized: true,
		migrationVersions,
		planId: value.planId,
		releaseSha: value.releaseSha,
		projectRef: value.projectRef,
	};
	if (typeof value.gitHead === 'string' && value.gitHead) record.gitHead = value.gitHead;
	if (typeof value.worktree === 'string' && value.worktree) record.worktree = value.worktree;
	return record;
}

export function writeOwnerApplyRecord(
	input: Omit<OwnerApplyRecord, 'schemaVersion' | 'recordedAt' | 'result' | 'authorized'> & {
		recordedAt?: string;
	},
	options?: { ledgerDir?: string; cwd?: string },
): { record: OwnerApplyRecord; path: string } {
	const recordedAt = input.recordedAt ?? new Date().toISOString();
	const record: OwnerApplyRecord = {
		schemaVersion: OWNER_APPLY_RECORD_SCHEMA_VERSION,
		recordedAt,
		operationType: input.operationType,
		operationVerb: input.operationVerb,
		result: 'authorized_applied',
		authorized: true,
		migrationVersions: [...input.migrationVersions],
		planId: input.planId,
		releaseSha: input.releaseSha,
		projectRef: input.projectRef,
		...(input.gitHead ? { gitHead: input.gitHead } : {}),
		...(input.worktree ? { worktree: input.worktree } : {}),
	};
	const ledgerDir = options?.ledgerDir ?? defaultOwnerApplyLedgerDir(options?.cwd);
	mkdirSync(ledgerDir, { recursive: true });
	const safeStamp = recordedAt.replace(/[:.]/g, '-');
	const shortPlan = input.planId.replace(/[^a-f0-9]/gi, '').slice(0, 8) || 'plan';
	const fileName = `${safeStamp}-${input.operationVerb.toLowerCase()}-${shortPlan}.json`;
	const path = join(ledgerDir, fileName);
	writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
	return { record, path };
}

export function listOwnerApplyRecords(options?: {
	ledgerDir?: string;
	cwd?: string;
}): OwnerApplyRecord[] {
	const ledgerDir = options?.ledgerDir ?? defaultOwnerApplyLedgerDir(options?.cwd);
	if (!existsSync(ledgerDir)) return [];
	const records: OwnerApplyRecord[] = [];
	for (const entry of readdirSync(ledgerDir)) {
		if (!entry.endsWith('.json')) continue;
		try {
			const parsed = parseOwnerApplyRecord(
				JSON.parse(readFileSync(join(ledgerDir, entry), 'utf8')),
			);
			if (parsed) records.push(parsed);
		} catch {
			// Ignore unreadable or non-record files in the gitignored ledger.
		}
	}
	return records.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
}

export function recordedMigrationVersions(records: readonly OwnerApplyRecord[]): Set<string> {
	const versions = new Set<string>();
	for (const record of records) {
		if (record.operationType !== 'production_migration') continue;
		for (const version of record.migrationVersions) versions.add(version);
	}
	return versions;
}

export function inferWorktreeLabel(cwd: string = process.cwd()): string {
	return basename(cwd);
}
