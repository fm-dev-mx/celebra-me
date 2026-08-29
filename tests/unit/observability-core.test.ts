import { describe, expect, it } from '@jest/globals';
import { classifyValidationFreshness } from '../../scripts/observability/validation-evidence.ts';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';

describe('validation evidence is independent from operational status', () => {
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

describe('corpus authority', () => {
	it('marks every canonical corpus entry as required for remote parity', () => {
		const corpus = listLocalRenderCorpus();
		expect(corpus.length).toBeGreaterThan(0);
		expect(corpus.every((entry) => entry.classification === 'canonical')).toBe(true);
		expect(corpus.every((entry) => entry.remoteParity === 'required')).toBe(true);
	});
});
