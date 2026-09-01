import {
	createValentinaCleanupCompletedEvidence,
	createValentinaCleanupFailedEvidence,
} from '@/lib/operations/valentina-cleanup-evidence';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';

const context = {
	runId: '018f7b77-80f8-7bd1-8f87-70d0b5312e2f',
	startedAt: '2026-08-31T07:17:00.000Z',
	completedAt: '2026-08-31T07:17:03.000Z',
	invocationId: 'sfo1::abc-123',
	commitSha: 'a'.repeat(40),
	deploymentId: 'dpl_1234567890',
};

const completed = {
	validationReconciled: 2,
	validationPending: 1,
	expiredReservations: 3,
	claimed: 4,
	deleted: 4,
	failed: 0,
	auditPurged: 5,
};

describe('Valentina cleanup evidence', () => {
	it('keeps pending validation informational and verifies consistent successful counts', () => {
		const evidence = createValentinaCleanupCompletedEvidence(context, completed);

		expect(evidence.status).toBe('VERIFIED');
		expect(evidence.payload.validation_pending).toBe(1);
		expect(evidence.payload.count_invariant_valid).toBe(true);
	});

	it('reports partial deletion as warning and an inconsistent count as failure', () => {
		expect(
			createValentinaCleanupCompletedEvidence(context, {
				...completed,
				deleted: 3,
				failed: 1,
			}).status,
		).toBe('WARNING');
		expect(
			createValentinaCleanupCompletedEvidence(context, {
				...completed,
				deleted: 3,
				failed: 0,
			}).reasonCode,
		).toBe('cleanup_count_invariant_failed');
	});

	it('records exceptions without leaking object identifiers, URLs, or bodies', () => {
		const serialized = serializeOperationalEvidenceEvent(
			'valentina_cleanup_summary',
			'completed',
			createValentinaCleanupFailedEvidence(context),
		);

		expect(serialized).toContain('cleanup_exception');
		expect(serialized).not.toContain('object_key');
		expect(serialized).not.toContain('https://');
		expect(serialized).not.toContain('request_body');
	});
});
