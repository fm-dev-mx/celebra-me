import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-enchanted-rose',
	eventType: 'xv',
	showroom: {
		title: 'Enchanted Rose',
		description: 'Floral y romántica.',
		styleTags: ['Floral', 'Romántica'],
		views: 20,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 30,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Enchanted Rose.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 18%',
		},
	},
});
