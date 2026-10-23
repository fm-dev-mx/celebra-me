import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-cumple-luxury-hacienda',
	eventType: 'cumple',
	routeSlug: 'hacienda',
	showroom: {
		title: 'Cumpleaños estilo Hacienda',
		description: 'Cálida, hacienda y con carácter.',
		styleTags: ['hacienda', 'cálida'],
		views: 2,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Luxury Hacienda',
		ctaMessage:
			'Hola, revisé la demo de cumpleaños Luxury Hacienda y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de cumpleaños estilo Luxury Hacienda',
		},
	},
});
