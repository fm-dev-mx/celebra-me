import { DEMO_INVITATIONS } from '@/invitations/demos';
import type { DemoInvitationDocument } from '@/lib/invitation/demo-invitation';

export const DEMO_PREVIEW_WIDTH = 1200;
export const DEMO_PREVIEW_HEIGHT = 630;

export function isPublicDemo(demo: DemoInvitationDocument): boolean {
	return demo.showroom.visibility === 'featured' && demo.showroom.reviewStatus === 'approved';
}

/** Only catalog demos receive this metadata; managed invitations retain their own contract. */
export function getDemoMetadata(slug: string) {
	const demo = DEMO_INVITATIONS.find((candidate) => candidate.slug === slug);
	if (!demo) return undefined;
	const isPublic = isPublicDemo(demo);
	return {
		title: `Demo ${demo.showroom.title} | Celebra-me`,
		description: demo.showroom.description,
		canonicalPath: `/${demo.routeSlug}`,
		robots: isPublic ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
		...(isPublic
			? {
					image: `/images/demo-previews/${demo.routeSlug}.jpg`,
					imageAlt: demo.showroom.thumbnail.alt,
					imageWidth: DEMO_PREVIEW_WIDTH,
					imageHeight: DEMO_PREVIEW_HEIGHT,
				}
			: {}),
	};
}
