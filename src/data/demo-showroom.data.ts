import type {
	DemoShowroomEvent,
	DemoShowroomHomeEvent,
	DemoShowroomItem,
	DemoShowroomPublicSlug,
} from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventType } from '@/lib/theme/theme-contract';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import { buildPublicInvitationPath } from '@/utils/invitation-link';
/** Shared home-selector quote CTA; it sends the general quote of the promo calendar. */
const SHOWROOM_QUOTE_CTA = {
	label: 'Quiero una invitación así',
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
			'Explore estilos digitales para una celebración de XV años con RSVP, pases y galería.',
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
			'Conozca experiencias digitales para comunicar ceremonia, recepción y detalles de la boda.',
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
			'Vea propuestas digitales para compartir la celebración con familia y padrinos.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para bautizo. Vi sus demos y quiero asesoría para mi celebración.',
		homeSelector: {
			screenAlt: 'Portada de la demo de bautizo: foto del bebé, nombre, fecha y lugar',
			quoteCta: SHOWROOM_QUOTE_CTA,
		},
		sortOrder: 30,
	},
	{
		eventType: 'primera-comunion',
		publicSlug: 'primera-comunion',
		label: 'Primera comunión',
		description: 'Familia, padrinos, ubicación y confirmación en una invitación serena.',
		icon: 'Dove',
		showroomHref: '/demos/primera-comunion',
		heroTitle: 'Demos de invitaciones para primera comunión',
		heroDescription:
			'Vea una invitación digital para compartir la primera comunión con familia y padrinos.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para primera comunión. Vi sus demos y quiero asesoría para mi celebración.',
		sortOrder: 40,
	},
	{
		eventType: 'cumple',
		publicSlug: 'cumpleanos',
		alternatePublicSlugs: ['cumple'],
		label: 'Cumpleaños y eventos',
		description: 'Celebraciones sociales con invitación digital y confirmación.',
		icon: 'Cake',
		showroomHref: '/demos/cumpleanos',
		heroTitle: 'Demos de invitaciones para cumpleaños',
		heroDescription:
			'Explore una invitación digital para celebraciones personales, familiares o de aniversario.',
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

/** Showroom cards, one per demo folder in `src/invitations/demos/` (slug, route and asset derived). */
export const DEMO_SHOWROOM_ITEMS: readonly DemoShowroomItem[] = DEMO_INVITATIONS.map(
	({ slug, eventType, showroom }) => {
		const { thumbnail, selectorThumbnail, ...card } = showroom;
		const event = DEMO_SHOWROOM_EVENTS.find((candidate) => candidate.eventType === eventType);
		if (!event) throw new Error(`Demo ${slug} has no showroom event for "${eventType}".`);
		return {
			eventType,
			publicSlug: event.publicSlug,
			slug,
			href: buildPublicInvitationPath(eventType, slug),
			...card,
			thumbnail: { assetSlug: slug, ...thumbnail },
			...(selectorThumbnail
				? { selectorThumbnail: { assetSlug: slug, ...selectorThumbnail } }
				: {}),
		};
	},
);

/** Events with a tab in the landing event selector, in showroom order. */
export const DEMO_SHOWROOM_HOME_EVENTS: readonly DemoShowroomHomeEvent[] =
	DEMO_SHOWROOM_EVENTS.filter(
		(event): event is DemoShowroomHomeEvent => event.homeSelector !== undefined,
	);

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
