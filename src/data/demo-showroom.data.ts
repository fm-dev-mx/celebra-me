import type {
	DemoShowroomEvent,
	DemoShowroomItem,
	DemoShowroomPublicSlug,
} from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventType } from '@/lib/theme/theme-contract';

export const DEMO_SHOWROOM_EVENTS: readonly DemoShowroomEvent[] = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		label: 'XV años',
		description: 'Diseños con galería, música y pases para una celebración ordenada.',
		icon: 'Crown',
		showroomHref: '/demos/xv',
		heroTitle: 'Demos de invitaciones para XV años',
		heroDescription:
			'Explora estilos digitales para una celebración de XV años con RSVP, pases y galería.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para XV años. Vi sus demos y quiero asesoría para elegir estilo.',
		homeSelector: {
			preview: {
				eyebrow: 'XV AÑOS',
				title: 'Sofía Valentina',
				subtitle: 'Una noche para celebrar',
				date: 'Sábado 28 de septiembre',
				venue: 'Gran Salón del Triunfo',
				chips: ['RSVP', 'PASES', 'WHATSAPP'],
				actionLabel: 'Confirmar asistencia',
				imageAlt: 'Quinceañera en salón elegante con flores y luz cálida',
			},
			showroom: {
				kicker: 'XV años',
				title: 'Una entrada luminosa para una noche de XV',
				description:
					'Diseñamos una invitación con RSVP, pases por familia, ubicación, música y galería para que cada invitado reciba una experiencia clara.',
			},
			quoteCta: {
				label: 'Cotizar esta invitación',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nEvento: XV años\n\nCupón: LANZAMIENTO-899',
				promoCode: 'LANZAMIENTO-899',
				trackValue: 899,
			},
		},
		sortOrder: 10,
	},
	{
		eventType: 'boda',
		publicSlug: 'boda',
		label: 'Boda',
		description: 'Ceremonia, recepción y confirmaciones en una invitación digital.',
		icon: 'Rings',
		showroomHref: '/demos/boda',
		heroTitle: 'Demos de invitaciones para boda',
		heroDescription:
			'Conoce experiencias digitales para comunicar ceremonia, recepción y detalles de la boda.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para boda. Quiero conocer opciones similares a sus demos.',
		homeSelector: {
			preview: {
				eyebrow: 'BODA',
				title: 'Mariana & Rodrigo',
				subtitle: 'Nos casamos',
				date: 'Sábado 14 de diciembre',
				venue: 'Hacienda San Miguel',
				chips: ['RSVP', 'PASES', 'WHATSAPP'],
				actionLabel: 'Confirmar asistencia',
				imageAlt: 'Recepción de boda elegante al atardecer con mesa floral y velas',
			},
			showroom: {
				kicker: 'Boda',
				title: 'Una invitación elegante para guiar a cada invitado',
				description:
					'Comparte ceremonia, recepción, mesa de regalos, confirmaciones y pases digitales en una experiencia visual coherente con tu estilo.',
			},
			quoteCta: {
				label: 'Cotizar esta invitación',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium para el paquete Premium.\n\nEvento: Boda\n\nCupón: LANZAMIENTO-1499',
				promoCode: 'LANZAMIENTO-1499',
				trackValue: 1499,
				packageName: 'Premium',
				packageInterest: 'premium',
			},
		},
		sortOrder: 20,
	},
	{
		eventType: 'bautizo',
		publicSlug: 'bautizo',
		alternatePublicSlugs: ['bautismo'],
		label: 'Bautizo',
		description: 'Detalles familiares, ubicación y confirmación en una invitación clara.',
		icon: 'Dove',
		showroomHref: '/demos/bautizo',
		heroTitle: 'Demos de invitaciones para bautizo',
		heroDescription:
			'Mira propuestas digitales para compartir la celebración con familia y padrinos.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para bautizo. Vi sus demos y quiero asesoría para mi celebración.',
		homeSelector: {
			preview: {
				eyebrow: 'BAUTIZO',
				title: 'Mateo Alejandro',
				subtitle: 'Celebración familiar',
				date: 'Domingo 6 de octubre',
				venue: 'Parroquia de San Miguel',
				chips: ['RSVP', 'PASES', 'WHATSAPP'],
				actionLabel: 'Confirmar asistencia',
				imageAlt: 'Detalle ceremonial de bautizo con vela, flores blancas y luz de iglesia',
			},
			showroom: {
				kicker: 'Bautizo',
				title: 'Una celebración familiar comunicada con claridad',
				description:
					'Organiza ceremonia, recepción, padrinos, ubicación y confirmaciones en una invitación clara y fácil de compartir.',
			},
			quoteCta: {
				label: 'Cotizar esta invitación',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nEvento: Bautizo\n\nCupón: LANZAMIENTO-899',
				promoCode: 'LANZAMIENTO-899',
				trackValue: 899,
			},
		},
		sortOrder: 30,
	},
	{
		eventType: 'baby-shower',
		publicSlug: 'baby-shower',
		label: 'Baby shower',
		description: 'Ubicación, regalos y confirmación en una invitación clara.',
		icon: 'Sparkles',
		showroomHref: '/demos/baby-shower',
		heroTitle: 'Demos de invitaciones para baby shower',
		heroDescription:
			'Descubre diseños digitales para anunciar una celebración con detalles claros.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para baby shower. Quiero asesoría para una invitación personalizada.',
		homeSelector: {
			preview: {
				eyebrow: 'BABY SHOWER',
				title: 'Valentina',
				subtitle: 'Bienvenida con amor',
				date: 'Sábado 12 de octubre',
				venue: 'La Casona del Lago',
				chips: ['RSVP', 'MESA DE REGALOS', 'WHATSAPP'],
				actionLabel: 'Confirmar asistencia',
				imageAlt: 'Mesa de baby shower cálida con flores, regalos y decoración delicada',
			},
			showroom: {
				kicker: 'Baby shower',
				title: 'Una bienvenida clara y fácil de compartir',
				description:
					'Reúne ubicación, mesa de regalos, galería y confirmaciones en una experiencia clara para familiares y amigos.',
			},
			quoteCta: {
				label: 'Cotizar esta invitación',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nEvento: Baby shower\n\nCupón: LANZAMIENTO-899',
				promoCode: 'LANZAMIENTO-899',
				trackValue: 899,
			},
		},
		sortOrder: 40,
	},
	{
		eventType: 'cumple',
		publicSlug: 'cumpleanos',
		label: 'Cumpleaños y eventos',
		description: 'Celebraciones sociales con invitación digital y confirmación.',
		icon: 'Cake',
		showroomHref: '/demos/cumpleanos',
		heroTitle: 'Demos de invitaciones para cumpleaños',
		heroDescription:
			'Explora una invitación digital para celebraciones personales, familiares o de aniversario.',
		whatsAppMessage:
			'Hola, me gustaría una invitación digital para cumpleaños. Vi sus demos y quiero conocer opciones.',
		homeSelector: {
			preview: {
				eyebrow: 'CUMPLEAÑOS',
				title: 'Regina',
				subtitle: 'Una noche para brindar',
				date: 'Viernes 18 de octubre',
				venue: 'Casa Aurelia',
				chips: ['RSVP', 'UBICACIÓN', 'WHATSAPP'],
				actionLabel: 'Confirmar asistencia',
				imageAlt: 'Pastel de cumpleaños elegante con velas y mesa de cena cálida',
			},
			showroom: {
				kicker: 'Cumpleaños',
				title: 'Una celebración clara desde el primer mensaje',
				description:
					'Comparte horario, ubicación, confirmaciones y detalles importantes en una invitación visualmente cuidada.',
			},
			quoteCta: {
				label: 'Cotizar esta invitación',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nEvento: Cumpleaños\n\nCupón: LANZAMIENTO-899',
				promoCode: 'LANZAMIENTO-899',
				trackValue: 899,
			},
		},
		sortOrder: 50,
	},
] as const;

