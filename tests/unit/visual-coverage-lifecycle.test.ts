import { readFileSync } from 'node:fs';
import * as registry from '../../scripts/provision/invitations/registry';
import {
	buildVisualPageCases,
	buildVisualCoverageCases,
	discoverDemoCases,
} from '../../scripts/screenshot/visual-coverage-contract';

describe('visual coverage lifecycle', () => {
	afterEach(() => jest.restoreAllMocks());
	it('includes only published invitations and all repository demos', () => {
		const definitions = registry.listInvitationDefinitions();
		const cases = buildVisualPageCases();
		expect(
			cases.filter((entry) => entry.kind === 'invitation').map((entry) => entry.slug),
		).toEqual(
			definitions
				.filter((entry) => entry.lifecycle === 'published')
				.map((entry) => entry.slug),
		);
		expect(cases.filter((entry) => entry.kind === 'demo')).toEqual(discoverDemoCases());
	});
	it('automatically includes a newly published definition and changes only page coverage', () => {
		const definitions = registry.listInvitationDefinitions();
		const draft = { ...definitions[0], lifecycle: 'in_progress' as const };
		const fixtureDefinitions = [draft, ...definitions.slice(1)];
		jest.spyOn(registry, 'listInvitationDefinitions').mockReturnValue(fixtureDefinitions);
		const before = buildVisualCoverageCases();
		jest.spyOn(registry, 'listInvitationDefinitions').mockReturnValue(
			fixtureDefinitions.map((entry) =>
				entry === draft ? { ...entry, lifecycle: 'published' } : entry,
			),
		);
		const after = buildVisualCoverageCases();
		expect(after.pageCases).toHaveLength(before.pageCases.length + 1);
		expect(after.pageCases.some((entry) => entry.slug === draft.slug)).toBe(true);
		expect(after.variantCases).toEqual(before.variantCases);
		expect(after.matrixHash).not.toBe(before.matrixHash);
	});
	// Branch-level pin: the accepted candidate can only be generated from the commit that changes
	// the matrix, so the commit hook (CELEBRA_TEST_SCOPE=commit) skips it and `validate:changed`
	// plus Repository CI enforce it before integration.
	const branchLevel = process.env.CELEBRA_TEST_SCOPE === 'commit' ? it.skip : it;
	branchLevel('keeps the committed visual references aligned with the current matrix', () => {
		const manifest = JSON.parse(
			readFileSync('tests/e2e/visual-baselines/manifest.json', 'utf8'),
		) as { matrixHash: string };
		// Publishing or retiring a demo or invitation needs an approved candidate in the same branch.
		expect(manifest.matrixHash).toBe(buildVisualCoverageCases().matrixHash);
	});
});
