import type { EventType } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-keys';

export type DemoShowroomPublicSlug =
	'xv' | 'boda' | 'bautizo' | 'bautismo' | 'cumple' | 'cumpleanos';

export type DemoShowroomVisibility = 'featured' | 'hidden';
export type DemoShowroomReviewStatus = 'approved' | 'needs-review';

export interface DemoShowroomThumbnail {
	assetSlug: string;
	key: EventAssetKey;
	alt: string;
	objectPosition?: string;
}

export interface DemoShowroomQuoteCta {
	label: string;
	message: string;
	promoCode: string;
	trackValue: number;
	packageName?: string;
	packageInterest?: string;
}

export interface DemoShowroomHomeSelector {
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
	homeSelector: DemoShowroomHomeSelector;
	sortOrder: number;
}

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
