import type { EventType } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-registry';

export type DemoShowroomPublicSlug = 'xv' | 'boda' | 'bautizo' | 'baby-shower' | 'cumpleanos';

export type DemoShowroomVisibility = 'featured' | 'hidden';
export type DemoShowroomReviewStatus = 'approved' | 'needs-review';

export interface DemoShowroomThumbnail {
	assetSlug: string;
	key: EventAssetKey;
	alt: string;
}

export interface DemoShowroomPhonePreview {
	eyebrow: string;
	title: string;
	subtitle: string;
	date: string;
	venue: string;
	chips: readonly string[];
	actionLabel: string;
	imageAlt: string;
}

export interface DemoShowroomSideCopy {
	kicker: string;
	title: string;
	description: string;
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
	preview: DemoShowroomPhonePreview;
	showroom: DemoShowroomSideCopy;
	quoteCta: DemoShowroomQuoteCta;
}

export interface DemoShowroomEvent {
	eventType: EventType;
	publicSlug: DemoShowroomPublicSlug;
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
	visibility: DemoShowroomVisibility;
	reviewStatus: DemoShowroomReviewStatus;
	featured: boolean;
	sortOrder: number;
	ctaMessage: string;
	thumbnail: DemoShowroomThumbnail;
	exclusionReason?: string;
}
