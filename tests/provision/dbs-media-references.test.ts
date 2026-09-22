import { describe, expect, it } from '@jest/globals';
import { buildOperationalActionPlan } from '../../src/lib/status/action-plan.ts';
import {
	buildMediaOperationalPlan,
	formatMediaReferences,
	inspectPublishedMediaReferences,
	readMediaReferencesStatus,
	type PublishedMediaInventoryRow,
} from '../../scripts/provision/dbs-media-references.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const baseUrl =
	'https://res.cloudinary.com/example/image/upload/v1/boda/victoria-y-roberto/assets/hero.webp';
const oldUrl =
	'https://res.cloudinary.com/example/image/upload/v1/production/boda/victoria-y-roberto/assets/hero.webp';

function published(src: string | undefined = baseUrl): PublishedMediaInventoryRow {
	return {
		eventType: 'boda',
		slug: 'victoria-y-roberto',
		content: {
			hero: {
				backgroundImage: {
					type: 'uploaded',
					assetId,
					...(src === undefined ? {} : { src }),
				},
			},
		},
		assets: [{ id: assetId, key: 'hero-desktop', url: baseUrl }],
	};
}

describe('dbs media references', () => {
	it('keeps exact published delivery references at MATCH', () => {
		expect(inspectPublishedMediaReferences([published()])).toMatchObject({
			status: 'MATCH',
			invitations: 1,
			references: 1,
			findings: [],
		});
	});

	it('detects Victoria-style stale namespace and recommends a conditional repair', () => {
		const production = inspectPublishedMediaReferences([published(oldUrl)]);
		const media = { preview: null, production };
		const plan = buildMediaOperationalPlan(
			buildOperationalActionPlan(
				buildCanonicalStatusViewFixture({
					promotions: [],
					inSyncSlugs: ['victoria-y-roberto'],
					inSyncCount: 1,
				}),
			),
			media,
		);
		expect(production.status).toBe('REFERENCE_DRIFT');
		expect(production.findings[0]).toMatchObject({
			route: 'boda/victoria-y-roberto',
			path: 'hero.backgroundImage',
			assetKey: 'hero-desktop',
		});
		expect(plan.health.status).toBe('ACTION_REQUIRED');
		const action = plan.actions.find(
			(item) => item.id === 'media-production-victoria-y-roberto',
		);
		expect(action?.steps.map((step) => step.type)).toEqual(['Diagnose', 'Plan', 'Apply']);
		expect(action?.steps[2]).toMatchObject({ requiresOwner: true });
		expect(action?.steps[2]?.prerequisite).toContain('Solo si');
		const visible = `${JSON.stringify(media)}${formatMediaReferences(media)}`;
		expect(visible).not.toContain(oldUrl);
		expect(visible).not.toContain(baseUrl);
	});

	it('keeps the general view grouped while slug and verbose views retain actionable detail', () => {
		const production = inspectPublishedMediaReferences([published(oldUrl)]);
		const media = { preview: null, production };
		const summary = formatMediaReferences(media, { env: { NO_COLOR: '1' } });
		expect(summary).toContain('boda/victoria-y-roberto (1)');
		expect(summary).toContain('pnpm dbs <slug>');
		expect(summary).not.toContain('hero.backgroundImage ·');
		expect(summary).not.toContain('prod:apply');
		const detail = formatMediaReferences(media, {
			slug: 'victoria-y-roberto',
			env: { NO_COLOR: '1' },
		});
		expect(detail).toContain('hero.backgroundImage · hero-desktop');
		expect(detail).toContain('pnpm prod:apply -- --slug victoria-y-roberto');
		expect(formatMediaReferences(media, { env: { FORCE_COLOR: '1' } })).toContain('\x1b[');
		expect(summary).not.toContain('\x1b[');
	});

	it('accepts the exact Cloudinary OG transform', () => {
		const row = published();
		row.content = {
			sharing: {
				ogImage: {
					type: 'uploaded',
					assetId,
					src: baseUrl.replace(
						'/upload/',
						'/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_auto/',
					),
				},
			},
		};
		expect(inspectPublishedMediaReferences([row]).status).toBe('MATCH');
	});

	it('marks missing src and missing active asset separately', () => {
		const missingSrc = published();
		missingSrc.content = { hero: { backgroundImage: { type: 'uploaded', assetId } } };
		expect(inspectPublishedMediaReferences([missingSrc]).status).toBe('REFERENCE_DRIFT');
		const row = published();
		row.assets = [];
		const production = inspectPublishedMediaReferences([row]);
		expect(production.status).toBe('MISSING_ASSET');
		const media = { preview: null, production };
		const plan = buildMediaOperationalPlan(
			buildOperationalActionPlan(buildCanonicalStatusViewFixture({ promotions: [] })),
			media,
		);
		const action = plan.actions.find(
			(item) => item.id === 'media-production-victoria-y-roberto',
		);
		expect(action?.steps.map((step) => step.type)).toEqual(['Diagnose', 'Manual/HITL']);
		expect(formatMediaReferences(media)).not.toContain('--apply');
	});

	it('includes unregistered invitations and respects selected targets', () => {
		const row = { ...published(oldUrl), slug: 'unregistered-client' };
		const media = readMediaReferencesStatus({
			targets: ['production'],
			readInventory: () => [row],
		});
		expect(media.preview).toBeNull();
		expect(media.production?.findings[0]?.slug).toBe('unregistered-client');
	});

	it('reports query failure as UNVERIFIED without a green operational plan', () => {
		const media = readMediaReferencesStatus({
			targets: ['preview'],
			readInventory: () => {
				throw new Error('connection failed with credentials');
			},
		});
		const plan = buildMediaOperationalPlan(
			buildOperationalActionPlan(buildCanonicalStatusViewFixture({ promotions: [] })),
			media,
		);
		expect(media.preview?.status).toBe('UNVERIFIED');
		expect(plan.health.status).not.toBe('GREEN');
		expect(JSON.stringify(media)).not.toContain('credentials');
		expect(
			plan.actions.find((action) => action.id === 'media-preview-unverified')?.steps,
		).toHaveLength(1);
	});

	it('redacts unexpected route, path, and asset labels', () => {
		const row = published(oldUrl);
		row.slug = 'unsafe;command';
		row.assets[0]!.key = 'https://private.example/asset';
		const result = inspectPublishedMediaReferences([row]);
		expect(result.findings[0]?.route).toBe('boda/[redacted]');
		expect(result.findings[0]?.assetKey).toBe('[redacted]');
		const plan = buildMediaOperationalPlan(
			buildOperationalActionPlan(buildCanonicalStatusViewFixture({ promotions: [] })),
			{ preview: null, production: result },
		);
		expect(
			plan.actions.find((action) => action.domain === 'media')?.steps[0]?.command,
		).toBeNull();
	});
});
