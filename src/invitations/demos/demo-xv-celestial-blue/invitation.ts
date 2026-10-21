import { CELESTIAL_QUOTE_MESSAGE } from '@/lib/invitation/demo-conversion';
import { defineDemoInvitation } from '@/lib/invitation/demo-invitation';

export default defineDemoInvitation({
	slug: 'demo-xv-celestial-blue',
	eventType: 'xv',
	showroom: {
		title: 'XV Celestial Blue',
		description: 'Luminosa, elegante y ceremonial.',
		styleTags: ['Elegante', 'Luminosa'],
		views: 40,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage: CELESTIAL_QUOTE_MESSAGE,
		thumbnail: {
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 26%',
		},
		selectorThumbnail: {
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 20%',
		},
	},
});
