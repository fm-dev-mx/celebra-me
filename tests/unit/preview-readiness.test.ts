import { describe, expect, it } from '@jest/globals';
import {
	auditInvitationApproval,
	evaluatePreviewReadiness,
	extractInvitationSlugsFromPaths,
	formatPreviewReadinessReport,
	resolveAuditSlugs,
	type PreviewReadinessReport,
} from '../../scripts/ops/preview-readiness.ts';
import type { PreviewApprovalArtifact } from '../../scripts/provision/preview-approval-service.ts';
import type { PreviewApprovalStore } from '../../scripts/provision/preview-approval-store.ts';
import type { PromotionSchemaGateResult } from '../../scripts/provision/invitation-promote.ts';

const NOW = new Date('2026-11-17T12:00:00.000Z');

function createMockStore(artifacts: PreviewApprovalArtifact[] = []): PreviewApprovalStore {
	const map = new Map<string, PreviewApprovalArtifact>();
	for (const a of artifacts) {
		map.set(a.packageHash, a);
	}
	return {
		get(packageHash: string) {
			return map.get(packageHash) ?? null;
		},
		upsert(artifact: PreviewApprovalArtifact) {
			map.set(artifact.packageHash, artifact);
			return artifact;
		},
		findLatestApprovedBySlug(slug: string) {
			const matches = [...map.values()]
				.filter((a) => a.slug === slug && a.approvalState === 'approved')
				.sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''));
			return matches[0] ?? null;
		},
	};
}

const mockPackageData = {
	schemaVersion: '2.1.0',
	packageHash: '1111111111111111111111111111111111111111111111111111111111111111',
	sourceHash: '2222222222222222222222222222222222222222222222222222222222222222',
	metadataHash: '3333333333333333333333333333333333333333333333333333333333333333',
	projectionHash: '44444444444444444444444444444444',
	assetManifestHash: '5555555555555555555555555555555555555555555555555555555555555555',
	definitionCreatedAt: '2026-11-10T00:00:00.000Z',
	sourceSlug: 'test-invitation',
	invitation: {
		slug: 'test-invitation',
		managedIdentityId: 'test-id',
		previousSlugs: [],
		title: 'Test Invitation',
		eventType: 'boda',
		themeId: 'romance',
		kind: 'standard',
		clientName: 'Test Client',
		hostLoginAlias: 'test',
		clientEmail: 'test@example.com',
		clientWhatsapp: '1234567890',
		photosReceived: true,
	},
	draft: { status: 'draft', content: {} },
};

function createValidArtifact(
	overrides: Partial<PreviewApprovalArtifact> = {},
): PreviewApprovalArtifact {
	return {
		schemaVersion: '2.1.0',
		packageHash: mockPackageData.packageHash,
		sourceHash: mockPackageData.sourceHash,
		metadataHash: mockPackageData.metadataHash,
		canonicalProjectionHash: mockPackageData.projectionHash,
		materializedProjectionHash: mockPackageData.projectionHash,
		assetManifestHash: mockPackageData.assetManifestHash,
		slug: mockPackageData.invitation.slug,
		route: '/boda/test-invitation',
		approvalState: 'approved',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		intendedProductionProjectRef: 'ineitkdkyrxqyressllp',
		planId: 'plan-1234',
		createdAt: '2026-11-15T00:00:00.000Z',
		approvedAt: '2026-11-15T12:00:00.000Z', // 2 days before NOW
		approvedBy: 'tester',
		expectedAssetHashes: {},
		hostedValidation: {
			packageHash: mockPackageData.packageHash,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/boda/test-invitation',
			projectionHash: mockPackageData.projectionHash,
			planId: 'plan-1234',
			reviewedAt: '2026-11-15T12:00:00.000Z',
			reviewedBy: 'tester',
			intendedProductionProjectRef: 'ineitkdkyrxqyressllp',
			checklistResults: { route: true },
			storageHashVerification: {},
		},
		...overrides,
	};
}

const resolveMockPackage = (async () => ({
	packageData: mockPackageData,
	source: 'managed-definition' as const,
})) as any;

