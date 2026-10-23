import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-bautizo-angelic-presence',
	eventType: 'bautizo',
	routeSlug: 'angelical',
	showroom: {
		title: 'Bautizo estilo Angelical',
		description: 'Delicada, familiar y luminosa.',
		styleTags: ['delicada', 'familiar'],
		views: 4,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Angelic Presence',
		ctaMessage:
			'Hola, revisé la demo de bautizo Angelic Presence y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de bautizo estilo Angelic Presence',
		},
	},
});
