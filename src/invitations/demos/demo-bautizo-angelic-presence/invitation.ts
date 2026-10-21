import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-bautizo-angelic-presence',
	eventType: 'bautizo',
	showroom: {
		title: 'Bautizo estilo Angelical',
		description: 'Delicada, familiar y luminosa.',
		styleTags: ['delicada', 'familiar'],
		views: 4,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para bautizo similar al demo Angelic Presence.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de bautizo estilo Angelic Presence',
		},
	},
});
