import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-boda-jewelry-box-wedding',
	eventType: 'boda',
	showroom: {
		title: 'Boda estilo Jewelry Box',
		description: 'Clásica, cálida y elegante.',
		styleTags: ['clásica', 'elegante'],
		views: 11,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para boda similar al demo Jewelry Box.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de boda estilo Jewelry Box',
		},
	},
});
