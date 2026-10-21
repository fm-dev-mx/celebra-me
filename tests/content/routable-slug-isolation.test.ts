import { listDemoInvitationFiles } from '../../scripts/shared/demo-invitation-files.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

describe('routable slug isolation', () => {
	it('keeps demo slugs distinct from every invitation definition slug', () => {
		const definitionSlugs = new Set(listInvitationDefinitions().map(({ slug }) => slug));
		const collisions = listDemoInvitationFiles()
			.map(({ slug }) => slug)
			.filter((slug) => definitionSlugs.has(slug));
		expect(collisions).toEqual([]);
	});
});
