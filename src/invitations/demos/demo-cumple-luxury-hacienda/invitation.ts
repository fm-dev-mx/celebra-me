import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-cumple-luxury-hacienda',
	eventType: 'cumple',
	showroom: {
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
			key: 'hero',
			alt: 'Vista principal del demo de cumpleaños estilo Luxury Hacienda',
		},
	},
});
