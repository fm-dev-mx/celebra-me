import type {
	DemoShowroomEvent,
	DemoShowroomItem,
	DemoShowroomPublicSlug,
} from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventType } from '@/lib/theme/theme-contract';
import { CELESTIAL_QUOTE_MESSAGE } from '@/lib/invitation/demo-conversion';
import {
	buildGeneralMessage,
	getGeneralPromoCode,
	getStartingPrice,
} from '@/data/promo-campaign.data';

/** Shared home-selector quote CTA: the general promo message, code and value. */
const SHOWROOM_QUOTE_CTA = {
	label: 'Cotizar por WhatsApp',
	message: buildGeneralMessage(),
	promoCode: getGeneralPromoCode(),
	trackValue: getStartingPrice(),
} as const;

export const DEMO_SHOWROOM_EVENTS: readonly DemoShowroomEvent[] = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		label: 'XV años',
		description: 'Diseños con galería, música y pases para una celebración ordenada.',
		icon: 'Crown',
		showroomHref: '/demos/xv',
		heroTitle: 'Demos de invitaciones para XV años',
		heroDescription:
			'Explora estilos digitales para una celebración de XV años con RSVP, pases y galería.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para XV años. Vi sus demos y quiero asesoría para elegir estilo.',
		homeSelector: {
			screenAlt:
				'Portada de la demo de XV años: foto de la quinceañera, nombre, fecha y lugar',
			quoteCta: SHOWROOM_QUOTE_CTA,
		},
		sortOrder: 10,
	},
	{
		eventType: 'boda',
		publicSlug: 'boda',
		label: 'Boda',
		description: 'Ceremonia, recepción y confirmaciones en una invitación digital.',
		icon: 'Rings',
		showroomHref: '/demos/boda',
		heroTitle: 'Demos de invitaciones para boda',
		heroDescription:
			'Conoce experiencias digitales para comunicar ceremonia, recepción y detalles de la boda.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para boda. Quiero conocer opciones similares a sus demos.',
		homeSelector: {
			screenAlt: 'Portada de la demo de boda: foto de la pareja, nombres, fecha y lugar',
			quoteCta: SHOWROOM_QUOTE_CTA,
		},
		sortOrder: 20,
	},
	{
		eventType: 'bautizo',
		publicSlug: 'bautizo',
		alternatePublicSlugs: ['bautismo'],
		label: 'Bautizo',
		description: 'Detalles familiares, ubicación y confirmación en una invitación clara.',
		icon: 'Dove',
		showroomHref: '/demos/bautizo',
		heroTitle: 'Demos de invitaciones para bautizo',
		heroDescription:
			'Mira propuestas digitales para compartir la celebración con familia y padrinos.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para bautizo. Vi sus demos y quiero asesoría para mi celebración.',
		homeSelector: {
			screenAlt: 'Portada de la demo de bautizo: foto del bebé, nombre, fecha y lugar',
			quoteCta: SHOWROOM_QUOTE_CTA,
		},
		sortOrder: 30,
	},
	{
		eventType: 'cumple',
		publicSlug: 'cumpleanos',
		label: 'Cumpleaños y eventos',
		description: 'Celebraciones sociales con invitación digital y confirmación.',
		icon: 'Cake',
		showroomHref: '/demos/cumpleanos',
		heroTitle: 'Demos de invitaciones para cumpleaños',
		heroDescription:
			'Explora una invitación digital para celebraciones personales, familiares o de aniversario.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para cumpleaños. Vi sus demos y quiero conocer opciones.',
		homeSelector: {
			screenAlt:
				'Portada de la demo de cumpleaños: foto del festejado, nombre, fecha y lugar',
			quoteCta: SHOWROOM_QUOTE_CTA,
		},
		sortOrder: 50,
	},
] as const;

export const DEMO_SHOWROOM_ITEMS: readonly DemoShowroomItem[] = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-celestial-blue',
		href: '/xv/demo-xv-celestial-blue',
		title: 'XV Celestial Blue',
		description: 'Luminosa, elegante y ceremonial.',
		styleTags: ['Elegante', 'Luminosa'],
		views: 40,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage: CELESTIAL_QUOTE_MESSAGE,
		thumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 26%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 20%',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-enchanted-rose',
		href: '/xv/demo-xv-enchanted-rose',
		title: 'Enchanted Rose',
		description: 'Floral y romántica.',
		styleTags: ['Floral', 'Romántica'],
		views: 20,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 30,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Enchanted Rose.',
		thumbnail: {
			assetSlug: 'demo-xv-enchanted-rose',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-enchanted-rose',
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 18%',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-editorial',
		href: '/xv/demo-xv-editorial',
		title: 'Editorial',
		description: 'Moderna, limpia y editorial.',
		styleTags: ['Moderna', 'Limpia'],
		views: 10,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 40,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Editorial.',
		thumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
	},
	{
		eventType: 'boda',
		publicSlug: 'boda',
		slug: 'demo-boda-jewelry-box-wedding',
		href: '/boda/demo-boda-jewelry-box-wedding',
		title: 'Boda estilo Jewelry Box',
		description: 'Clásica, cálida y elegante.',
		styleTags: ['clásica', 'elegante'],
		views: 11,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para boda similar al demo Jewelry Box.',
		thumbnail: {
			assetSlug: 'demo-boda-jewelry-box-wedding',
			key: 'hero',
			alt: 'Vista principal del demo de boda estilo Jewelry Box',
		},
	},
	{
		eventType: 'bautizo',
		publicSlug: 'bautizo',
		slug: 'demo-bautismo-angelic-presence',
		href: '/bautizo/demo-bautismo-angelic-presence',
		title: 'Bautizo estilo Angelical',
		description: 'Delicada, familiar y luminosa.',
		styleTags: ['delicada', 'familiar'],
		views: 4,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para bautizo similar al demo Angelic Presence.',
		thumbnail: {
			assetSlug: 'demo-bautismo-angelic-presence',
			key: 'hero',
			alt: 'Vista principal del demo de bautizo estilo Angelic Presence',
		},
	},
	{
		eventType: 'cumple',
		publicSlug: 'cumpleanos',
		slug: 'demo-cumple-luxury-hacienda',
		href: '/cumple/demo-cumple-luxury-hacienda',
		title: 'Cumpleaños estilo Hacienda',
		description: 'Cálida, hacienda y con carácter.',
		styleTags: ['hacienda', 'cálida'],
		views: 2,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para cumpleaños similar al demo Luxury Hacienda.',
		thumbnail: {
			assetSlug: 'demo-cumple-luxury-hacienda',
			key: 'hero',
			alt: 'Vista principal del demo de cumpleaños estilo Luxury Hacienda',
		},
	},
] as const;

export function getDemoShowroomByPublicSlug(publicSlug: string): DemoShowroomEvent | undefined {
	return DEMO_SHOWROOM_EVENTS.find(
		(event) =>
			event.publicSlug === publicSlug ||
			event.alternatePublicSlugs?.includes(publicSlug as DemoShowroomPublicSlug),
	);
}

export function getFeaturedDemoShowroomItems(eventType?: EventType): DemoShowroomItem[] {
	return DEMO_SHOWROOM_ITEMS.filter((item) => {
		if (eventType && item.eventType !== eventType) return false;
		return item.visibility === 'featured' && item.reviewStatus === 'approved';
	}).sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.sortOrder - b.sortOrder);
}
