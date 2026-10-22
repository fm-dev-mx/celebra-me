import type {
	DemoShowroomItem,
	DemoShowroomThumbnail,
} from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventType } from '@/lib/theme/theme-contract';

/** A showroom image of the demo itself; the asset slug is always the demo slug. */
type DemoInvitationThumbnail = Omit<DemoShowroomThumbnail, 'assetSlug'>;

/** Showroom card fields a demo declares; slug, route and public slug are derived. */
export type DemoShowroomCard = Omit<
	DemoShowroomItem,
	'eventType' | 'publicSlug' | 'slug' | 'href' | 'thumbnail' | 'selectorThumbnail'
> & {
	thumbnail: DemoInvitationThumbnail;
	selectorThumbnail?: DemoInvitationThumbnail;
};

/**
 * A demo invitation folder, `src/invitations/demos/<slug>/`:
 * - `invitation.ts`: this document (slug, event type, showroom card);
 * - `content.json`: the event content the `event-demos` collection loads;
 * - `assets.ts` + `assets/`: the image manifest and its files;
 * - `profile.scss` (optional): the token-only visual profile named by `visualProfileId`.
 */
export interface DemoInvitationDocument {
	slug: string;
	eventType: EventType;
	/** Optional short public route, distinct from the internal demo asset identity. */
	routeSlug?: string;
	conversionPhotos?: {
		gallery: DemoInvitationThumbnail;
		closing: DemoInvitationThumbnail;
	};
	showroom: DemoShowroomCard;
}

export function defineDemoInvitation<const T extends DemoInvitationDocument>(document: T): T {
	return document;
}
