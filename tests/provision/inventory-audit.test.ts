import { jest } from '@jest/globals';

const mockReadEvidence = jest.fn<
	(
		session: unknown,
		dbUrl: string,
		slugs: readonly string[],
	) => Promise<{
		ok: boolean;
		rows: LiveInvitationEvidenceRow[];
		activeInvitationRows: number;
		identityConflictsCount: number;
	}>
>();

jest.mock('../../scripts/status-core/index.ts', () => ({
	StatusProbeSession: class {
		invocations = 0;
		memoHits = 0;
	},
	readGroupedPromotionalEvidence: (session: unknown, dbUrl: string, slugs: readonly string[]) =>
		mockReadEvidence(session, dbUrl, slugs),
}));

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	resolveDbUrlForEnv: (environment: string) => ({ dbUrl: `postgres://fixture-${environment}` }),
}));

import type { LiveInvitationEvidenceRow } from '../../scripts/status-core/promotional-evidence.ts';
import type { ManagedBaselineReceiptEvidence } from '../../scripts/provision/managed-merge-baseline.ts';
import { RELEASE_SCHEMA_VERSION } from '../../scripts/provision/normalized-invitation-release.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';
import {
	classifySlugCategory,
	runInventoryAudit,
} from '../../scripts/provision/inventory-audit.ts';

const VERIFIED_RECEIPT: ManagedBaselineReceiptEvidence = {
	operationId: '11111111-1111-4111-8111-111111111111',
	status: 'applied',
	commandKind: 'managed_invitation_apply',
	origin: 'managed_cli_hosted',
	completedSteps: ['target_verified', 'provenance_recorded'],
};

function emptyRow(slug: string): LiveInvitationEvidenceRow {
	return {
		slug,
		eventType: 'xv',
		kind: 'client',
		baseDemoId: null,
		themeId: 'premiere-floral',
		snapshot: null,
		managedIdentityId: null,
		definitionSlug: null,
		clientName: 'Fixture Client',
		draftContent: { title: 'fixture' },
		publishedContent: { title: 'fixture' },
		publishedVersion: 1,
		assets: [],
		packageHash: null,
		releaseSchemaVersion: null,
		hasManagedProjection: false,
		appliedDraftUpdatedAt: null,
		appliedOperationId: null,
		appliedPublishedVersion: null,
		appliedPublishedProjectionHash: null,
		appliedReceipt: null,
		latestReceipt: null,
		managedProjection: null,
		detailBudgetExceeded: false,
	};
}

function verifiedRow(slug: string): LiveInvitationEvidenceRow {
	return {
		...emptyRow(slug),
		definitionSlug: slug,
		packageHash: 'a'.repeat(64),
		releaseSchemaVersion: RELEASE_SCHEMA_VERSION,
		hasManagedProjection: true,
		managedProjection: { title: 'fixture' },
		appliedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
		appliedOperationId: VERIFIED_RECEIPT.operationId,
		appliedPublishedVersion: 1,
		appliedPublishedProjectionHash: 'b'.repeat(64),
		appliedReceipt: VERIFIED_RECEIPT,
		latestReceipt: VERIFIED_RECEIPT,
	};
}

function evidence(activeInvitationRows: number, rows: LiveInvitationEvidenceRow[]) {
	return {
		ok: true,
		rows,
		activeInvitationRows,
		identityConflictsCount: 0,
	};
}

function installEvidenceFixtures(): void {
	mockReadEvidence.mockImplementation(async (_session, dbUrl) => {
		if (dbUrl.includes('local')) {
			return evidence(25, [
				verifiedRow('abril-michelle-becerra-rea'),
				verifiedRow('romina-rios-chaparro'),
				verifiedRow('alba-rosa-quinonez'),
				verifiedRow('daniela-y-martin'),
				verifiedRow('victoria-y-roberto'),
			]);
		}
		if (dbUrl.includes('preview')) {
			return evidence(26, [
				verifiedRow('abril-michelle-becerra-rea'),
				verifiedRow('romina-rios-chaparro'),
				verifiedRow('alba-rosa-quinonez'),
				verifiedRow('daniela-y-martin'),
				verifiedRow('victoria-y-roberto'),
				emptyRow('alba-rosa-quinones'),
				emptyRow('e2e-preview-publication'),
			]);
		}
		return evidence(24, [
			verifiedRow('abril-michelle-becerra-rea'),
			verifiedRow('romina-rios-chaparro'),
			verifiedRow('alba-rosa-quinonez'),
			verifiedRow('daniela-y-martin'),
			verifiedRow('victoria-y-roberto'),
		]);
	});
}

