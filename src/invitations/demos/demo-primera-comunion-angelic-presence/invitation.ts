import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-primera-comunion-angelic-presence',
	eventType: 'primera-comunion',
	routeSlug: 'comunion-angelical',
	showroom: {
		title: 'Comunión Angelical',
		description:
			'Perla, oro y salvia: una invitación sacra para el día de la Primera Comunión.',
		styleTags: ['sacra', 'editorial'],
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Eucharistic Grace',
		ctaMessage:
			'Hola, revisé la demo de primera comunión Eucharistic Grace y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal de la demo de primera comunión estilo Eucharistic Grace',
		},
	},
});
