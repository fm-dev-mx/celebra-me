import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-serenata',
	eventType: 'xv',
	routeSlug: 'serenata',
	showroom: {
		title: 'Serenata',
		styleName: 'Serenata',
		showConversion: false,
		description:
			'Un sobre de noche verde que se abre a un jardín, palo de rosa y champaña, y una canción dedicada.',
		styleTags: ['Jardín', 'Elegante'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		sortOrder: 60,
		ctaMessage: 'Hola, quisiera conocer el estilo Serenata para una invitación de XV años.',
		thumbnail: {
			key: 'hero',
			alt: 'Regina con vestido palo de rosa junto a la fuente del jardín',
			objectPosition: '62% 36%',
		},
	},
});
