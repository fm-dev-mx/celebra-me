import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	sanitizeOperationalCorrelationId,
	type OperationalEvidenceStatus,
	type OperationalEvidenceV1,
} from './operational-evidence';

export const VALENTINA_CLEANUP_EVENT_NAME = 'valentina_cleanup_summary';

export interface ValentinaCleanupResult {
	validationReconciled: number;
	validationPending: number;
	expiredReservations: number;
	claimed: number;
	deleted: number;
	failed: number;
	auditPurged: number;
}

export interface ValentinaCleanupPayload extends Record<string, string | number | boolean | null> {
	invocation_id: string | null;
	duration_ms: number;
	validation_reconciled: number | null;
	validation_pending: number | null;
	expired_reservations: number | null;
	claimed: number | null;
	deleted: number | null;
	failed: number | null;
	audit_purged: number | null;
	count_invariant_valid: boolean | null;
}

export type ValentinaCleanupEvidence = OperationalEvidenceV1<
	'valentina_cleanup',
	ValentinaCleanupPayload
>;

interface CleanupEvidenceContext {
	runId: string;
	startedAt: string;
	completedAt: string | null;
	invocationId?: string | null;
	commitSha?: string | null;
	deploymentId?: string | null;
}

const CLEANUP_REVIEW_ACTION =
	'Abra la invocación exacta en Vercel y revise el resumen; no invoque manualmente el cleanup.';

function durationMs(startedAt: string, completedAt: string | null): number {
	if (!completedAt) return 0;
	return Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
}

function addCorrelation(
	evidence: ValentinaCleanupEvidence,
	context: CleanupEvidenceContext,
): ValentinaCleanupEvidence {
	const deploymentId = sanitizeOperationalCorrelationId(context.deploymentId);
	const commitSha = context.commitSha?.trim();
	return {
		...evidence,
		...(deploymentId ? { deploymentId } : {}),
		...(commitSha && /^[0-9a-f]{40}$/i.test(commitSha) ? { commitSha } : {}),
	};
}

export function createValentinaCleanupStartedEvidence(
	context: CleanupEvidenceContext,
): ValentinaCleanupEvidence {
	const evidence = addCorrelation(
		{
			schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
			check: 'valentina_cleanup',
			environment: 'production',
			runId: context.runId,
			startedAt: context.startedAt,
			completedAt: null,
			observedAt: context.startedAt,
			status: 'UNVERIFIED',
			reasonCode: 'cleanup_started',
			source: 'vercel_cron',
			ownerAction: 'Espere el resumen de cierre antes de evaluar el cleanup.',
			payload: {
				invocation_id: sanitizeOperationalCorrelationId(context.invocationId),
				duration_ms: 0,
				validation_reconciled: null,
				validation_pending: null,
				expired_reservations: null,
				claimed: null,
				deleted: null,
				failed: null,
				audit_purged: null,
				count_invariant_valid: null,
			},
		},
		context,
	);
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

export function createValentinaCleanupCompletedEvidence(
	context: CleanupEvidenceContext & { completedAt: string },
	result: ValentinaCleanupResult,
): ValentinaCleanupEvidence {
	const invariantValid = result.claimed === result.deleted + result.failed;
	const status: OperationalEvidenceStatus = !invariantValid
		? 'FAILED'
		: result.failed > 0
			? 'WARNING'
			: 'VERIFIED';
	const evidence = addCorrelation(
		{
			schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
			check: 'valentina_cleanup',
			environment: 'production',
			runId: context.runId,
			startedAt: context.startedAt,
			completedAt: context.completedAt,
			observedAt: context.completedAt,
			status,
			reasonCode: !invariantValid
				? 'cleanup_count_invariant_failed'
				: result.failed > 0
					? 'cleanup_partial_failure'
					: 'cleanup_completed',
			source: 'vercel_cron',
			ownerAction:
				status === 'VERIFIED'
					? 'No se requiere acción; conserve la invocación como evidencia.'
					: CLEANUP_REVIEW_ACTION,
			payload: {
				invocation_id: sanitizeOperationalCorrelationId(context.invocationId),
				duration_ms: durationMs(context.startedAt, context.completedAt),
				validation_reconciled: result.validationReconciled,
				validation_pending: result.validationPending,
				expired_reservations: result.expiredReservations,
				claimed: result.claimed,
				deleted: result.deleted,
				failed: result.failed,
				audit_purged: result.auditPurged,
				count_invariant_valid: invariantValid,
			},
		},
		context,
	);
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

export function createValentinaCleanupFailedEvidence(
	context: CleanupEvidenceContext & { completedAt: string },
): ValentinaCleanupEvidence {
	const evidence = addCorrelation(
		{
			schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
			check: 'valentina_cleanup',
			environment: 'production',
			runId: context.runId,
			startedAt: context.startedAt,
			completedAt: context.completedAt,
			observedAt: context.completedAt,
			status: 'FAILED',
			reasonCode: 'cleanup_exception',
			source: 'vercel_cron',
			ownerAction: CLEANUP_REVIEW_ACTION,
			payload: {
				invocation_id: sanitizeOperationalCorrelationId(context.invocationId),
				duration_ms: durationMs(context.startedAt, context.completedAt),
				validation_reconciled: null,
				validation_pending: null,
				expired_reservations: null,
				claimed: null,
				deleted: null,
				failed: null,
				audit_purged: null,
				count_invariant_valid: null,
			},
		},
		context,
	);
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}
