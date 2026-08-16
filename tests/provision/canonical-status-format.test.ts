import { describe, expect, it } from '@jest/globals';
import {
	formatCanonicalStatusView,
	formatSlugStatusView,
} from '../../scripts/provision/canonical-status-format.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

const NO_COLOR_ENV = { NO_COLOR: '1' };

describe('canonical status CLI format', () => {
	it('scopes CURRENT to schema and keeps disposable separate', () => {
		const text = formatCanonicalStatusView(buildCanonicalStatusViewFixture(), {
			env: NO_COLOR_ENV,
			backupHealth: {
				newestManifestPath: null,
				newestCreatedAt: null,
				newestAgeMs: null,
				lastDailyReportAt: null,
				lastDailyOutcome: null,
				orphanCount: 0,
				attention: true,
				summary: 'daily ausente · sin set completo',
			},
		});
		expect(text).toContain('CURRENT 75/75');
		expect(text).toContain('Readiness');
		expect(text).toContain('READY');
		expect(text).toContain('DISPOSABLE-TEST (not a persistent schema environment)');
		expect(text).toContain('CRITICAL BACKUP');
		expect(text).toContain('daily ausente · sin set completo');
		expect(text).toContain('Disposable proof: MISSING');
		expect(text).toContain('Does not mean Local, Preview, or Production schema is behind');
		expect(text).toContain('Active DB rows (not registry)');
		expect(text).not.toMatch(/\bManaged\b/);
		expect(text).not.toContain('PROMOTIONS');
		expect(text).toContain('OWNER / HITL');
		expect(text).toContain('Preview → Production');
		expect(text).toContain('Task: prod:apply');
		expect(text).toContain('Escribir: --slug victoria-y-roberto --apply');
		expect(text).not.toContain('pnpm prod:apply -- --slug victoria-y-roberto --apply');
		expect(text).toContain('Aplicar parche:');
		expect(text).toContain(
			'Escribir: --patch scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql --apply',
		);
		expect(text).not.toContain('--apply --apply');
		expect(text).not.toContain('Escribir: --target disposable-test --apply');
		expect(text).toContain('Command lives once in NEXT ACTIONS');
		expect(text).toContain('Authorization');
		expect(text).toContain('GRANDFATHERED');
		expect(text).toContain('NOT_APPLICABLE');
		expect(text).toContain('owner-apply evidence');
		expect(text).not.toContain('PRODUCTION AUTHORIZATION: MISSING');
	});

	it('prints diagnostics only as enrichment', () => {
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({
				diagnostics: [
					{
						code: 'MANAGED_DRIFT',
						domain: 'content',
						evidence: 'LIVE',
						slug: 'victoria-y-roberto',
						environment: 'preview',
						cause: 'Semantic drift.',
						affectedFieldCount: 1,
						affectedSectionCount: 1,
						semanticPaths: ['hero.title'],
					},
				],
			}),
			{ diagnostics: true, env: NO_COLOR_ENV },
		);
		expect(text).toContain('DIAGNOSTICS (enrichment only');
		expect(text).toContain('MANAGED_DRIFT');
		expect(text).not.toContain('HEALTHY');
		expect(text).not.toContain('applyNextStep');
	});

	it('qualifies CURRENT when Production owner-apply evidence is missing', () => {
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({
				environments: {
					...buildCanonicalStatusViewFixture().environments,
					production: {
						...buildCanonicalStatusViewFixture().environments.production,
						schemaLifecycle: 'CURRENT',
						authorizationIntegrity: 'MISSING',
						authorizationMissingVersions: ['20260807120000'],
					},
				},
			}),
			{ env: NO_COLOR_ENV },
		);
		expect(text).toContain('CURRENT 75/75');
		expect(text).toContain('PRODUCTION AUTHORIZATION: MISSING (informational)');
		expect(text).toContain('20260807120000');
		expect(text).toContain('Schema CURRENT is not owner-authorization evidence');
		expect(text).toContain('local to this worktree');
	});

	it('prints Preview apply as invitation:release task args', () => {
		const base = buildCanonicalStatusViewFixture();
		const promotion = base.promotions[0];
		if (!promotion) throw new Error('expected fixture promotion');
		const text = formatCanonicalStatusView(
			buildCanonicalStatusViewFixture({
				promotions: [
					{
						...promotion,
						slug: 'renata',
						title: 'XV años de Renata',
						action: 'PROMOTE_PREVIEW',
						reasonCode: 'PREVIEW_BEHIND_CANONICAL',
						source: 'canonical',
						destination: 'preview',
						handoff: {
							...promotion.handoff,
							ownerApplyRequired: false,
							applyCommand:
								'pnpm invitation:release -- --slug renata --targets preview --apply',
						},
					},
				],
			}),
			{ env: NO_COLOR_ENV },
		);
		expect(text).toContain('Task: invitation:release');
		expect(text).toContain('Escribir: --slug renata --targets preview --apply');
		expect(text).not.toContain('Terminal');
		expect(text).not.toContain('$env:CELEBRA_TASK_SCOPE');
		expect(text).not.toContain(
			'pnpm invitation:release -- --slug renata --targets preview --apply',
		);
	});

	it('does not emit release apply commands for in_progress authoring in the slug view', () => {
		const base = buildCanonicalStatusViewFixture();
		const promotion = base.promotions[0];
		if (!promotion) throw new Error('expected fixture promotion');
		const text = formatSlugStatusView(
			buildCanonicalStatusViewFixture({
				promotions: [
					{
						...promotion,
						slug: 'leslie-perez',
						title: 'XV años de Leslie',
						lifecycle: 'in_progress',
						action: 'BLOCKED',
						reasonCode: 'PRODUCTION_PREFLIGHT_BLOCKED',
						source: null,
						destination: null,
						handoff: {
							...promotion.handoff,
							applyCommand: 'pnpm prod:apply -- --slug leslie-perez --apply',
						},
					},
				],
			}),
			'leslie-perez',
			{ env: NO_COLOR_ENV },
		);
		expect(text).toContain('[in_progress] Authoring');
		expect(text).toContain('Not a release obligation');
		expect(text).not.toContain('Task: prod:apply');
		expect(text).not.toContain('--slug leslie-perez --apply');
	});
});