describe('preview-readiness', () => {
	describe('extractInvitationSlugsFromPaths', () => {
		it('extracts slugs from client directories, scripts, assets, and profiles', () => {
			const paths = [
				'src/invitations/clients/daniela-y-david/invitation.ts',
				'src/invitations/clients/camila-beltran/styles.scss',
				'src/assets/invitations/valeria-hernandez/hero.jpg',
				'src/styles/invitation-profiles/yireh-ana/theme.scss',
				'scripts/provision/invitations/allison-scarlett.ts',
				'scripts/ops/preview-readiness.ts',
				'docs/core/release-process.md',
			];
			const known = [
				'daniela-y-david',
				'camila-beltran',
				'valeria-hernandez',
				'yireh-ana',
				'allison-scarlett',
			];
			const slugs = extractInvitationSlugsFromPaths(paths, known);
			expect(slugs).toEqual([
				'allison-scarlett',
				'camila-beltran',
				'daniela-y-david',
				'valeria-hernandez',
				'yireh-ana',
			]);
		});

		it('returns empty array when no invitation paths are changed', () => {
			const paths = ['scripts/ops/release-status.ts', 'README.md'];
			expect(extractInvitationSlugsFromPaths(paths, ['camila-beltran'])).toEqual([]);
		});
	});

	describe('resolveAuditSlugs', () => {
		it('uses explicit slugs when provided', () => {
			const slugs = resolveAuditSlugs({ slugs: ['daniela-y-david', 'camila-beltran'] });
			expect(slugs).toEqual(['daniela-y-david', 'camila-beltran']);
		});

		it('splits comma-separated slugs and deduplicates', () => {
			const slugs = resolveAuditSlugs({
				slugs: ['daniela-y-david, camila-beltran', 'camila-beltran'],
			});
			expect(slugs).toEqual(['daniela-y-david', 'camila-beltran']);
		});

		it('resolves slugs from git diff when base and head are given', () => {
			const gitDiffFiles = () => [
				'src/invitations/clients/daniela-y-david/content.ts',
				'package.json',
			];
			const slugs = resolveAuditSlugs(
				{ base: 'base-sha', head: 'head-sha' },
				{ gitDiffFiles, clientDefinitions: [{ slug: 'daniela-y-david' }] },
			);
			expect(slugs).toEqual(['daniela-y-david']);
		});
	});

	describe('auditInvitationApproval', () => {
		it('reports "sin dato" when store is not available', async () => {
			const item = await auditInvitationApproval('test-invitation', {
				store: null,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('sin dato');
			expect(item.approvalFound).toBe('sin dato');
			expect(item.validity).toContain('sin acceso a Preview DB');
		});

		it('reports "lista" when approval is valid, matching, and within 7 days', async () => {
			const artifact = createValidArtifact();
			const store = createMockStore([artifact]);

			const item = await auditInvitationApproval('test-invitation', {
				store,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('lista');
			expect(item.approvalFound).toContain('exacta');
			expect(item.validity).toContain('vigente (hace 2 d');
		});

		it('reports "vencida" when approval is older than 7 days', async () => {
			const artifact = createValidArtifact({
				approvedAt: '2026-11-05T12:00:00.000Z', // 12 days before NOW
			});
			const store = createMockStore([artifact]);

			const item = await auditInvitationApproval('test-invitation', {
				store,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('vencida');
			expect(item.approvalFound).toContain('exacta');
			expect(item.validity).toContain('vencida');
		});

		it('reports "falta" (ninguna) when slug was never approved in Preview', async () => {
			const store = createMockStore([]);

			const item = await auditInvitationApproval('test-invitation', {
				store,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('falta');
			expect(item.approvalFound).toBe('ninguna');
			expect(item.validity).toBe('sin aprobación en Preview');
		});

		it('reports "falta" (otro hash) when approval exists for an older packageHash', async () => {
			const olderArtifact = createValidArtifact({
				packageHash: '9999999999999999999999999999999999999999999999999999999999999999',
				approvedAt: '2026-11-14T10:00:00.000Z',
			});
			const store = createMockStore([olderArtifact]);

			const item = await auditInvitationApproval('test-invitation', {
				store,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('falta');
			expect(item.approvalFound).toContain('otro hash (999999999999…)');
			expect(item.validity).toContain('desactualizada');
		});

		it('reports "falta" (pendiente) when approvalState is pending_hosted_validation', async () => {
			const pendingArtifact = createValidArtifact({
				approvalState: 'pending_hosted_validation',
			});
			const store = createMockStore([pendingArtifact]);

			const item = await auditInvitationApproval('test-invitation', {
				store,
				now: NOW,
				resolvePackage: resolveMockPackage,
			});
			expect(item.state).toBe('falta');
			expect(item.validity).toContain('pendiente de validación');
		});
	});

	describe('evaluatePreviewReadiness', () => {
		it('evaluates schema and invitations with summary counters and verdicts', async () => {
			const artifact = createValidArtifact();
			const store = createMockStore([artifact]);

			const mockSchema: PromotionSchemaGateResult = {
				state: 'CURRENT',
				migrationHead: '20261117120000',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'Schema CURRENT',
			};

			const report = await evaluatePreviewReadiness(
				{ slugs: ['test-invitation'], now: NOW },
				{
					store,
					previewDbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/preview',
					evaluateSchema: () => mockSchema,
					resolvePackage: resolveMockPackage,
				},
			);

			expect(report.summary.total).toBe(1);
			expect(report.summary.lista).toBe(1);
			expect(report.summary.falta).toBe(0);
			expect(report.summary.vencida).toBe(0);
			expect(report.summary.sinDato).toBe(0);
			expect(report.summary.schemaCompatible).toBe(true);
			expect(report.summary.readyForProduction).toBe(true);
			expect(report.summary.blockedReasons).toHaveLength(0);
		});

		it('detects blocked invitations and incompatible schema', async () => {
			const store = createMockStore([]); // never approved

			const mockSchema: PromotionSchemaGateResult = {
				state: 'BEHIND',
				migrationHead: '20261115000000',
				pendingMigrations: ['20261117120000'],
				extraMigrations: [],
				compatible: false,
				blockCode: 'SCHEMA_INCOMPATIBLE',
				detail: 'Pending 1 migration',
			};

			const report = await evaluatePreviewReadiness(
				{ slugs: ['test-invitation'], now: NOW },
				{
					store,
					previewDbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/preview',
					evaluateSchema: () => mockSchema,
					resolvePackage: resolveMockPackage,
				},
			);

			expect(report.summary.lista).toBe(0);
			expect(report.summary.falta).toBe(1);
			expect(report.summary.schemaCompatible).toBe(false);
			expect(report.summary.readyForProduction).toBe(false);
			expect(report.summary.blockedReasons.length).toBeGreaterThanOrEqual(2);
		});

		it('handles unconfigured preview db gracefully with sin dato', async () => {
			const report = await evaluatePreviewReadiness(
				{ slugs: ['test-invitation'], now: NOW },
				{
					previewDbUrl: '',
					resolvePackage: resolveMockPackage,
				},
			);

			expect(report.previewDbConfigured).toBe(false);
			expect(report.schema.state).toBe('UNVERIFIED');
			expect(report.invitations[0]?.state).toBe('sin dato');
			expect(report.summary.sinDato).toBe(1);
			expect(report.summary.readyForProduction).toBe(false);
		});
	});

	describe('formatPreviewReadinessReport', () => {
		it('renders clean markdown report with table and schema status', () => {
			const report: PreviewReadinessReport = {
				schema: {
					state: 'CURRENT',
					migrationHead: '20261117120000',
					pendingMigrations: [],
					extraMigrations: [],
					compatible: true,
					detail: 'Schema CURRENT',
				},
				invitations: [
					{
						slug: 'camila-beltran',
						route: '/xv/camila-beltran',
						packageHash:
							'3b17a9a8bb36db8b3b3ffbb9603022a5e773dd6540052d6dd292209c0edfd534',
						state: 'lista',
						approvalFound: 'exacta (3b17a9a8bb36…)',
						validity: 'vigente (hace 0 d / vence 2026-11-24)',
					},
					{
						slug: 'daniela-y-david',
						route: '/boda/daniela-y-david',
						packageHash:
							'24f59a0ba923f30c3ca7f783a09074ea282fa27313662080d806a3fdfb000735',
						state: 'falta',
						approvalFound: 'ninguna',
						validity: 'sin aprobación en Preview',
					},
				],
				summary: {
					total: 2,
					lista: 1,
					falta: 1,
					vencida: 0,
					sinDato: 0,
					schemaCompatible: true,
					readyForProduction: false,
					blockedReasons: ['daniela-y-david: FALTA (sin aprobación en Preview)'],
				},
				previewDbConfigured: true,
				evaluationTimestamp: NOW.toISOString(),
			};

			const formatted = formatPreviewReadinessReport(report);
			expect(formatted).toContain('### Reporte de Preview Readiness (Pre-Release)');
			expect(formatted).toContain(
				'**Esquema Preview:** CURRENT (head: `20261117120000`, 0 pendientes) · compatible',
			);
			expect(formatted).toContain(
				'| Invitación | Estado | Hash Actual | Aprobación Encontrada | Vigencia |',
			);
			expect(formatted).toContain(
				'| camila-beltran | ✅ lista | `3b17a9a8bb36…` | exacta (3b17a9a8bb36…) | vigente (hace 0 d / vence 2026-11-24) |',
			);
			expect(formatted).toContain(
				'| daniela-y-david | ❌ falta | `24f59a0ba923…` | ninguna | sin aprobación en Preview |',
			);
			expect(formatted).toContain(
				'**Resumen:** 1 listas, 1 falta, 0 vencidas, 0 sin dato (total: 2).',
			);
			expect(formatted).toContain('daniela-y-david: FALTA (sin aprobación en Preview)');
		});
	});
});
