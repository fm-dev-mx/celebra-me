import { describe, expect, it } from '@jest/globals';
import { enrichCanonicalDiagnostics } from '../../scripts/provision/canonical-diagnostics.ts';
import { decidePromotionAction } from '../../src/lib/status/decision.ts';
import { CanonicalStatusViewSchema } from '../../src/lib/status/schema.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

describe('enrichCanonicalDiagnostics', () => {
	it('does not change canonical promotion, schema, or readiness decisions', () => {
		const view = buildCanonicalStatusViewFixture();
		const promotions = structuredClone(view.promotions);
		const environments = structuredClone(view.environments);
		const before = decidePromotionAction({
			canonicalAvailable: true,
			local: 'match',
			preview: 'match',
			production: 'behind',
		});

		const diagnostics = enrichCanonicalDiagnostics({
			view,
			definitions: [],
			rowsByEnv: { local: [], preview: [], production: [] },
			includeSemanticDetail: true,
		});

		expect(view.promotions).toEqual(promotions);
		expect(view.environments).toEqual(environments);
		expect(
			decidePromotionAction({
				canonicalAvailable: true,
				local: 'match',
				preview: 'match',
				production: 'behind',
			}),
		).toEqual(before);
		expect(diagnostics.every((item) => !('action' in item) && !('nextStep' in item))).toBe(
			true,
		);
	});

	it('rejects diagnostic payloads that carry action authority', () => {
		const view = buildCanonicalStatusViewFixture({
			diagnostics: [
				{
					code: 'MANAGED_DRIFT',
					cause: 'Semantic drift.',
					affectedFieldCount: 1,
					affectedSectionCount: 1,
					semanticPaths: ['hero.title'],
				},
			],
		});
		expect(() => CanonicalStatusViewSchema.parse(view)).not.toThrow();
		expect(() =>
			CanonicalStatusViewSchema.parse({
				...view,
				diagnostics: [
					{
						...view.diagnostics[0],
						action: 'PROMOTE_PREVIEW',
					},
				],
			}),
		).toThrow();
	});
});
