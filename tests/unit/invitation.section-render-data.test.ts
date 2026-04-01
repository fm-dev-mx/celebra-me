import fs from 'node:fs';
import path from 'node:path';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import { prepareInvitationPageData } from '@/lib/invitation/page-data';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('buildInvitationSectionRenderDescriptors', () => {
	it('derives the next anchorable section for location navigation from the render plan', () => {
		const eventEntry = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageData>[0]['eventEntry'];

		const pageData = prepareInvitationPageData({
			eventEntry,
			slug: 'ximena-meza-trasvina',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageData);
		const locationDescriptor = descriptors.find((descriptor) => descriptor.kind === 'location');

		expect(locationDescriptor).toMatchObject({
			kind: 'location',
			props: {
				nextSectionLink: {
					href: '#family-section',
					label: 'Familia',
				},
			},
		});
	});
});
