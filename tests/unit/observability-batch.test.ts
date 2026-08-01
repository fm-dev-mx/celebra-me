jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	withStatusProbeTimeout: (_timeout: number | undefined, run: () => unknown) => run(),
	evaluateBatchTargetStatuses: jest.fn(
		(
			env: string,
			_hashes: Map<string, string | null>,
			_options: { slugs: string[] },
		) => {
			const row = {
				status: 'MATCH_CANONICAL' as const,
				publishedVersion: 1,
				assetCount: 1,
				resolvedId: '00000000-0000-0000-0000-000000000001',
				detail: undefined,
				publishedContent: env === 'local' ? JSON.stringify({ title: 'sample' }) : null,
			};
			return new Map([['sample', row]]);
		},
	),
	evaluateSingleTargetStatus: jest.fn(() => ({
		environment: 'local',
		status: 'MATCH_CANONICAL',
		publishedVersion: 1,
		assetCount: 1,
		resolvedId: '00000000-0000-0000-0000-000000000001',
	})),
	resolveDbUrlForEnv: (env: string) => ({ dbUrl: env }),
}));
jest.mock('../../scripts/provision/local-render-corpus/registry.ts', () => ({
	listLocalRenderCorpus: () => [
		{
			slug: 'sample',
			eventType: 'xv',
			classification: 'canonical',
			assetStrategy: 'VERSIONED_MANAGED_ASSET',
		},
	],
	corpusPublicRoute: () => '/xv/sample',
}));
jest.mock('../../scripts/provision/normalized-invitation-release.ts', () => ({
	buildNormalizedInvitationRelease: jest.fn(async () => ({})),
}));
jest.mock('../../scripts/provision/invitation-package.ts', () => ({
	serializeInvitationPackage: () => ({ packageHash: 'hash' }),
}));
jest.mock('../../scripts/provision/local-render-corpus/load-fixture.ts', () => ({
	loadLegacyCorpusFixture: () => ({ publishedContent: {} }),
}));
jest.mock('../../src/lib/intake/services/publication-diff.service.ts', () => ({
	hashPublicationProjection: () => 'hash',
}));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { evaluateBatchTargetStatuses } from '../../scripts/provision/dbs-status.ts';
import { evaluateInvitationHealth } from '../../scripts/observability/invitation-health.ts';

const mockBatch = evaluateBatchTargetStatuses as jest.MockedFunction<
	typeof evaluateBatchTargetStatuses
>;

describe('observability batch probes', () => {
	beforeEach(() => {
		mockBatch.mockClear();
	});

	it('uses one batched status probe per configured environment', async () => {
		const result = await evaluateInvitationHealth();
		expect(mockBatch).toHaveBeenCalledTimes(3);
		expect(result).toHaveLength(1);
		expect(result[0]?.environments.local.status).toBe('MATCH_CANONICAL');
	});

	it('limits probes to Local when environments option is scoped', async () => {
		const result = await evaluateInvitationHealth({ environments: ['local'] });
		expect(mockBatch).toHaveBeenCalledTimes(1);
		expect(mockBatch.mock.calls[0]?.[0]).toBe('local');
		expect(result[0]?.environments.preview.status).toBe('UNVERIFIED');
		expect(result[0]?.environments.preview.detail).toMatch(/Not probed/);
	});
});
