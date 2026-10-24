import type { EventType } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-keys';

export type DemoShowroomPublicSlug =
	'xv' | 'boda' | 'bautizo' | 'bautismo' | 'primera-comunion' | 'cumple' | 'cumpleanos';

type DemoShowroomVisibility = 'featured' | 'hidden';
type DemoShowroomReviewStatus = 'approved' | 'needs-review';

export interface DemoShowroomThumbnail {
	assetSlug: string;
	key: EventAssetKey;
	alt: string;
	objectPosition?: string;
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
	/** Short style name shown in the in-page sales block (e.g. "Celestial Blue"). */
	styleName: string;
	/** Insert commercial gallery/closing panels; enabled unless explicitly disabled. */
	showConversion?: boolean;
	ctaMessage: string;
	thumbnail: DemoShowroomThumbnail;
	selectorThumbnail?: DemoShowroomThumbnail;
}
