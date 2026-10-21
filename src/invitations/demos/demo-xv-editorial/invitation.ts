import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-editorial',
	eventType: 'xv',
	showroom: {
		title: 'Editorial',
		description: 'Moderna, limpia y editorial.',
		styleTags: ['Moderna', 'Limpia'],
		views: 10,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 40,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Editorial.',
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
