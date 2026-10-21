import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-boda-jewelry-box-wedding',
	eventType: 'boda',
	showroom: {
		title: 'Boda estilo Jewelry Box',
		description: 'Editorial de costa dorada, lino cálido y velada frente al mar.',
		styleTags: ['clásica', 'elegante', 'editorial'],
		views: 11,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'Jewelry Box',
		ctaMessage:
			'Hola, revisé la demo de boda Jewelry Box y quisiera cotizar una invitación basada en este estilo.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de boda estilo Jewelry Box en la costa al atardecer',
		},
	},
});