describe('Inventory Audit & Parity Engine (scripts/provision/inventory-audit.ts)', () => {
	describe('classifySlugCategory', () => {
		it('classifies registered canonical definitions correctly by lifecycle', () => {
			expect(classifySlugCategory('abril-michelle-becerra-rea', true, 'published')).toBe(
				'canonical_published',
			);
			expect(classifySlugCategory('daniela-y-martin', true, 'in_progress')).toBe(
				'canonical_in_progress',
			);
		});

		it('does not create a second category for corpus entries', () => {
			expect(classifySlugCategory('america-johana', false, undefined, true)).toBe(
				'unmanaged',
			);
			expect(classifySlugCategory('leah-lexa', false, undefined, true)).toBe('unmanaged');
		});

		it('classifies preview E2E test fixture', () => {
			expect(classifySlugCategory('e2e-preview-publication', false, undefined, false)).toBe(
				'preview_e2e_fixture',
			);
		});

		it('classifies an unregistered historical alias as unmanaged', () => {
			expect(classifySlugCategory('alba-rosa-quinones', false, undefined, false)).toBe(
				'unmanaged',
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
			installEvidenceFixtures();
		});

		it('executes read-only inventory audit against the projection fixtures', async () => {
			const audit = await runInventoryAudit();

			expect(audit.generatedAt).toBeDefined();
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

			expect(audit.summary.environments.local.totalActiveRows).toBe(25);
			expect(audit.summary.environments.preview.totalActiveRows).toBe(26);
			expect(audit.summary.environments.production.totalActiveRows).toBe(24);

			const daniela = audit.rows.find((r) => r.slug === 'daniela-y-martin');
			expect(daniela).toBeDefined();
			expect(daniela?.category).toBe('canonical_published');
			expect(daniela?.deliveryState).toBe('ALIGNED');

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
			expect(typo?.category).toBe('unmanaged');
			expect(typo?.environments.preview.present).toBe(true);
			expect(typo?.environments.local.present).toBe(false);

			const fixture = audit.rows.find((r) => r.slug === 'e2e-preview-publication');
			expect(fixture).toBeDefined();
			expect(fixture?.category).toBe('preview_e2e_fixture');
			expect(fixture?.environments.preview.present).toBe(true);
		});

		it('does not depend on Observability snapshot assembly', () => {
			const fs = jest.requireActual('fs') as typeof import('node:fs');
			const engine = fs.readFileSync('scripts/provision/inventory-audit.ts', 'utf8');
			const cli = fs.readFileSync('scripts/provision/inventory-audit-cli.ts', 'utf8');
			expect(engine).toContain('readGroupedPromotionalEvidence');
			expect(engine).not.toContain('buildObservabilitySnapshot');
			expect(engine).not.toContain('readEnvironmentDatabaseProjection');
			expect(cli).not.toContain('buildObservabilitySnapshot');
		});

		it('reports a canonical published invitation missing from production as UNVERIFIED', async () => {
			mockReadEvidence.mockImplementation(async (_session, dbUrl) => {
				if (dbUrl.includes('production')) {
					return evidence(23, [
						verifiedRow('abril-michelle-becerra-rea'),
						verifiedRow('alba-rosa-quinonez'),
					]);
				}
				return evidence(25, [verifiedRow('romina-rios-chaparro')]);
			});

			const audit = await runInventoryAudit();
			const romina = audit.rows.find((r) => r.slug === 'romina-rios-chaparro');

			expect(romina).toBeDefined();
			expect(romina?.category).toBe('canonical_published');
			expect(romina?.environments.production.present).toBe(false);
			expect(romina?.deliveryState).toBe('UNVERIFIED');
		});
	});
});
