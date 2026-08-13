import { describe, expect, it } from '@jest/globals';
import { formatCanonicalStatusView } from '../../scripts/provision/canonical-status-format.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

describe('canonical status CLI format', () => {
	it('scopes CURRENT to schema and keeps disposable separate', () => {
		const text = formatCanonicalStatusView(buildCanonicalStatusViewFixture());
		expect(text).toContain('CURRENT 75/75');
		expect(text).toContain('Readiness');
		expect(text).toContain('NEEDS_DISPOSABLE_PROOF');
		expect(text).toContain('DISPOSABLE-TEST (not a persistent schema environment)');
		expect(text).toContain('Disposable proof: MISSING');
		expect(text).toContain('Does not mean Local, Preview, or Production schema is behind');
		expect(text).toContain('Active DB rows (not registry)');
		expect(text).not.toMatch(/\bManaged\b/);
		expect(text).not.toContain('PROMOTIONS');
		expect(text).toContain('OWNER / HITL REQUIRED');
		expect(text).toContain('Preview → Production');
		expect(text).toContain('[Verify → Apply]');
		expect(text).toContain('Verify:');
		expect(text).toContain('Apply:');
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
						slug: 'victoria-y-roberto',
						environment: 'preview',
						cause: 'Semantic drift.',
						affectedFieldCount: 1,
						affectedSectionCount: 1,
						semanticPaths: ['hero.title'],
					},
				],
			}),
			{ diagnostics: true },
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
		);
		expect(text).toContain('CURRENT 75/75');
		expect(text).toContain('PRODUCTION AUTHORIZATION: MISSING');
		expect(text).toContain('20260807120000');
		expect(text).toContain('Schema CURRENT is not owner-authorization evidence');
	});
});
