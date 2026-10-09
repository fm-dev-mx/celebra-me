import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	type OperationalEvidenceStatus,
	type OperationalEvidenceV1,
} from '../../src/lib/operations/operational-evidence.ts';

export const BACKUP_HEALTH_RECEIPT_PATH = resolve('.cache', 'operations', 'backup-health-v1.json');
export interface BackupHealthPayload extends Record<string, string | number | boolean | null> {
	exit_code: number | null;
	recovery_point_at: string | null;
	recovery_point_age_ms: number | null;
	daily_report_at: string | null;
	daily_report_age_ms: number | null;
	manifest_valid: boolean | null;
	orphan_count: number | null;
}

export type BackupHealthEvidence = OperationalEvidenceV1<'critical_backup', BackupHealthPayload>;

export interface BackupRunReportSnapshot {
	startedAt: string;
	endedAt: string;
	outcome: 'succeeded' | 'failed';
	recoveryPointTimestamp: string | null;
	manifestVerified: boolean;
}
const BACKUP_OWNER_ACTION =
	'Ejecute manualmente el backup protegido o revise CelebraMe-Daily-Production-Backup en Windows Task Scheduler.';
const BACKUP_VERIFIED_ACTION = 'No se requiere acción; conserve el recibo como evidencia local.';

function ageMs(timestamp: string | null, nowMs: number): number | null {
	if (!timestamp) return null;
	const parsed = Date.parse(timestamp);
	if (!Number.isFinite(parsed)) return null;
	const age = nowMs - parsed;
	return age >= 0 ? age : null;
}

function buildPayload(input: {
	exitCode: number | null;
	recoveryPointAt: string | null;
	dailyReportAt: string | null;
	manifestValid: boolean | null;
	orphanCount: number | null;
	nowMs: number;
}): BackupHealthPayload {
	return {
		exit_code: input.exitCode,
		recovery_point_at: input.recoveryPointAt,
		recovery_point_age_ms: ageMs(input.recoveryPointAt, input.nowMs),
		daily_report_at: input.dailyReportAt,
		daily_report_age_ms: ageMs(input.dailyReportAt, input.nowMs),
		manifest_valid: input.manifestValid,
		orphan_count: input.orphanCount,
	};
}

export function createBackupRunEvidence(input: {
	runId: string;
	report: BackupRunReportSnapshot;
	exitCode: number;
	orphanCount: number | null;
	observedAt?: string;
}): BackupHealthEvidence {
	const observedAt = input.observedAt ?? new Date().toISOString();
	const failed = input.exitCode !== 0 || input.report.outcome === 'failed';
	const incomplete = input.report.recoveryPointTimestamp === null || input.orphanCount === null;
	const invalid = input.report.manifestVerified === false || (input.orphanCount ?? 0) > 0;
	const status: OperationalEvidenceStatus = failed
		? 'FAILED'
		: incomplete
			? 'UNVERIFIED'
			: invalid
				? 'FAILED'
				: 'VERIFIED';
	const reasonCode = failed
		? 'backup_wrapper_failed'
		: incomplete
			? 'backup_receipt_incomplete'
			: invalid
				? 'backup_integrity_failed'
				: 'backup_completed';
	const evidence: BackupHealthEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'critical_backup',
		environment: 'production',
		runId: input.runId,
		startedAt: input.report.startedAt,
		completedAt: input.report.endedAt,
		observedAt,
		status,
		reasonCode,
		source: 'local_backup_wrapper',
		ownerAction: status === 'VERIFIED' ? BACKUP_VERIFIED_ACTION : BACKUP_OWNER_ACTION,
		payload: buildPayload({
			exitCode: input.exitCode,
			recoveryPointAt: input.report.recoveryPointTimestamp,
			dailyReportAt: input.report.endedAt,
			manifestValid: input.report.manifestVerified,
			orphanCount: input.orphanCount,
			nowMs: Date.parse(observedAt),
		}),
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}
export function writeAtomicJson(path: string, value: unknown): void {
	const absolutePath = resolve(path);
	const directory = dirname(absolutePath);
	mkdirSync(directory, { recursive: true });
	const temporaryPath = resolve(
		directory,
		`.${basename(absolutePath)}.${String(process.pid)}.${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
			encoding: 'utf8',
			mode: 0o600,
			flag: 'wx',
		});
		renameSync(temporaryPath, absolutePath);
	} finally {
		rmSync(temporaryPath, { force: true });
	}
}
