import { describe, expect, it } from '@jest/globals';
import {
	assembleSnapshotFromEvidence,
	type CanonicalObservation,
	type SnapshotEvidence,
} from '../../scripts/observability/snapshot.ts';
import type { InvitationDatabaseProjection } from '../../scripts/observability/database-projection.ts';
import { RELEASE_SCHEMA_VERSION } from '../../scripts/provision/normalized-invitation-release.ts';

function canonical(
	slug = 'boda-perla-y-carlos',
	lifecycle: CanonicalObservation['lifecycle'] = 'in_progress',
): CanonicalObservation {
	return {
		slug,
		lifecycle,
		deliveryScope: 'content-and-assets',
		packageHash: 'current-hash',
		managedContent: { hero: { title: 'Perla y Carlos' } },
		metadata: {
			eventType: 'boda',
			kind: 'client',
			baseDemoId: '',
			themeId: 'luxury-hacienda',
			snapshot: {},
			clientName: 'Perla y Carlos',
		},
		assets: [],
	};
}

function receipt() {
	return {
		operationId: 'op-1',
		status: 'applied' as const,
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_local',
		completedSteps: ['provenance_recorded', 'projection_stored'],
	};
}

function localRow(slug = 'boda-perla-y-carlos'): InvitationDatabaseProjection {
	return {
		slug,
		invitationId: 'inv-1',
		draftStatus: 'approved',
		draftUpdatedAt: '2026-08-01T00:00:00.000Z',
		draftContent: null,
		detailRequired: false,
		detailBudgetExceeded: false,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		managedAssetKeys: [],
		managedAssets: [],
		metadata: {
			eventType: 'boda',
			kind: 'client',
			baseDemoId: null,
			themeId: 'luxury-hacienda',
			snapshot: {},
			clientName: 'Perla y Carlos',
			createdBy: 'owner-id',
		},
		event: { slug, eventType: 'boda', ownerUserId: 'owner-id' },
		provenance: {
			definitionSlug: slug,
			releaseSchemaVersion: RELEASE_SCHEMA_VERSION,
			packageHash: 'current-hash',
			managedProjection: { hero: { title: 'Perla y Carlos' } },
			hasManagedProjection: true,
			appliedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
			appliedOperationId: 'op-1',
			appliedPublishedVersion: 1,
			appliedPublishedProjectionHash: 'hash',
			appliedReceipt: receipt(),
			latestReceipt: receipt(),
		},
	};
}

function evidence(): SnapshotEvidence {
	const c = canonical();
	return {
		generatedAt: '2026-08-02T12:00:00.000Z',
		probeScope: 'all',
		canonical: [c],
		canonicalFailures: [],
		legacy: [],
		projections: {
			local: {
				environment: 'local',
				configured: true,
				reachable: true,
				targetClassification: 'persistent-local',
				activeInvitationRows: 1,
				identityConflictsCount: 0,
				rows: [localRow()],
				failure: null,
			},
			preview: {
				environment: 'preview',
				configured: true,
				reachable: true,
				targetClassification: 'preview',
				activeInvitationRows: 0,
				identityConflictsCount: 0,
				rows: [],
				failure: null,
			},
			production: {
				environment: 'production',
				configured: true,
				reachable: true,
				targetClassification: 'production',
				activeInvitationRows: 0,
				identityConflictsCount: 0,
				rows: [],
				failure: null,
			},
		},
		migrations: {
			local: {
				environment: 'local',
				available: true,
				schemaLifecycle: 'CURRENT',
				appliedCount: 20,
				pendingCount: 0,
			},
			preview: {
				environment: 'preview',
				available: true,
				schemaLifecycle: 'CURRENT',
				appliedCount: 20,
				pendingCount: 0,
			},
			production: {
				environment: 'production',
				available: true,
				schemaLifecycle: 'CURRENT',
				appliedCount: 20,
				pendingCount: 0,
			},
		},
	};
}

describe('Observability Delivery Consolidation', () => {
	it('consolidates in-progress delivery pipeline for Perla into exactly ONE work item for preview when Preview is pending', () => {
		const snapshot = assembleSnapshotFromEvidence(evidence());

		const perlaWorkItems = snapshot.workItems.filter(
			(item) => item.slug === 'boda-perla-y-carlos',
		);
		expect(perlaWorkItems).toHaveLength(1);
		const workItem = perlaWorkItems[0]!;
		expect(workItem.environment).toBe('preview');
		expect(workItem.nextStep).toBe('PROMOTE_PREVIEW');
		expect(workItem.reasonCode).toBe('PARTIAL_PROMOTION');

		const perlaSummary = snapshot.invitationSummaries.find(
			(s) => s.slug === 'boda-perla-y-carlos',
		)!;
		const previewComparison = perlaSummary.comparisons.find(
			(c) => c.environment === 'preview',
		)!;
		const productionComparison = perlaSummary.comparisons.find(
			(c) => c.environment === 'production',
		)!;
		expect(previewComparison.outcome).toBe('APPLY');
		expect(productionComparison.outcome).toBe('APPLY');
	});

	it('emits PROMOTE_PRODUCTION when Preview is aligned but Production is pending', () => {
		const ev = evidence();
		ev.projections.preview.rows = [localRow('boda-perla-y-carlos')];
		const snapshot = assembleSnapshotFromEvidence(ev);

		const perlaWorkItems = snapshot.workItems.filter(
			(item) => item.slug === 'boda-perla-y-carlos',
		);
		expect(perlaWorkItems).toHaveLength(1);
		const workItem = perlaWorkItems[0]!;
		expect(workItem.environment).toBe('production');
		expect(workItem.nextStep).toBe('PROMOTE_PRODUCTION');
		expect(workItem.reasonCode).toBe('PARTIAL_PROMOTION');
	});

	it('requires Preview verification when Preview is unavailable', () => {
		const ev = evidence();
		ev.projections.preview.reachable = false;
		ev.projections.preview.failure = 'credentials_required';
		const snapshot = assembleSnapshotFromEvidence(ev);

		const perlaWorkItems = snapshot.workItems.filter(
			(item) => item.slug === 'boda-perla-y-carlos',
		);
		expect(perlaWorkItems).toHaveLength(1);
		const workItem = perlaWorkItems[0]!;
		expect(workItem.environment).toBe('preview');
		expect(workItem.nextStep).toBe('VERIFY_PREVIEW');
		expect(workItem.reasonCode).toBe('PREVIEW_VERIFICATION_REQUIRED');
	});
});
