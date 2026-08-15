import { describe, expect, it } from '@jest/globals';
import { formatCanonicalStatusView } from '../../scripts/provision/canonical-status-format.ts';
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
		expect(text).toContain('NEEDS_DISPOSABLE_PROOF');
		expect(text).toContain('DISPOSABLE-TEST (not a persistent schema environment)');
		expect(text).toContain('CRITICAL BACKUP');
		expect(text).toContain('daily ausente · sin set completo');
		expect(text).toContain('Disposable proof: MISSING');
		expect(text).toContain('Does not mean Local, Preview, or Production schema is behind');
		expect(text).toContain('Active DB rows (not registry)');
		expect(text).not.toMatch(/\bManaged\b/);
		expect(text).not.toContain('PROMOTIONS');
		expect(text).toContain('OWNER / HITL REQUIRED');
		expect(text).toContain('Preview → Production');
		expect(text).toContain('[Apply]');
		expect(text).not.toContain('Verify:');
		expect(text).toContain('Apply:');
		expect(text).toContain('Task: prod:apply');
		expect(text).toContain('Escribir: --slug victoria-y-roberto --apply');
		expect(text).not.toContain('pnpm prod:apply -- --slug victoria-y-roberto --apply');
		expect(text).toContain('Aplicar:');
		expect(text).toContain(
			'Escribir: --patch scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql --apply',
		);
		expect(text).not.toContain('--apply --apply');
		expect(text).toContain('Task: db:migrate');
		expect(text).toContain('Escribir: --target disposable-test --apply');
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
		expect(text).toContain('PRODUCTION AUTHORIZATION: MISSING');
		expect(text).toContain('20260807120000');
		expect(text).toContain('Schema CURRENT is not owner-authorization evidence');
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
});
