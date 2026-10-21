import type { ImageMetadata } from 'astro';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import type { DemoShowroomItem } from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventAssetKey } from '@/lib/assets/asset-keys';
import { getEventAsset } from '@/lib/assets/asset-registry';
import type { EventType } from '@/lib/theme/theme-contract';
import { getWhatsAppLink } from '@/utils/whatsapp';

/** Possessive phrase for the visitor's own celebration, in the "usted" register. */
const CELEBRATION_LABELS: Record<EventType, string> = {
	xv: 'sus XV años',
	boda: 'su boda',
	bautizo: 'su bautizo',
	'primera-comunion': 'su primera comunión',
	cumple: 'su cumpleaños',
	'baby-shower': 'su baby shower',
};

/** First available demo asset for the closing panel photo. */
const CLOSING_IMAGE_KEYS: readonly EventAssetKey[] = [
	'interlude04',
	'interlude02',
	'portrait',
	'hero',
];

export interface DemoConversionContext {
	slug: string;
	eventType: EventType;
	styleName: string;
	celebrationLabel: string;
	quoteLink: string;
	browseHref: string;
	closingImage?: ImageMetadata;
}

function findDemoItem(slug: string): DemoShowroomItem | undefined {
	return DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug);
}

/** Commercial composition is opt-in at the public page, never a section renderer decision. */
export function hasDemoConversion(slug: string, isDemo: boolean): boolean {
	return isDemo && findDemoItem(slug) !== undefined;
}

export function getDemoConversion(slug: string): DemoConversionContext | undefined {
	const item = findDemoItem(slug);
	if (!item) return undefined;
	const closingKey = CLOSING_IMAGE_KEYS.find((key) => getEventAsset(slug, key));
	return {
		slug,
		eventType: item.eventType,
		styleName: item.styleName,
		celebrationLabel: CELEBRATION_LABELS[item.eventType],
		quoteLink: getWhatsAppLink(item.ctaMessage),
		browseHref: `/demos/${item.publicSlug}`,
		closingImage: closingKey ? getEventAsset(slug, closingKey) : undefined,
	};
}
