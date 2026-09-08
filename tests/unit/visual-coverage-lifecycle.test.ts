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
		for (const draft of definitions.filter((entry) => entry.lifecycle === 'in_progress')) {
			expect(cases.some((entry) => entry.slug === draft.slug)).toBe(false);
		}
	});
	it('automatically includes a newly published definition and changes only page coverage', () => {
		const definitions = registry.listInvitationDefinitions();
		const draft = definitions.find((entry) => entry.lifecycle === 'in_progress');
		expect(draft).toBeDefined();
		const before = buildVisualCoverageCases();
		jest.spyOn(registry, 'listInvitationDefinitions').mockReturnValue(
			definitions.map((entry) =>
				entry === draft ? { ...entry, lifecycle: 'published' } : entry,
			),
		);
		const after = buildVisualCoverageCases();
		expect(after.pageCases).toHaveLength(before.pageCases.length + 1);
		expect(after.pageCases.some((entry) => entry.slug === draft!.slug)).toBe(true);
		expect(after.variantCases).toEqual(before.variantCases);
		expect(after.matrixHash).not.toBe(before.matrixHash);
	});
});
