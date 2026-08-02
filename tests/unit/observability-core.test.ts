import { describe, expect, it } from '@jest/globals';
import {
	aggregateDeliveryStatus,
	aggregateOperationalStatus,
	comparisonToDeliveryStatus,
} from '../../scripts/observability/overall-status.ts';
import { classifyValidationFreshness } from '../../scripts/observability/validation-evidence.ts';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';

describe('observability deterministic aggregation', () => {
	it('applies operational precedence BLOCKED > UNVERIFIED > ATTENTION > HEALTHY', () => {
		expect(aggregateOperationalStatus(['HEALTHY', 'ATTENTION'])).toBe('ATTENTION');
		expect(aggregateOperationalStatus(['ATTENTION', 'UNVERIFIED'])).toBe('UNVERIFIED');
		expect(aggregateOperationalStatus(['UNVERIFIED', 'BLOCKED'])).toBe('BLOCKED');
	});

	it('applies delivery precedence ACTION_REQUIRED > UNVERIFIED > IN_PROGRESS > ALIGNED', () => {
		expect(aggregateDeliveryStatus(['ALIGNED', 'IN_PROGRESS'])).toBe('IN_PROGRESS');
		expect(aggregateDeliveryStatus(['IN_PROGRESS', 'UNVERIFIED'])).toBe('UNVERIFIED');
		expect(aggregateDeliveryStatus(['UNVERIFIED', 'ACTION_REQUIRED'])).toBe('ACTION_REQUIRED');
	});

	it('maps drift and scope blocking to action-required delivery without degrading health', () => {
		expect(comparisonToDeliveryStatus({ outcome: 'DRIFT' })).toBe('ACTION_REQUIRED');
		expect(comparisonToDeliveryStatus({ outcome: 'DELIVERY_SCOPE_BLOCKED' })).toBe(
			'ACTION_REQUIRED',
		);
	});
});

describe('observability evidence is independent from operational health', () => {
	it('still classifies stale regression evidence without using it as health input', () => {
		const result = classifyValidationFreshness(
			{
				schemaVersion: 1,
				validationType: 'regression',
				command: 'pnpm test:local-render-corpus',
				startedAt: '2026-08-01T00:00:00.000Z',
				completedAt: '2026-08-01T00:01:00.000Z',
				status: 'pass',
				branch: 'dev-local',
				commitSha: 'abc',
				workingTreeDirty: false,
				inputFingerprint: 'old',
				corpusFingerprint: 'corpus',
				total: 13,
				passed: 13,
				failed: 0,
				failures: [],
				artifactLocation: '.tmp/observability/validation/regression.json',
			},
			{ inputFingerprint: 'current', corpusFingerprint: 'corpus' },
			{
				branch: 'dev-local',
				commitSha: 'abc',
				workingTreeDirty: false,
				degraded: false,
			},
		);
		expect(result).toBe('STALE');
	});
});

describe('observability corpus authority', () => {
	it('marks every legacy remote-parity exclusion explicitly', () => {
		const legacy = listLocalRenderCorpus().filter((entry) => entry.classification === 'legacy');
		expect(legacy.length).toBeGreaterThan(0);
		expect(legacy.every((entry) => entry.remoteParity === 'excluded')).toBe(true);
	});
});
