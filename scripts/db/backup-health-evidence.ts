import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	type OperationalEvidenceStatus,
	type OperationalEvidenceV1,
} from '../../src/lib/operations/operational-evidence.ts';
import { validateCriticalBackupManifest, type CriticalBackupManifest } from './backup-manifest.ts';
import {
	DAILY_BACKUP_RPO_MS,
	evaluateCriticalBackupHealth,
	type CriticalBackupHealth,
} from './critical-backup-health.ts';

export const BACKUP_HEALTH_RECEIPT_PATH = resolve('.cache', 'operations', 'backup-health-v1.json');
export const BACKUP_HEALTH_ALERT_STATE_PATH = resolve(
	'.cache',
	'operations',
	'backup-health-alert-state-v1.json',
);

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

export interface BackupHealthObservation {
	newestCreatedAt: string | null;
	lastDailyReportAt: string | null;
	lastDailyOutcome: 'succeeded' | 'failed' | null;
	orphanCount: number;
	manifestValid: boolean | null;
}

export type BackupHealthNotification = 'problem' | 'recovery' | 'none';

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

function isBackupHealthEvidence(value: unknown): value is BackupHealthEvidence {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<BackupHealthEvidence>;
	return (
		candidate.schemaVersion === OPERATIONAL_EVIDENCE_SCHEMA_VERSION &&
		candidate.check === 'critical_backup' &&
		candidate.environment === 'production' &&
		typeof candidate.runId === 'string' &&
		typeof candidate.payload === 'object' &&
		candidate.payload !== null
	);
}

export function observeBackupHealth(input: {
	receipt: unknown;
	observation: BackupHealthObservation | null;
	observedAt?: string;
}): BackupHealthEvidence {
	const observedAt = input.observedAt ?? new Date().toISOString();
	if (!isBackupHealthEvidence(input.receipt)) {
		return createUnverifiedBackupEvidence('backup_receipt_missing', observedAt);
	}
	try {
		assertOperationalEvidenceSafe(input.receipt);
	} catch {
		return createUnverifiedBackupEvidence('backup_receipt_invalid', observedAt);
	}
	if (!input.observation) {
		return {
			...input.receipt,
			observedAt,
			status: 'UNVERIFIED',
			reasonCode: 'backup_observation_unavailable',
			ownerAction: BACKUP_OWNER_ACTION,
			payload: buildPayload({
				exitCode: input.receipt.payload.exit_code,
				recoveryPointAt: null,
				dailyReportAt: null,
				manifestValid: null,
				orphanCount: null,
				nowMs: Date.parse(observedAt),
			}),
		};
	}

	const nowMs = Date.parse(observedAt);
	const payload = buildPayload({
		exitCode: input.receipt.payload.exit_code,
		recoveryPointAt: input.observation.newestCreatedAt,
		dailyReportAt: input.observation.lastDailyReportAt,
		manifestValid: input.observation.manifestValid,
		orphanCount: input.observation.orphanCount,
		nowMs,
	});
	let status: OperationalEvidenceStatus = 'VERIFIED';
	let reasonCode = 'backup_within_rpo';
	if (payload.exit_code !== 0 || input.observation.lastDailyOutcome === 'failed') {
		status = 'FAILED';
		reasonCode = 'backup_command_failed';
	} else if (payload.manifest_valid === false || (payload.orphan_count ?? 0) > 0) {
		status = 'FAILED';
		reasonCode = 'backup_integrity_failed';
	} else if (payload.recovery_point_age_ms === null || payload.manifest_valid === null) {
		status = 'UNVERIFIED';
		reasonCode = 'backup_evidence_incomplete';
	} else if (payload.recovery_point_age_ms > DAILY_BACKUP_RPO_MS) {
		status = 'FAILED';
		reasonCode = 'backup_rpo_expired';
	} else if (payload.daily_report_age_ms === null) {
		status = 'UNVERIFIED';
		reasonCode = 'backup_daily_report_missing';
	} else if (payload.daily_report_age_ms > DAILY_BACKUP_RPO_MS) {
		status = 'WARNING';
		reasonCode = 'backup_daily_report_stale';
	}
	const evidence: BackupHealthEvidence = {
		...input.receipt,
		observedAt,
		status,
		reasonCode,
		ownerAction: status === 'VERIFIED' ? BACKUP_VERIFIED_ACTION : BACKUP_OWNER_ACTION,
		payload,
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

function createUnverifiedBackupEvidence(
	reasonCode: 'backup_receipt_missing' | 'backup_receipt_invalid',
	observedAt: string,
): BackupHealthEvidence {
	const evidence: BackupHealthEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'critical_backup',
		environment: 'production',
		runId: randomUUID(),
		startedAt: observedAt,
		completedAt: observedAt,
		observedAt,
		status: 'UNVERIFIED',
		reasonCode,
		source: 'local_backup_observer',
		ownerAction: BACKUP_OWNER_ACTION,
		payload: buildPayload({
			exitCode: null,
			recoveryPointAt: null,
			dailyReportAt: null,
			manifestValid: null,
			orphanCount: null,
			nowMs: Date.parse(observedAt),
		}),
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

export function readBackupHealthObservation(backupRoot?: string): BackupHealthObservation | null {
	let health: CriticalBackupHealth;
	try {
		health = evaluateCriticalBackupHealth({ backupRoot });
	} catch {
		return null;
	}
	let manifestValid: boolean | null = null;
	if (health.newestManifestPath) {
		try {
			const manifest = JSON.parse(
				readFileSync(health.newestManifestPath, 'utf8'),
			) as CriticalBackupManifest;
			validateCriticalBackupManifest(manifest);
			manifestValid = true;
		} catch {
			manifestValid = false;
		}
	}
	return {
		newestCreatedAt: health.newestCreatedAt,
		lastDailyReportAt: health.lastDailyReportAt,
		lastDailyOutcome: health.lastDailyOutcome,
		orphanCount: health.orphanCount,
		manifestValid,
	};
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

export function readJsonIfPresent(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as unknown;
	} catch {
		return null;
	}
}

export function resolveBackupHealthNotification(
	previous: OperationalEvidenceStatus | null,
	current: OperationalEvidenceStatus,
): BackupHealthNotification {
	const previousProblem = previous !== null && previous !== 'VERIFIED';
	const currentProblem = current !== 'VERIFIED';
	if (currentProblem && previous !== current) return 'problem';
	if (!currentProblem && previousProblem) return 'recovery';
	return 'none';
}
