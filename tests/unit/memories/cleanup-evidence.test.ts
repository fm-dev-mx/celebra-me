import {
	MEMORIES_CLEANUP_EVENT_NAME,
	createMemoriesCleanupCompletedEvidence,
	createMemoriesCleanupFailedEvidence,
	createMemoriesCleanupStartedEvidence,
	resolveMemoriesRuntimeEnvironment,
	type MemoriesCleanupContext,
} from '@/lib/memories/server/cleanup-evidence';
import type { MemoriesCleanupResult } from '@/lib/memories/server/cleanup.service';
import {
	assertOperationalEvidenceSafe,
	serializeOperationalEvidenceEvent,
} from '@/lib/operations/operational-evidence';

const FORBIDDEN_PAYLOAD_KEY_PATTERN =
	/(?:slug|query|guest|media|cookie|token|secret|signed|body|email|phone|object_?key|url|path)/i;

const context: MemoriesCleanupContext & { completedAt: string } = {
	environment: 'preview',
	runId: '018f7b77-80f8-7bd1-8f87-70d0b5312e2f',
	startedAt: '2026-10-25T07:00:00.000Z',
	completedAt: '2026-10-25T07:00:03.000Z',
	invocationId: 'sfo1::abc-123',
	commitSha: 'a'.repeat(40),
	deploymentId: 'dpl_1234567890',
};

const completed: MemoriesCleanupResult = {
	validationSettled: 2,
	validationRejected: 1,
	uploadsRescued: 1,
	uploadsReleased: 3,
	inFlightPending: 0,
	settleComplete: true,
	expiredContent: 1,
	claimed: 4,
	deleted: 4,
	failed: 0,
	anonymized: 2,
	auditPurged: 5,
};

describe('resolveMemoriesRuntimeEnvironment', () => {
	it('maps Vercel environments and treats everything else as local', () => {
		expect(resolveMemoriesRuntimeEnvironment('production')).toBe('production');
		expect(resolveMemoriesRuntimeEnvironment(' Production ')).toBe('production');
		expect(resolveMemoriesRuntimeEnvironment('preview')).toBe('preview');
		expect(resolveMemoriesRuntimeEnvironment('development')).toBe('local');
		expect(resolveMemoriesRuntimeEnvironment('')).toBe('local');
		expect(resolveMemoriesRuntimeEnvironment(undefined)).toBe('local');
	});
});

describe('completed cleanup evidence', () => {
	it('is VERIFIED when counts are consistent and nothing failed', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, completed);
		expect(evidence.status).toBe('VERIFIED');
		expect(evidence.reasonCode).toBe('cleanup_completed');
		expect(evidence.payload).toMatchObject({
			validation_settled: 2,
			validation_rejected: 1,
			uploads_rescued: 1,
			uploads_released: 3,
			in_flight_pending: 0,
			settle_complete: true,
			expired_content: 1,
			claimed: 4,
			deleted: 4,
			failed: 0,
			anonymized: 2,
			audit_purged: 5,
			count_invariant_valid: true,
			invocation_id: 'sfo1::abc-123',
			duration_ms: 3000,
		});
	});

	it.each([
		['items left in flight', { inFlightPending: 2 }],
		['an unfinished settle walk', { settleComplete: false }],
	])('is WARNING with %s, which are never deleted blindly', (_label, overrides) => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, {
			...completed,
			...overrides,
		});
		expect(evidence.status).toBe('WARNING');
		expect(evidence.reasonCode).toBe('cleanup_in_flight_backlog');
		expect(evidence.payload.count_invariant_valid).toBe(true);
	});

	it('is WARNING when some deletions failed but counts still add up', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, {
			...completed,
			deleted: 3,
			failed: 1,
		});
		expect(evidence.status).toBe('WARNING');
		expect(evidence.reasonCode).toBe('cleanup_partial_failure');
		expect(evidence.payload.count_invariant_valid).toBe(true);
	});

	it('is FAILED when claimed differs from deleted plus failed', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, {
			...completed,
			deleted: 3,
			failed: 0,
		});
		expect(evidence.status).toBe('FAILED');
		expect(evidence.reasonCode).toBe('cleanup_count_invariant_failed');
		expect(evidence.payload.count_invariant_valid).toBe(false);
	});

	it('carries the environment and correlation ids from the context', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, completed);
		expect(evidence.environment).toBe('preview');
		expect(evidence.check).toBe('memories_cleanup');
		expect(evidence.source).toBe('vercel_cron');
		expect(evidence.runId).toBe(context.runId);
		expect(evidence.commitSha).toBe('a'.repeat(40));
		expect(evidence.deploymentId).toBe('dpl_1234567890');
		expect(
			createMemoriesCleanupCompletedEvidence(
				{ ...context, environment: 'production' },
				completed,
			).environment,
		).toBe('production');
	});

	it('drops malformed commit and deployment identifiers instead of failing', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(
			{ ...context, commitSha: 'not-a-sha', deploymentId: 'dpl with spaces' },
			completed,
		);
		expect(evidence).not.toHaveProperty('commitSha');
		expect(evidence).not.toHaveProperty('deploymentId');
	});

	it('uses only approved payload keys and passes the safety guard', () => {
		const evidence = createMemoriesCleanupCompletedEvidence(context, completed);
		for (const key of Object.keys(evidence.payload)) {
			expect(key).not.toMatch(FORBIDDEN_PAYLOAD_KEY_PATTERN);
		}
		expect(() => assertOperationalEvidenceSafe(evidence)).not.toThrow();
		expect(() =>
			serializeOperationalEvidenceEvent(MEMORIES_CLEANUP_EVENT_NAME, 'completed', evidence),
		).not.toThrow();
	});
});

describe('started and failed cleanup evidence', () => {
	it('starts UNVERIFIED with empty metrics and no completion time', () => {
		const evidence = createMemoriesCleanupStartedEvidence({ ...context, completedAt: null });
		expect(evidence.status).toBe('UNVERIFIED');
		expect(evidence.reasonCode).toBe('cleanup_started');
		expect(evidence.completedAt).toBeNull();
		expect(evidence.observedAt).toBe(context.startedAt);
		expect(evidence.payload.claimed).toBeNull();
		expect(evidence.payload.count_invariant_valid).toBeNull();
		expect(evidence.payload.duration_ms).toBe(0);
		expect(() => assertOperationalEvidenceSafe(evidence)).not.toThrow();
	});

	it('records exceptions as FAILED without leaking identifiers or URLs', () => {
		const evidence = createMemoriesCleanupFailedEvidence(context);
		expect(evidence.status).toBe('FAILED');
		expect(evidence.reasonCode).toBe('cleanup_exception');
		expect(evidence.environment).toBe('preview');
		const serialized = serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'completed',
			evidence,
		);
		expect(serialized).toContain('cleanup_exception');
		expect(serialized).not.toContain('https://');
		expect(serialized).not.toContain('object_key');
	});
});