export const DEMO_SHOWROOM_ITEMS: readonly DemoShowroomItem[] = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-jewelry-box',
		href: '/xv/demo-xv-jewelry-box',
		title: 'Jewelry Box',
		description: 'Floral, luminosa y clásica.',
		styleTags: ['floral', 'jardín'],
		views: 0,
		visibility: 'hidden',
		reviewStatus: 'approved',
		sortOrder: 100,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Jewelry Box.',
		thumbnail: {
			assetSlug: 'demo-xv-jewelry-box',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Jewelry Box',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-celestial-blue',
		href: '/xv/demo-xv-celestial-blue',
		title: 'XV Celestial Blue',
		description: 'Luminosa, elegante y ceremonial.',
		styleTags: ['Elegante', 'Luminosa'],
		views: 40,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Celestial Blue.',
		thumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 26%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Celestial Blue',
			objectPosition: '50% 20%',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-editorial-magazine',
		href: '/xv/demo-xv-editorial-magazine',
		title: 'Editorial Magazine',
		description: 'Editorial, sofisticada y visual.',
		styleTags: ['Sofisticada', 'Visual'],
		views: 30,
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 20,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Editorial Magazine.',
		thumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'portrait',
			alt: 'Vista principal del demo de XV años estilo Editorial Magazine',
			objectPosition: '50% 18%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Editorial Magazine',
			objectPosition: '50% 18%',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-enchanted-rose',
		href: '/xv/demo-xv-enchanted-rose',
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
			assetSlug: 'demo-xv-enchanted-rose',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-enchanted-rose',
			key: 'portrait',
			alt: 'Retrato del demo de XV años estilo Enchanted Rose',
			objectPosition: '50% 18%',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-editorial',
		href: '/xv/demo-xv-editorial',
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
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
		selectorThumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
			objectPosition: '50% 24%',
		},
	},
	{
		eventType: 'boda',
		publicSlug: 'boda',
		slug: 'demo-boda-jewelry-box-wedding',
		href: '/boda/demo-boda-jewelry-box-wedding',
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
			assetSlug: 'demo-boda-jewelry-box-wedding',
			key: 'hero',
			alt: 'Vista principal del demo de boda estilo Jewelry Box',
		},
	},
	{
		eventType: 'bautizo',
		publicSlug: 'bautizo',
		slug: 'demo-bautismo-angelic-presence',
		href: '/bautizo/demo-bautismo-angelic-presence',
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
			assetSlug: 'demo-bautismo-angelic-presence',
			key: 'hero',
			alt: 'Vista principal del demo de bautizo estilo Angelic Presence',
		},
	},
	{
		eventType: 'baby-shower',
		publicSlug: 'baby-shower',
		slug: 'demo-baby-shower-celestial',
		href: '/baby-shower/demo-baby-shower-celestial',
		title: 'Baby shower estilo Celestial',
		description: 'Suave, celestial y emotiva.',
		styleTags: ['celestial', 'suave'],
		visibility: 'featured',
		reviewStatus: 'approved',
		sortOrder: 10,
		ctaMessage:
			'Hola, me gustaría una invitación digital para baby shower similar al demo Celestial.',
		thumbnail: {
			assetSlug: 'demo-baby-shower-celestial',
			key: 'hero',
			alt: 'Vista principal del demo de baby shower estilo Celestial',
		},
	},
	{
		eventType: 'cumple',
		publicSlug: 'cumpleanos',
		slug: 'demo-cumple-luxury-hacienda',
		href: '/cumple/demo-cumple-luxury-hacienda',
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
			assetSlug: 'demo-cumple-luxury-hacienda',
			key: 'hero',
			alt: 'Vista principal del demo de cumpleaños estilo Luxury Hacienda',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-valentina-profile',
		href: '/xv/demo-xv-valentina-profile',
		title: 'XV años edición Valentina',
		description:
			'Variante de perfil pendiente de revisión editorial antes de exposición pública.',
		styleTags: ['perfil', 'editorial'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		sortOrder: 900,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años. Quiero conocer opciones editoriales.',
		thumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal de variante editorial de XV años',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-xareni-profile',
		href: '/xv/demo-xv-xareni-profile',
		title: 'XV años edición Xareni',
		description:
			'Variante de perfil pendiente de revisión editorial antes de exposición pública.',
		styleTags: ['perfil', 'celestial'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		sortOrder: 910,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años. Quiero conocer opciones celestiales.',
		thumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'hero',
			alt: 'Vista principal de variante celestial de XV años',
		},
	},
] as const;

export function getDemoShowroomByPublicSlug(publicSlug: string): DemoShowroomEvent | undefined {
	return DEMO_SHOWROOM_EVENTS.find(
		(event) =>
			event.publicSlug === publicSlug ||
			event.alternatePublicSlugs?.includes(publicSlug as DemoShowroomPublicSlug),
	);
}

export function getFeaturedDemoShowroomItems(eventType?: EventType): DemoShowroomItem[] {
	return DEMO_SHOWROOM_ITEMS.filter((item) => {
		if (eventType && item.eventType !== eventType) return false;
		return item.visibility === 'featured' && item.reviewStatus === 'approved';
	}).sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.sortOrder - b.sortOrder);
}
