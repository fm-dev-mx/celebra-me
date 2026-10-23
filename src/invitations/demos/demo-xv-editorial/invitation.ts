import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-editorial',
	eventType: 'xv',
	routeSlug: 'editorial',
	showroom: {
		title: 'Editorial',
		description: 'Moderna, limpia y editorial.',
		styleTags: ['Moderna', 'Limpia'],
		views: 10,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 40,
		styleName: 'Editorial',
		ctaMessage:
			'Hola, revisé la demo de XV Editorial y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
	},
});
