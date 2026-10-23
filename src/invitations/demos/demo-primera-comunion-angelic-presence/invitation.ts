import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-primera-comunion-angelic-presence',
	eventType: 'primera-comunion',
	routeSlug: 'comunion-angelical',
	showroom: {
		title: 'Primera comunión estilo Angelical',
		description: 'Ilustrada, floral y fresca.',
		styleTags: ['ilustrada', 'floral'],
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Angelic Presence',
		ctaMessage:
			'Hola, revisé la demo de primera comunión Angelic Presence y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal de la demo de primera comunión estilo Angelic Presence',
		},
	},
});
