import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-graduacion-siguiente-capitulo',
	eventType: 'graduacion',
	routeSlug: 'el-siguiente-capitulo',
	showroom: {
		title: 'El siguiente capítulo',
		description: 'Un portafolio de recuerdos y una historia de gratitud.',
		styleTags: ['Editorial', 'Portafolio'],
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		styleName: 'El siguiente capítulo',
		ctaMessage:
			'Hola, vi la demo El siguiente capítulo y me gustaría una invitación para mi graduación.',
		thumbnail: {
			key: 'hero',
			alt: 'Lucía con toga azul marino y birrete en una escena ficticia de graduación',
			objectPosition: '70% 45%',
		},
	},
});
