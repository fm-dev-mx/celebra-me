import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-brisa',
	eventType: 'boda',
	routeSlug: 'brisa',
	conversionPhotos: {
		gallery: { key: 'interlude03', alt: 'Ximena y Diego juntos en una terraza costera.' },
		closing: {
			key: 'interlude04',
			alt: 'Ximena y Diego sonrientes junto a un sendero frente al mar.',
		},
	},
	showroom: {
		title: 'Brisa',
		description: 'Una boda frente al mar, entre papel marfil, lino y detalles costeros.',
		styleTags: ['clásica', 'elegante', 'editorial'],
		views: 11,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Brisa',
		ctaMessage:
			'Hola, revisé la demo de boda Brisa y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'portrait',
			alt: 'Vista principal del demo de boda estilo Brisa en la costa al atardecer',
		},
	},
});
