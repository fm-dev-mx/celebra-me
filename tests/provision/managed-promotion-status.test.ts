/**
 * managed-promotion-status.test.ts — grouped reads, output safety, compact isolation
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { InvitationDefinition } from '../../scripts/provision/invitations/invitation-definition.ts';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type { PromotionPreflightReport } from '../../scripts/provision/invitation-promote.ts';

const mockResolveDbUrlForEnv = jest.fn();
const mockReadGrouped = jest.fn();
const mockBuildCanonical = jest.fn();
const mockClassify = jest.fn();

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	getOrCreateStatusProbeSession: jest.fn(),
	resolveDbUrlForEnv: (...args: unknown[]) => mockResolveDbUrlForEnv(...args),
}));

jest.mock('../../scripts/status-core/index.ts', () => {
	const actual = jest.requireActual('../../scripts/status-core/index.ts') as Record<
		string,
		unknown
	>;
	return {
		...actual,
		readGroupedPromotionalEvidence: (...args: unknown[]) => mockReadGrouped(...args),
	};
});

jest.mock('../../scripts/provision/promotional-fingerprint.ts', () => {
	const actual = jest.requireActual(
		'../../scripts/provision/promotional-fingerprint.ts',
	) as Record<string, unknown>;
	return {
		...actual,
		buildCanonicalPromotionalFingerprint: (...args: unknown[]) => mockBuildCanonical(...args),
		classifyLiveInvitation: (...args: unknown[]) => mockClassify(...args),
	};
});

import {
	evaluateManagedPromotionStatus,
	formatSlugPromotionLine,
	refineManagedPromotionsWithProductionPreflight,
} from '../../scripts/provision/managed-promotion-status.ts';
import { formatPromotionsSection } from '../../scripts/provision/canonical-status-format.ts';
import { presentPromotionRow } from '../../src/lib/status/presentation.ts';
import { buildGroupedPromotionalEvidenceSql } from '../../scripts/status-core/promotional-evidence.ts';

function definition(slug: string): InvitationDefinition {
	return {
		slug,
		managedIdentityId: '00000000-0000-4000-8000-000000000001',
		createdAt: '2026-01-01T00:00:00.000Z',
		lifecycle: 'published',
		deliveryScope: 'content-and-assets',
		eventType: 'boda',
		title: 'Título',
		clientName: 'Cliente',
		hostLoginAlias: `${slug}-host`,
		baseDemoId: 'demo-boda-jewelry-box-wedding',
		themeId: 'jewelry-box-wedding',
		visualProfileId: slug,
		eventTiming: {
			localDateTime: '2026-01-01T00:00',
			timeZone: 'America/Mexico_City',
			startsAtUtc: '2026-01-01T06:00:00.000Z',
		},
		assets: [
			{
				key: 'hero',
				relativePath: 'hero.jpg',
				displayName: 'Hero',
				alt: 'Hero',
			},
		],
		buildPublishedContent: () => ({ title: 'ok' }),
	};
}
function productionReport(
	slug: string,
	status: PromotionPreflightReport['status'],
	blockCode?: string,
): PromotionPreflightReport {
	return {
		slug,
		status,
		blockCode,
		packageHash: `package-${slug}`,
		sourceHash: `source-${slug}`,
		projectionHash: `projection-${slug}`,
		assetManifestHash: `assets-${slug}`,
		targetDbUrl: 'postgres://redacted',
		schema: {
			state: 'CURRENT',
			migrationHead: '20260812210000',
			pendingMigrations: [],
			extraMigrations: [],
			compatible: true,
			detail: 'ok',
		},
		backup: {
			required: false,
			acceptable: true,
			canonicalCommand: 'pnpm db:prod:backup:critical',
			detail: 'not required for dry-run',
		},
		divergence: {
			safeManagedChanges: [],
			targetOwnedDifferences: [],
			managedDivergences: [],
			conflicts: [],
			blocksPromotion: false,
		},
	} as PromotionPreflightReport;
}

describe('managed promotion status', () => {
	beforeEach(() => {
		mockResolveDbUrlForEnv.mockReset();
		mockReadGrouped.mockReset();
		mockBuildCanonical.mockReset();
		mockClassify.mockReset();
		mockResolveDbUrlForEnv.mockImplementation((...args: unknown[]) => ({
			dbUrl: `postgres://user:secret@${String(args[0])}.example.internal/db`,
		}));
		mockBuildCanonical.mockImplementation(async () => ({
			ok: true,
			fingerprint: 'canonical-fingerprint',
			assetKeys: ['hero'],
		}));
		mockClassify.mockImplementation((...args: unknown[]) => {
			const input = args[0] as { rows: unknown[] };
			return input.rows.length === 0 ? 'absent' : 'match';
		});
	});

	it('issues exactly one grouped SQL read per environment for N invitations', async () => {
		const session = {
			probeConnectivity: jest.fn(async () => true),
			psql: jest.fn(),
		};
		mockReadGrouped.mockImplementation(async (...args: unknown[]) => ({
			ok: true,
			rows: String(args[1]).includes('local') ? [{ slug: 'alpha' }, { slug: 'beta' }] : [],
		}));

		const result = await evaluateManagedPromotionStatus({
			session: session as never,
			definitions: [definition('alpha'), definition('beta')],
		});

		expect(session.probeConnectivity).toHaveBeenCalledTimes(3);
		expect(mockReadGrouped).toHaveBeenCalledTimes(3);
		expect(session.psql).not.toHaveBeenCalled();
		for (const slugs of mockReadGrouped.mock.calls.map((call) => call[2])) {
			expect(slugs).toEqual(['alpha', 'beta']);
		}
		expect(result.promotions.map((row) => row.slug)).toEqual(['alpha', 'beta']);
		expect(result.promotions.every((row) => row.action === 'PROMOTE_PREVIEW')).toBe(true);
	});

	it('omits synchronized invitations from output', async () => {
		const session = {
			probeConnectivity: jest.fn(async () => true),
			psql: jest.fn(),
		};
		mockReadGrouped.mockImplementation(async () => ({
			ok: true,
			rows: [{ slug: 'alpha' }],
		}));
		mockClassify.mockImplementation(() => 'match');

		const result = await evaluateManagedPromotionStatus({
			session: session as never,
			definitions: [definition('alpha')],
		});
		expect(result.promotions).toEqual([]);
		expect(result.inSyncSlugs).toEqual(['alpha']);
		expect(formatPromotionsSection(result.promotions)).toBe(
			'PUBLICATION\nAttention: 0 (in sync or none registered)\n',
		);
	});

	it('prints only safe promotion fields', () => {
		const text = formatPromotionsSection([
			presentPromotionRow({
				slug: 'invitacion-y',
				title: 'Invitación Y',
				eventType: 'boda',
				action: 'BLOCKED',
				reasonCode: 'MANAGED_DIVERGENCE',
				environments: { local: 'match', preview: 'diverged', production: 'behind' },
				envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
			}),
			presentPromotionRow({
				slug: 'boda-perla-y-carlos',
				title: 'Perla y Carlos',
				eventType: 'boda',
				action: 'PROMOTE_PREVIEW',
				reasonCode: 'PREVIEW_BEHIND_CANONICAL',
				environments: { local: 'match', preview: 'behind', production: 'behind' },
				envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
			}),
		]);
		expect(text).toContain('PROMOTE_PREVIEW');
		expect(text).toContain('BLOCKED');
		expect(text).not.toContain('PROMOTIONS');
		expect(text).not.toMatch(/CURRENT\n/);
		expect(text).not.toMatch(/postgres:\/\//);
		expect(text).not.toMatch(/service_role/i);
		expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
		expect(text).not.toMatch(/\b[0-9a-f]{64}\b/);
		expect(text).not.toContain('Cliente');
		expect(text).not.toContain('secret');
		expect(formatSlugPromotionLine(undefined)).toBe('Publication: (none)');
	});
});

describe('canonical Production preflight refinement', () => {
	const envEvidence = { local: 'LIVE', preview: 'LIVE', production: 'LIVE' } as const;
	const states = {
		local: 'match',
		preview: 'match',
		production: 'unknown',
	} as const;

	it('maps canonical outcomes without guessing from fingerprints', async () => {
		const definitions = [
			definition('alpha'),
			definition('beta'),
			definition('gamma'),
			definition('delta'),
		];
		const environmentsBySlug = Object.fromEntries(
			definitions.map((item) => [item.slug, { ...states }]),
		);
		const promotions = definitions.map((item) =>
			presentPromotionRow({
				slug: item.slug,
				title: item.title,
				eventType: item.eventType,
				action: 'UNKNOWN',
				reasonCode: 'EVIDENCE_INCOMPLETE',
				environments: environmentsBySlug[item.slug]!,
				envEvidence,
			}),
		);
		const reports = {
			alpha: productionReport('alpha', 'PROMOTABLE'),
			beta: productionReport('beta', 'BLOCKED', 'MISSING_PREVIEW_APPROVAL'),
			gamma: productionReport('gamma', 'IN_SYNC'),
			delta: productionReport('delta', 'BLOCKED', 'MANAGED_DIVERGENCE'),
		};

		const result = await refineManagedPromotionsWithProductionPreflight({
			promotions,
			inSyncSlugs: [],
			definitions,
			environmentsBySlug,
			envEvidence,
			resolvePackage: async (slug) => ({ invitation: { slug } }) as InvitationPackageData,
			runProductionPreflight: async (packageData) =>
				reports[packageData.invitation.slug as keyof typeof reports],
			timeoutMs: 1_000,
		});

		expect(result.inSyncSlugs).toEqual(['gamma']);
		expect(result.promotions.find((row) => row.slug === 'alpha')).toMatchObject({
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
			environments: { production: 'behind' },
		});
		expect(result.promotions.find((row) => row.slug === 'beta')).toMatchObject({
			action: 'BLOCKED',
			reasonCode: 'PREVIEW_APPROVAL_REQUIRED',
			environments: { production: 'behind' },
			handoff: {
				applyCommand:
					'pnpm invitation:release -- --slug beta --targets preview --apply',
			},
		});
		expect(result.promotions.find((row) => row.slug === 'delta')).toMatchObject({
			action: 'BLOCKED',
			reasonCode: 'MANAGED_DIVERGENCE',
			environments: { production: 'diverged' },
			handoff: { applyCommand: null },
		});
	});

	it('fails closed without an apply command when the canonical preflight times out', async () => {
		const alpha = definition('alpha');
		const environmentsBySlug = { alpha: { ...states } };
		const row = presentPromotionRow({
			slug: alpha.slug,
			title: alpha.title,
			eventType: alpha.eventType,
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
			environments: environmentsBySlug.alpha,
			envEvidence,
		});
		const result = await refineManagedPromotionsWithProductionPreflight({
			promotions: [row],
			inSyncSlugs: [],
			definitions: [alpha],
			environmentsBySlug,
			envEvidence,
			resolvePackage: async () =>
				({ invitation: { slug: 'alpha' } }) as InvitationPackageData,
			runProductionPreflight: async () => await new Promise(() => undefined),
			timeoutMs: 1,
		});
		expect(result.promotions[0]).toMatchObject({
			action: 'UNKNOWN',
			reasonCode: 'PRODUCTION_PREFLIGHT_UNVERIFIED',
			environments: { production: 'unknown' },
			handoff: { applyCommand: null },
		});
	});

	it('keeps fingerprint behind when Production preflight is unverified', async () => {
		const alpha = definition('alpha');
		const environmentsBySlug = {
			alpha: { local: 'match', preview: 'match', production: 'behind' } as const,
		};
		const row = presentPromotionRow({
			slug: alpha.slug,
			title: alpha.title,
			eventType: alpha.eventType,
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
			environments: environmentsBySlug.alpha,
			envEvidence,
		});
		const result = await refineManagedPromotionsWithProductionPreflight({
			promotions: [row],
			inSyncSlugs: [],
			definitions: [alpha],
			environmentsBySlug,
			envEvidence,
			resolvePackage: async () =>
				({ invitation: { slug: 'alpha' } }) as InvitationPackageData,
			runProductionPreflight: async () => {
				throw new Error('PRODUCTION_PREFLIGHT_TIMEOUT');
			},
			timeoutMs: 1_000,
		});
		expect(result.promotions[0]).toMatchObject({
			action: 'UNKNOWN',
			reasonCode: 'PRODUCTION_PREFLIGHT_UNVERIFIED',
			environments: { production: 'behind' },
			handoff: { applyCommand: null, dryRunCommand: 'pnpm prod:apply -- --slug alpha' },
		});
		expect(result.promotions[0]?.uncertaintyNotes).not.toContain('PRODUCTION UNKNOWN');
	});
});

describe('grouped promotional SQL', () => {
	it('selects one grouped query for all slugs without PII columns', () => {
		const sql = buildGroupedPromotionalEvidenceSql(['alpha', 'beta']);
		expect(sql).toContain('json_agg');
		expect(sql).toContain("'alpha'");
		expect(sql).toContain("'beta'");
		expect(sql).not.toContain('client_email');
		expect(sql).not.toContain('secure_url');
		expect(sql).toContain('NULL::jsonb AS "managedProjection"');
	});

	it('keeps diagnostics on the same SQL family instead of a second query', () => {
		const light = buildGroupedPromotionalEvidenceSql(['alpha']);
		const heavy = buildGroupedPromotionalEvidenceSql(['alpha'], { diagnostics: true });
		expect(light).toContain('NULL::jsonb AS "managedProjection"');
		expect(heavy).toContain('p.managed_projection');
		expect(heavy).not.toContain('NULL::jsonb AS "managedProjection"');
		expect(light).toContain('FROM public.invitations i');
		expect(heavy).toContain('FROM public.invitations i');
	});

	it('invokes psql once per grouped read', async () => {
		const { readGroupedPromotionalEvidence } =
			await import('../../scripts/status-core/promotional-evidence.ts');
		const session = {
			psql: jest.fn(async () => ({ status: 0, stdout: '[]', stderr: '' })),
		};
		await readGroupedPromotionalEvidence(session as never, 'postgres://local', [
			'alpha',
			'beta',
		]);
		expect(session.psql).toHaveBeenCalledTimes(1);
		await readGroupedPromotionalEvidence(session as never, 'postgres://local', []);
		expect(session.psql).toHaveBeenCalledTimes(1);
	});
});
