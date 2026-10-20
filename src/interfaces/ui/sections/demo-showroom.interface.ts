import type { EventType } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-keys';

export type DemoShowroomPublicSlug =
	'xv' | 'boda' | 'bautizo' | 'bautismo' | 'primera-comunion' | 'cumple' | 'cumpleanos';

type DemoShowroomVisibility = 'featured' | 'hidden';
type DemoShowroomReviewStatus = 'approved' | 'needs-review';

interface DemoShowroomThumbnail {
	assetSlug: string;
	key: EventAssetKey;
	alt: string;
	objectPosition?: string;
}

/** The quote itself (message, promo code, value) is the general one from the promo calendar. */
interface DemoShowroomQuoteCta {
	label: string;
}

interface DemoShowroomHomeSelector {
	/** Alt text for the real demo screen shown in the landing phone frame. */
	screenAlt: string;
	quoteCta: DemoShowroomQuoteCta;
}

export interface DemoShowroomEvent {
	eventType: EventType;
	publicSlug: DemoShowroomPublicSlug;
	alternatePublicSlugs?: readonly DemoShowroomPublicSlug[];
	label: string;
	description: string;
	icon: string;
	showroomHref: string;
	heroTitle: string;
	heroDescription: string;
	whatsAppMessage: string;
	/** Present only for events with a tab in the landing event selector. */
	homeSelector?: DemoShowroomHomeSelector;
	sortOrder: number;
}

export type DemoShowroomHomeEvent = DemoShowroomEvent & { homeSelector: DemoShowroomHomeSelector };

export interface DemoShowroomItem {
	eventType: EventType;
	publicSlug: DemoShowroomPublicSlug;
	slug: string;
	href: string;
	title: string;
	description: string;
	styleTags: readonly string[];
	views?: number;
	visibility: DemoShowroomVisibility;
	reviewStatus: DemoShowroomReviewStatus;
	sortOrder: number;
	ctaMessage: string;
	thumbnail: DemoShowroomThumbnail;
	selectorThumbnail?: DemoShowroomThumbnail;
}
