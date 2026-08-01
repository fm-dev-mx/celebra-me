jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	runPsql: jest.fn((_sql: string, dbUrl: string) => ({
		status: 0,
		stdout: JSON.stringify({
			activeInvitationRows: 1,
			rows: [
				{
					slug: 'sample',
					activeCount: 1,
					resolvedId: '00000000-0000-0000-0000-000000000001',
					provenanceHash: 'hash',
					publishedVersion: 1,
					publishedAt: '2026-08-01T00:00:00.000Z',
					publishedContent: dbUrl === 'local' ? { title: 'sample' } : null,
					draftStatus: null,
					draftUpdatedAt: null,
					assetCount: 1,
				},
			],
		}),
	})),
	sqlLiteral: (value: string) => `'${value}'`,
}));
jest.mock('../../scripts/provision/dbs-status.ts', () => ({
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

import { describe, expect, it, jest } from '@jest/globals';
import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { evaluateInvitationHealth } from '../../scripts/observability/invitation-health.ts';

describe('observability batch probes', () => {
	it('uses one operational query per configured environment', async () => {
		const result = await evaluateInvitationHealth();
		expect(runPsql).toHaveBeenCalledTimes(3);
		expect(result.probeCount).toBe(3);
		expect(result.invitations[0]?.environments.local.status).toBe('MATCH_CANONICAL');
	});
});
