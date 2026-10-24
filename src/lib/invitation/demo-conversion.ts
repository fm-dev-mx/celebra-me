import type { ImageMetadata } from 'astro';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import {
	buildVitrinaMessage,
	findVitrinaDemo,
	getVitrinaEvent,
	type VitrinaEntry,
} from '@/data/landing-vitrina.data';
import type { DemoShowroomItem } from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventAssetKey } from '@/lib/assets/asset-keys';
import { getEventAsset } from '@/lib/assets/asset-registry';
import type { EventType } from '@/lib/theme/theme-contract';
import { getWhatsAppLink } from '@/utils/whatsapp';
import { DEMO_INVITATIONS } from '@/invitations/demos';

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

/** Where a demo quotes: the floating button (extra, discreet) and the two sales panels. */
export type DemoQuotePlacement = 'floating' | 'gallery' | 'closing';

const QUOTE_ENTRIES: Record<DemoQuotePlacement, VitrinaEntry> = {
	floating: 'FLOTANTE',
	gallery: 'GALERIA',
	closing: 'CIERRE',
};

export interface DemoConversionContext {
	slug: string;
	eventType: EventType;
	styleName: string;
	celebrationLabel: string;
	/** WhatsApp link per placement; each message carries its own `Ref. EVENT-STYLE-ENTRY`. */
	quoteLinks: Record<DemoQuotePlacement, string>;
	/** Landing showroom open on this event (`/#xv`). */
	homeHref: string;
	/** Following showroom demo of the same event, wrapping to the first; absent when it is the only one. */
	nextDemo?: { href: string; name: string };
	closingImage?: ImageMetadata;
	closingImageAlt?: string;
	galleryImage?: { image: ImageMetadata; alt: string };
}

function findDemoItem(slug: string): DemoShowroomItem | undefined {
	return DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug && item.showConversion !== false);
}

/** Commercial composition is opt-in at the public page, never a section renderer decision. */
export function hasDemoConversion(slug: string, isDemo: boolean): boolean {
	return isDemo && findDemoItem(slug) !== undefined;
}

/** Showroom quote (`Ref. XV-CELESTIAL-CIERRE`); a demo outside the showroom keeps its own message. */
function buildQuoteLinks(item: DemoShowroomItem): Record<DemoQuotePlacement, string> {
	const event = getVitrinaEvent(item.publicSlug);
	const demo = findVitrinaDemo(item.slug);
	const message = (placement: DemoQuotePlacement) =>
		event && demo
			? buildVitrinaMessage(event, demo, QUOTE_ENTRIES[placement])
			: item.ctaMessage;
	return {
		floating: getWhatsAppLink(message('floating')),
		gallery: getWhatsAppLink(message('gallery')),
		closing: getWhatsAppLink(message('closing')),
	};
}

function findNextDemo(item: DemoShowroomItem): DemoConversionContext['nextDemo'] {
	const demos = getVitrinaEvent(item.publicSlug)?.demos ?? [];
	const index = demos.findIndex((demo) => demo.slug === item.slug);
	const next = demos[(index + 1) % demos.length];
	return next && next.slug !== item.slug ? { href: next.href, name: next.name } : undefined;
}

export function getDemoConversion(slug: string): DemoConversionContext | undefined {
	const item = findDemoItem(slug);
	if (!item) return undefined;
	const closingKey = CLOSING_IMAGE_KEYS.find((key) => getEventAsset(slug, key));
	const photos = DEMO_INVITATIONS.find((demo) => demo.slug === slug)?.conversionPhotos;
	const galleryImage = photos ? getEventAsset(slug, photos.gallery.key) : undefined;
	return {
		slug,
		eventType: item.eventType,
		styleName: item.styleName,
		celebrationLabel: CELEBRATION_LABELS[item.eventType],
		quoteLinks: buildQuoteLinks(item),
		homeHref: `/#${item.publicSlug}`,
		nextDemo: findNextDemo(item),
		closingImage: photos
			? getEventAsset(slug, photos.closing.key)
			: closingKey
				? getEventAsset(slug, closingKey)
				: undefined,
		closingImageAlt: photos?.closing.alt,
		galleryImage:
			galleryImage && photos ? { image: galleryImage, alt: photos.gallery.alt } : undefined,
	};
}
