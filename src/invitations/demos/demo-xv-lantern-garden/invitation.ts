import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-lantern-garden',
	eventType: 'xv',
	routeSlug: 'jardin-de-luz',
	showroom: {
		title: 'Jardín de Luz',
		styleName: 'Jardín de Luz',
		showConversion: false,
		description: 'Una noche lila, una carta y el cariño de su familia.',
		styleTags: ['Nocturna', 'Emotiva'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		sortOrder: 50,
		ctaMessage:
			'Hola, quisiera conocer el estilo Jardín de Luz para una invitación de XV años.',
		thumbnail: {
			key: 'hero',
			alt: 'Luciana Isabel con vestido lila en un jardín de linternas',
			objectPosition: '50% 55%',
		},
	},
});
