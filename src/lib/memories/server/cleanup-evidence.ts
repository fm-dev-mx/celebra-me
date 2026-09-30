import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	sanitizeOperationalCorrelationId,
	type OperationalEvidenceEnvironment,
	type OperationalEvidenceStatus,
	type OperationalEvidenceV1,
} from '@/lib/operations/operational-evidence';
import type { MemoriesCleanupResult } from './cleanup.service';

export const MEMORIES_CLEANUP_EVENT_NAME = 'memories_cleanup_summary';
const CHECK = 'memories_cleanup';

interface MemoriesCleanupMetrics {
	validation_reconciled: number | null;
	validation_pending: number | null;
	expired_reservations: number | null;
	expired_content: number | null;
	claimed: number | null;
	deleted: number | null;
	failed: number | null;
	anonymized: number | null;
	audit_purged: number | null;
	count_invariant_valid: boolean | null;
}

export interface MemoriesCleanupPayload
	extends MemoriesCleanupMetrics, Record<string, string | number | boolean | null> {
	invocation_id: string | null;
	duration_ms: number;
}

export type MemoriesCleanupEvidence = OperationalEvidenceV1<typeof CHECK, MemoriesCleanupPayload>;

export interface MemoriesCleanupContext {
	environment: OperationalEvidenceEnvironment;
	runId: string;
	startedAt: string;
	completedAt: string | null;
	invocationId?: string | null;
	commitSha?: string | null;
	deploymentId?: string | null;
}

const REVIEW_ACTION =
	'Abra la invocación exacta en Vercel y revise el resumen; no invoque manualmente la limpieza.';

export function resolveMemoriesRuntimeEnvironment(
	vercelEnv: string | undefined,
): OperationalEvidenceEnvironment {
	const normalized = (vercelEnv ?? '').trim().toLowerCase();
	if (normalized === 'production') return 'production';
	if (normalized === 'preview') return 'preview';
	return 'local';
}

const EMPTY_PAYLOAD: MemoriesCleanupMetrics = {
	validation_reconciled: null,
	validation_pending: null,
	expired_reservations: null,
	expired_content: null,
	claimed: null,
	deleted: null,
	failed: null,
	anonymized: null,
	audit_purged: null,
	count_invariant_valid: null,
};

function durationMs(startedAt: string, completedAt: string | null): number {
	if (!completedAt) return 0;
	return Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
}

function build(
	context: MemoriesCleanupContext,
	status: OperationalEvidenceStatus,
	reasonCode: string,
	ownerAction: string,
	metrics: MemoriesCleanupMetrics,
): MemoriesCleanupEvidence {
	const deploymentId = sanitizeOperationalCorrelationId(context.deploymentId);
	const commitSha = context.commitSha?.trim();
	const evidence: MemoriesCleanupEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: CHECK,
		environment: context.environment,
		runId: context.runId,
		startedAt: context.startedAt,
		completedAt: context.completedAt,
		observedAt: context.completedAt ?? context.startedAt,
		status,
		reasonCode,
		source: 'vercel_cron',
		ownerAction,
		...(deploymentId ? { deploymentId } : {}),
		...(commitSha && /^[0-9a-f]{40}$/i.test(commitSha) ? { commitSha } : {}),
		payload: {
			invocation_id: sanitizeOperationalCorrelationId(context.invocationId),
			duration_ms: durationMs(context.startedAt, context.completedAt),
			...metrics,
		},
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

export function createMemoriesCleanupStartedEvidence(
	context: MemoriesCleanupContext,
): MemoriesCleanupEvidence {
	return build(
		context,
		'UNVERIFIED',
		'cleanup_started',
		'Espere el resumen de cierre antes de evaluar la limpieza.',
		EMPTY_PAYLOAD,
	);
}

export function createMemoriesCleanupCompletedEvidence(
	context: MemoriesCleanupContext & { completedAt: string },
	result: MemoriesCleanupResult,
): MemoriesCleanupEvidence {
	const invariantValid = result.claimed === result.deleted + result.failed;
	const status: OperationalEvidenceStatus = !invariantValid
		? 'FAILED'
		: result.failed > 0
			? 'WARNING'
			: 'VERIFIED';
	return build(
		context,
		status,
		!invariantValid
			? 'cleanup_count_invariant_failed'
			: result.failed > 0
				? 'cleanup_partial_failure'
				: 'cleanup_completed',
		status === 'VERIFIED'
			? 'No se requiere acción; conserve la invocación como evidencia.'
			: REVIEW_ACTION,
		{
			validation_reconciled: result.validationReconciled,
			validation_pending: result.validationPending,
			expired_reservations: result.expiredReservations,
			expired_content: result.expiredContent,
			claimed: result.claimed,
			deleted: result.deleted,
			failed: result.failed,
			anonymized: result.anonymized,
			audit_purged: result.auditPurged,
			count_invariant_valid: invariantValid,
		},
	);
}

export function createMemoriesCleanupFailedEvidence(
	context: MemoriesCleanupContext & { completedAt: string },
): MemoriesCleanupEvidence {
	return build(context, 'FAILED', 'cleanup_exception', REVIEW_ACTION, EMPTY_PAYLOAD);
}
