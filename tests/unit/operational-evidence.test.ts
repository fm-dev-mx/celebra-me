import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	serializeOperationalEvidenceEvent,
	type OperationalEvidenceV1,
} from '@/lib/operations/operational-evidence';

function evidence(
	payload: Record<string, string | number | boolean | null> = {
		count: 1,
		optional_count: null,
	},
): OperationalEvidenceV1 {
	return {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'sample_check',
		environment: 'preview',
		runId: '018f7b77-80f8-7bd1-8f87-70d0b5312e2f',
		startedAt: '2026-08-31T12:00:00.000Z',
		completedAt: '2026-08-31T12:00:01.000Z',
		observedAt: '2026-08-31T12:00:01.000Z',
		status: 'VERIFIED',
		reasonCode: 'sample_completed',
		source: 'versioned_detector',
		ownerAction: 'No se requiere acción.',
		commitSha: 'a'.repeat(40),
		deploymentId: 'dpl_1234567890',
		payload,
	};
}

describe('OperationalEvidenceV1', () => {
	it('serializes a versioned low-cardinality event while preserving missing metrics as null', () => {
		const serialized = serializeOperationalEvidenceEvent(
			'operational_summary',
			'completed',
			evidence(),
		);
		const parsed = JSON.parse(serialized) as { evidence: OperationalEvidenceV1 };

		expect(parsed.evidence.schemaVersion).toBe(1);
		expect(parsed.evidence.payload.optional_count).toBeNull();
		expect(parsed.evidence.commitSha).toBe('a'.repeat(40));
	});

	it.each([
		[{ invitation_slug: 'client-event' }, 'payload key'],
		[{ endpoint: 'https://example.com/api?token=secret' }, 'payload value'],
		[{ cookie_value: 'abc' }, 'payload key'],
	] as const)('rejects sensitive or high-cardinality %s', (payload, expected) => {
		expect(() => assertOperationalEvidenceSafe(evidence(payload))).toThrow(expected);
	});
});
