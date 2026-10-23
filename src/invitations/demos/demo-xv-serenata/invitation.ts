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
			'Un sobre de noche verde que se abre a un olivar, verde salvia y champaña, y una canción dedicada.',
		styleTags: ['Jardín', 'Elegante'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		sortOrder: 60,
		ctaMessage: 'Hola, quisiera conocer el estilo Serenata para una invitación de XV años.',
		thumbnail: {
			key: 'hero',
			alt: 'Regina con vestido champaña y fajín verde salvia bajo una pérgola con enredadera',
			objectPosition: '72% 55%',
		},
	},
});
