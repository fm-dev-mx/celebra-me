import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-primera-comunion-angelic-presence',
	eventType: 'primera-comunion',
	showroom: {
		title: 'Primera comunión estilo Angelical',
		description: 'Ilustrada, floral y fresca.',
		styleTags: ['ilustrada', 'floral'],
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para primera comunión similar a la demo Angelic Presence.',
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal de la demo de primera comunión estilo Angelic Presence',
		},
	},
});
