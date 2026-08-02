import { describe, expect, it } from '@jest/globals';
import { ObservabilitySnapshotSchema } from '@/lib/observability/schema';
import { finalizeObservabilitySnapshot } from '../../scripts/observability/public-snapshot.ts';

describe('public observability snapshot v3', () => {
	it('orders environments, issues, work items, invitations, and semantic paths deterministically', () => {
		const result = finalizeObservabilitySnapshot({
			generatedAt: '2026-08-01T12:00:00.000Z',
			freshness: 'FRESH',
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'IN_PROGRESS',
			reporting: {
				schemaVersion: 1,
				snapshotId: 'observability-test',
				evidenceFingerprint: 'b'.repeat(64),
				generatedAt: '2026-08-01T12:00:00.000Z',
				commitSha: 'b'.repeat(40),
				databaseTargets: {
					local: 'persistent-local',
					preview: 'preview',
					production: 'production',
				},
				invitationClassifications: [],
				issueKeys: [],
				workItemKeys: [],
			},
			coverage: [
				{ environment: 'local', status: 'AVAILABLE' },
				{ environment: 'preview', status: 'AVAILABLE' },
				{ environment: 'production', status: 'AVAILABLE' },
			],
			cache: { refreshAfter: '2026-08-01T12:01:00.000Z' },
			issues: [],
			workItems: [
				{
					impact: 'DELIVERY',
					reasonCode: 'CANONICAL_CHANGE_PENDING',
					nextStep: 'APPLY_LOCAL',
					operationalStatus: 'HEALTHY',
					deliveryStatus: 'IN_PROGRESS',
					detailStatus: 'AVAILABLE',
					affectedFieldCount: 2,
					affectedSectionCount: 1,
					semanticPaths: [
						'hero.title',
						'hero.subtitle',
						'hero.title',
						'guestConfirmations[0].phone',
					],
					slug: 'zeta',
					lifecycle: 'published',
				},
			],
			environmentSummaries: ['production', 'local', 'preview'].map((environment) => ({
				environment: environment as 'local' | 'preview' | 'production',
				operationalStatus: 'HEALTHY' as const,
				deliveryStatus: 'ALIGNED' as const,
				coverage: 'AVAILABLE' as const,
				counts: { invitations: 1, issues: 0, workItems: 0 },
			})),
			invitationSummaries: [
				{
					slug: 'zeta',
					lifecycle: 'published',
					operationalStatus: 'HEALTHY',
					deliveryStatus: 'IN_PROGRESS',
					comparisons: [],
				},
				{
					slug: 'alfa',
					lifecycle: 'published',
					operationalStatus: 'HEALTHY',
					deliveryStatus: 'ALIGNED',
					comparisons: [],
				},
			],
		});
		expect(result.environmentSummaries.map((item) => item.environment)).toEqual([
			'local',
			'preview',
			'production',
		]);
		expect(result.invitationSummaries.map((item) => item.slug)).toEqual(['alfa', 'zeta']);
		expect(result.workItems[0]?.semanticPaths).toEqual(['hero.subtitle', 'hero.title']);
		expect(ObservabilitySnapshotSchema.parse(result)).toEqual(result);
	});

	it('rejects field values, UUIDs, hashes, URLs, commands, and unmanaged extra evidence', () => {
		const base = {
			schemaVersion: 3,
			generatedAt: '2026-08-01T12:00:00.000Z',
			freshness: 'FRESH',
			operationalStatus: 'HEALTHY',
			deliveryStatus: 'ALIGNED',
			reporting: {
				schemaVersion: 1,
				snapshotId: 'observability-test',
				evidenceFingerprint: 'b'.repeat(64),
				generatedAt: '2026-08-01T12:00:00.000Z',
				commitSha: 'b'.repeat(40),
				databaseTargets: {
					local: 'persistent-local',
					preview: 'preview',
					production: 'production',
				},
				invitationClassifications: [],
				issueKeys: [],
				workItemKeys: [],
			},
			coverage: [
				{ environment: 'local', status: 'AVAILABLE' },
				{ environment: 'preview', status: 'AVAILABLE' },
				{ environment: 'production', status: 'AVAILABLE' },
			],
			cache: { refreshAfter: '2026-08-01T12:01:00.000Z' },
			issues: [],
			workItems: [],
			environmentSummaries: [],
			invitationSummaries: [],
		};
		for (const forbidden of ['value', 'uuid', 'hash', 'url', 'command', 'rawError']) {
			expect(() =>
				ObservabilitySnapshotSchema.parse({ ...base, [forbidden]: 'secret' }),
			).toThrow();
		}
	});
});
