import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from '../../scripts/provision/invitations/registry.ts';
import {
	buildManagedPublishedContent,
	collectPlaceholderStrings,
} from '../helpers/managed-payload';

const slugs = listInvitationDefinitions().map((definition) => definition.slug);

describe('managed invitation payloads', () => {
	it('covers the recently onboarded definitions', () => {
		expect(slugs).toEqual(
			expect.arrayContaining(['allison-scarlett', 'america', 'naydelin-paredes']),
		);
	});

	it.each(slugs)('%s resolves from the registry by its own slug', (slug) => {
		expect(getInvitationDefinition(slug).slug).toBe(slug);
	});

	it.each(slugs)('%s publishes schema-valid content', (slug) => {
		const result = eventContentSchema.safeParse(buildManagedPublishedContent(slug));
		expect({
			success: result.success,
			...(result.success ? {} : { issues: result.error.issues }),
		}).toStrictEqual({ success: true });
	});

	it.each(slugs)('%s publishes no placeholder or admin copy', (slug) => {
		expect(collectPlaceholderStrings(buildManagedPublishedContent(slug))).toEqual([]);
	});
});
