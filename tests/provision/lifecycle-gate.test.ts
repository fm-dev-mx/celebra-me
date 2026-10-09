import {
	LIFECYCLE_NOT_PUBLISHED,
	lifecycleReleaseBlock,
	lifecycleReleaseBlockFor,
} from '../../scripts/provision/invitations/lifecycle-gate.ts';
import {
	listAuthoringInvitationDefinitions,
	listPublishedInvitationDefinitions,
} from '../../scripts/provision/invitations/registry.ts';

describe('lifecycle release gate', () => {
	it('keeps authoring definitions off hosted targets and names the way out', () => {
		const block = lifecycleReleaseBlock({ slug: 'draft', lifecycle: 'in_progress' }, 'preview');
		expect(block).toContain(LIFECYCLE_NOT_PUBLISHED);
		expect(block).toContain('Preview');
		expect(block).toContain("lifecycle: 'published'");
		expect(
			lifecycleReleaseBlock({ slug: 'live', lifecycle: 'published' }, 'production'),
		).toBeNull();
		// Unknown slugs are reported by later steps, never by the gate.
		expect(lifecycleReleaseBlock(undefined, 'production')).toBeNull();
	});

	it('resolves the registry so every executor sees the same verdict as dbs', () => {
		for (const definition of listAuthoringInvitationDefinitions()) {
			expect(lifecycleReleaseBlockFor(definition.slug, 'production')).toContain(
				LIFECYCLE_NOT_PUBLISHED,
			);
		}
		for (const definition of listPublishedInvitationDefinitions()) {
			expect(lifecycleReleaseBlockFor(definition.slug, 'preview')).toBeNull();
		}
	});
});
