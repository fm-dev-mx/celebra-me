import { readFileSync } from 'node:fs';
import * as registry from '../../scripts/provision/invitations/registry';
import {
	buildVisualPageCases,
	buildVisualCoverageCases,
	describeVisualMatrixDrift,
	discoverDemoCases,
	selectVisualPageCases,
	VISUAL_CANDIDATE_COMMAND,
} from '../../scripts/screenshot/visual-coverage-contract';
import { affectedVisualPages } from '../../scripts/screenshot/visual-affected-pages';

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
		const { matrixHash } = buildVisualCoverageCases();
		if (manifest.matrixHash !== matrixHash) {
			throw new Error(describeVisualMatrixDrift(manifest.matrixHash, matrixHash));
		}
	});
	it('scopes complete-page cases to named slugs and rejects unknown ones', () => {
		const cases = buildVisualPageCases();
		const [first, second] = cases;
		expect(selectVisualPageCases(cases, undefined)).toEqual(cases);
		expect(
			selectVisualPageCases(cases, ` ${second.slug},${first.slug} `).map((c) => c.slug),
		).toEqual([first.slug, second.slug]);
		expect(() => selectVisualPageCases(cases, 'no-such-page')).toThrow('no-such-page');
	});
	it('maps changed files to the pages that own them and keeps shared files apart', () => {
		const cases = buildVisualPageCases();
		const america = cases.find((entry) => entry.slug === 'america');
		const demo = cases.find((entry) => entry.kind === 'demo');
		expect(america && demo).toBeTruthy();
		const result = affectedVisualPages(
			[
				'scripts/provision/invitations/america.ts',
				'src/styles/invitation-profiles/america.scss',
				`src/invitations/demos/${demo!.slug}/content.json`,
				'src/styles/invitation/scenes/_lantern-route.scss',
				'docs/core/invitation-creation-contract.md',
			],
			cases,
		);
		expect(result.pages.map((entry) => entry.slug).sort()).toEqual(
			['america', demo!.slug].sort(),
		);
		expect(result.shared).toEqual(['src/styles/invitation/scenes/_lantern-route.scss']);
	});
	it('names the current hash and the regeneration commands when the matrix drifts', () => {
		const message = describeVisualMatrixDrift('a'.repeat(64), 'b'.repeat(64));
		expect(message).toContain(`accepted ${'a'.repeat(64)}, current ${'b'.repeat(64)}`);
		expect(message).toContain(VISUAL_CANDIDATE_COMMAND);
		expect(message).toContain(`--matrix-hash=${'b'.repeat(64)}`);
	});
});
