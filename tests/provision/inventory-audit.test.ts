import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// DB-layer mocks — the audit engine itself is exercised for real, only the
// environment database projection is replaced with deterministic fixtures.
// ---------------------------------------------------------------------------

const mockReadProjection = jest.fn<
	(input: { environment: string }) => EnvironmentDatabaseProjection
>();

jest.mock('../../scripts/observability/database-projection.ts', () => ({
	ObservabilityInvocationBudget: class {
		#used = 0;
		consume(): void {
			this.#used += 1;
		}
		get used(): number {
			return this.#used;
		}
	},
	readEnvironmentDatabaseProjection: (input: unknown) =>
		mockReadProjection(input as { environment: string }),
}));

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	resolveDbUrlForEnv: (environment: string) => ({ dbUrl: `postgres://fixture-${environment}` }),
}));

import type {
	EnvironmentDatabaseProjection,
	InvitationDatabaseProjection,
} from '../../scripts/observability/database-projection.ts';
import type { ManagedBaselineReceiptEvidence } from '../../scripts/provision/managed-merge-baseline.ts';
import { RELEASE_SCHEMA_VERSION } from '../../scripts/provision/normalized-invitation-release.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';
import {
	classifySlugCategory,
	runInventoryAudit,
} from '../../scripts/provision/inventory-audit.ts';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const VERIFIED_RECEIPT: ManagedBaselineReceiptEvidence = {
	operationId: '11111111-1111-4111-8111-111111111111',
	status: 'applied',
	commandKind: 'managed_invitation_apply',
	origin: 'managed_cli_hosted',
	completedSteps: ['target_verified', 'provenance_recorded'],
};

function emptyProvenance(): InvitationDatabaseProjection['provenance'] {
	return {
		definitionSlug: null,
		releaseSchemaVersion: null,
		packageHash: null,
		managedProjection: null,
		hasManagedProjection: false,
		appliedDraftUpdatedAt: null,
		appliedOperationId: null,
		appliedPublishedVersion: null,
		appliedPublishedProjectionHash: null,
		appliedReceipt: null,
		latestReceipt: null,
	};
}

function verifiedProvenance(definitionSlug: string): InvitationDatabaseProjection['provenance'] {
	return {
		definitionSlug,
		releaseSchemaVersion: RELEASE_SCHEMA_VERSION,
		packageHash: 'a'.repeat(64),
		managedProjection: { title: 'fixture' },
		hasManagedProjection: true,
		appliedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
		appliedOperationId: VERIFIED_RECEIPT.operationId,
		appliedPublishedVersion: 1,
		appliedPublishedProjectionHash: 'b'.repeat(64),
		appliedReceipt: VERIFIED_RECEIPT,
		latestReceipt: VERIFIED_RECEIPT,
	};
}

function row(
	slug: string,
	provenance: InvitationDatabaseProjection['provenance'],
): InvitationDatabaseProjection {
	return {
		slug,
		invitationId: `00000000-0000-4000-8000-${slug.length}`,
		draftStatus: 'published',
		draftUpdatedAt: '2026-08-01T00:00:00.000Z',
		draftContent: { title: 'fixture' },
		detailRequired: false,
		detailBudgetExceeded: false,
		publishedVersion: 1,
		publishedAt: '2026-08-01T00:00:00.000Z',
		assetCount: 0,
		managedAssetKeys: [],
		managedAssets: [],
		metadata: {
			eventType: 'xv',
			kind: 'client',
			baseDemoId: null,
			themeId: 'premiere-floral',
			snapshot: null,
			clientName: 'Fixture Client',
			createdBy: '11111111-1111-4111-8111-111111111111',
		},
		event: { slug, eventType: 'xv', ownerUserId: '11111111-1111-4111-8111-111111111111' },
		provenance,
	};
}

function projection(
	environment: string,
	activeInvitationRows: number,
	rows: InvitationDatabaseProjection[],
): EnvironmentDatabaseProjection {
	return {
		environment: environment as EnvironmentDatabaseProjection['environment'],
		configured: true,
		reachable: true,
		targetClassification: 'fixture',
		activeInvitationRows,
		identityConflictsCount: 0,
		rows,
		failure: null,
	};
}

function installProjectionFixtures(): void {
	mockReadProjection.mockImplementation((input: { environment: string }) => {
		const env = input.environment;
		if (env === 'local') {
			return projection('local', 25, [
				row('abril-michelle-becerra-rea', verifiedProvenance('abril-michelle-becerra-rea')),
				row('romina-rios-chaparro', verifiedProvenance('romina-rios-chaparro')),
				row('alba-rosa-quinonez', verifiedProvenance('alba-rosa-quinonez')),
			]);
		}
		if (env === 'preview') {
			return projection('preview', 26, [
				row('abril-michelle-becerra-rea', verifiedProvenance('abril-michelle-becerra-rea')),
				row('romina-rios-chaparro', verifiedProvenance('romina-rios-chaparro')),
				row('alba-rosa-quinonez', verifiedProvenance('alba-rosa-quinonez')),
				row('alba-rosa-quinones', emptyProvenance()),
				row('e2e-preview-publication', emptyProvenance()),
			]);
		}
		return projection('production', 24, [
			row('abril-michelle-becerra-rea', verifiedProvenance('abril-michelle-becerra-rea')),
			row('romina-rios-chaparro', verifiedProvenance('romina-rios-chaparro')),
			row('alba-rosa-quinonez', verifiedProvenance('alba-rosa-quinonez')),
		]);
	});
}

describe('Inventory Audit & Parity Engine (scripts/provision/inventory-audit.ts)', () => {
	describe('classifySlugCategory', () => {
		it('classifies registered canonical definitions correctly by lifecycle', () => {
			expect(classifySlugCategory('abril-michelle-becerra-rea', true, 'published')).toBe(
				'canonical_published',
			);
			expect(classifySlugCategory('boda-perla-y-carlos', true, 'in_progress')).toBe(
				'canonical_in_progress',
			);
		});

		it('classifies local render corpus legacy entries', () => {
			expect(classifySlugCategory('america-johana', false, undefined, true)).toBe(
				'legacy_corpus',
			);
			expect(classifySlugCategory('leah-lexa', false, undefined, true)).toBe('legacy_corpus');
		});

		it('classifies preview E2E test fixture', () => {
			expect(classifySlugCategory('e2e-preview-publication', false, undefined, false)).toBe(
				'preview_e2e_fixture',
			);
		});

		it('classifies legacy typo alias', () => {
			expect(classifySlugCategory('alba-rosa-quinones', false, undefined, false)).toBe(
				'legacy_typo_alias',
			);
		});

		it('classifies demo invitations', () => {
			expect(
				classifySlugCategory('demo-xv-jewelry-box', false, undefined, false, 'demo'),
			).toBe('demo');
			expect(
				classifySlugCategory('demo-boda-jewelry-box-wedding', false, undefined, false),
			).toBe('demo');
		});

		it('classifies unmanaged rows', () => {
			expect(
				classifySlugCategory('some-random-slug', false, undefined, false, 'client'),
			).toBe('unmanaged');
		});
	});

	describe('runInventoryAudit', () => {
		beforeEach(() => {
			installProjectionFixtures();
		});

		it('executes read-only inventory audit against the projection fixtures', () => {
			const audit = runInventoryAudit();

			expect(audit.generatedAt).toBeDefined();
			// Registry-derived counts: never hardcode definitions/corpus sizes.
			const canonical = listInvitationDefinitions();
			const corpus = listLocalRenderCorpus();
			expect(audit.summary.repoCanonicalCount).toBe(canonical.length);
			expect(audit.summary.repoCanonicalPublishedCount).toBe(
				canonical.filter((def) => def.lifecycle === 'published').length,
			);
			expect(audit.summary.repoCanonicalInProgressCount).toBe(
				canonical.filter((def) => def.lifecycle === 'in_progress').length,
			);
			expect(audit.summary.localRenderCorpusCount).toBe(corpus.length);
			expect(audit.summary.observedScopeCount).toBe(
				new Set([...canonical.map((def) => def.slug), ...corpus.map((entry) => entry.slug)])
					.size,
			);

			// Fixture-driven environment totals
			expect(audit.summary.environments.local.totalActiveRows).toBe(25);
			expect(audit.summary.environments.preview.totalActiveRows).toBe(26);
			expect(audit.summary.environments.production.totalActiveRows).toBe(24);

			// Check specific row classifications in the output matrix
			const perla = audit.rows.find((r) => r.slug === 'boda-perla-y-carlos');
			expect(perla).toBeDefined();
			expect(perla?.category).toBe('canonical_in_progress');
			expect(perla?.deliveryState).toBe('IN_PROGRESS');

			const abril = audit.rows.find((r) => r.slug === 'abril-michelle-becerra-rea');
			expect(abril).toBeDefined();
			expect(abril?.category).toBe('canonical_published');
			expect(abril?.deliveryState).toBe('ALIGNED');
			expect(abril?.environments.production.hasProvenance).toBe(true);

			const romina = audit.rows.find((r) => r.slug === 'romina-rios-chaparro');
			expect(romina).toBeDefined();
			expect(romina?.category).toBe('canonical_published');
			expect(romina?.deliveryState).toBe('ALIGNED');
			expect(romina?.environments.production.hasProvenance).toBe(true);

			const alba = audit.rows.find((r) => r.slug === 'alba-rosa-quinonez');
			expect(alba).toBeDefined();
			expect(alba?.category).toBe('canonical_published');
			expect(alba?.deliveryState).toBe('ALIGNED');
			expect(alba?.environments.production.hasProvenance).toBe(true);

			const typo = audit.rows.find((r) => r.slug === 'alba-rosa-quinones');
			expect(typo).toBeDefined();
			expect(typo?.category).toBe('legacy_typo_alias');
			expect(typo?.environments.preview.present).toBe(true);
			expect(typo?.environments.local.present).toBe(false);

			const fixture = audit.rows.find((r) => r.slug === 'e2e-preview-publication');
			expect(fixture).toBeDefined();
			expect(fixture?.category).toBe('preview_e2e_fixture');
			expect(fixture?.environments.preview.present).toBe(true);
		});

		it('reports a canonical published invitation missing from production as UNVERIFIED', () => {
			// Production fixture omits 'romina-rios-chaparro' this time.
			mockReadProjection.mockImplementation((input: { environment: string }) => {
				if (input.environment === 'production') {
					return projection('production', 23, [
						row(
							'abril-michelle-becerra-rea',
							verifiedProvenance('abril-michelle-becerra-rea'),
						),
						row('alba-rosa-quinonez', verifiedProvenance('alba-rosa-quinonez')),
					]);
				}
				return projection(input.environment as 'local' | 'preview', 25, [
					row('romina-rios-chaparro', verifiedProvenance('romina-rios-chaparro')),
				]);
			});

			const audit = runInventoryAudit();
			const romina = audit.rows.find((r) => r.slug === 'romina-rios-chaparro');

			expect(romina).toBeDefined();
			expect(romina?.category).toBe('canonical_published');
			expect(romina?.environments.production.present).toBe(false);
			expect(romina?.deliveryState).toBe('UNVERIFIED');
		});
	});
});
