import type {
	DemoShowroomEvent,
	DemoShowroomItem,
	DemoShowroomPublicSlug,
} from '@/interfaces/ui/sections/demo-showroom.interface';
import type { EventType } from '@/lib/theme/theme-contract';

export const DEMO_SHOWROOM_EVENTS = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		label: 'XV años',
		description: 'Diseños con galería, música y pases para una noche inolvidable.',
		icon: 'Crown',
		showroomHref: '/demos/xv',
		heroTitle: 'Demos de invitaciones para XV años',
		heroDescription:
			'Explore estilos digitales para una celebración de XV años elegante, clara y memorable.',
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
					'Diseñamos una invitación con RSVP, pases por familia, ubicación, música, galería y detalles personalizados para que cada invitado reciba una experiencia clara desde WhatsApp.',
			},
			quoteCta: {
				label: 'Cotizar mis XV',
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
		description: 'Ceremonia, recepción y confirmaciones en un enlace elegante.',
		icon: 'Rings',
		showroomHref: '/demos/boda',
		heroTitle: 'Demos de invitaciones para boda',
		heroDescription:
			'Conozca experiencias digitales pensadas para comunicar ceremonia, recepción y detalles con sobriedad.',
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
					'Comparte ceremonia, recepción, mesa de regalos, confirmaciones y pases digitales en una experiencia visual coherente con el estilo de tu boda.',
			},
			quoteCta: {
				label: 'Cotizar mi boda',
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
		label: 'Bautizo',
		description: 'Detalles familiares, ubicación y confirmación en una experiencia delicada.',
		icon: 'Dove',
		showroomHref: '/demos/bautizo',
		heroTitle: 'Demos de invitaciones para bautizo',
		heroDescription:
			'Vea propuestas digitales delicadas para compartir la celebración con familia y padrinos.',
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
				title: 'Una celebración familiar comunicada con delicadeza',
				description:
					'Organiza ceremonia, recepción, padrinos, ubicación y confirmaciones en una invitación clara, elegante y fácil de compartir.',
			},
			quoteCta: {
				label: 'Cotizar mi bautizo',
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
		description: 'Una invitación dulce para compartir ubicación, regalos y asistencia.',
		icon: 'Sparkles',
		showroomHref: '/demos/baby-shower',
		heroTitle: 'Demos de invitaciones para baby shower',
		heroDescription:
			'Descubra diseños digitales tiernos y ordenados para anunciar una celebración llena de ilusión.',
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
				title: 'Una bienvenida cálida, ordenada y fácil de compartir',
				description:
					'Reúne ubicación, mesa de regalos, galería y confirmaciones en una experiencia clara para familiares y amigos.',
			},
			quoteCta: {
				label: 'Cotizar mi baby shower',
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
		description: 'Celebraciones sociales con información clara y envío por WhatsApp.',
		icon: 'Cake',
		showroomHref: '/demos/cumpleanos',
		heroTitle: 'Demos de invitaciones para cumpleaños',
		heroDescription:
			'Explore una experiencia digital pensada para celebraciones personales, familiares o de aniversario.',
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
					'Comparte horario, ubicación, confirmaciones y detalles importantes en una invitación visualmente cuidada y fácil de reenviar.',
			},
			quoteCta: {
				label: 'Cotizar mi evento',
				message:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nEvento: Cumpleaños\n\nCupón: LANZAMIENTO-899',
				promoCode: 'LANZAMIENTO-899',
				trackValue: 899,
			},
		},
		sortOrder: 50,
	},
] as const satisfies readonly DemoShowroomEvent[];

export const DEMO_SHOWROOM_ITEMS = [
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-jewelry-box',
		href: '/xv/demo-xv-jewelry-box',
		title: 'XV años estilo Jewelry Box',
		description:
			'Una experiencia elegante con acentos luminosos, galería amplia y tono premium.',
		styleTags: ['elegante', 'fotográfica', 'premium'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
		sortOrder: 10,
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
		title: 'XV años estilo Celestial Blue',
		description:
			'Una propuesta luminosa y editorial con paleta azul suave y presencia fotográfica.',
		styleTags: ['celestial', 'azul', 'editorial'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
		sortOrder: 20,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Celestial Blue.',
		thumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Celestial Blue',
		},
	},
	{
		eventType: 'xv',
		publicSlug: 'xv',
		slug: 'demo-xv-editorial',
		href: '/xv/demo-xv-editorial',
		title: 'XV años estilo Editorial',
		description: 'Un diseño sobrio y visual, ideal para una presentación moderna y refinada.',
		styleTags: ['editorial', 'moderna', 'sobria'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
		sortOrder: 30,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años similar al demo Editorial.',
		thumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal del demo de XV años estilo Editorial',
		},
	},
	{
		eventType: 'boda',
		publicSlug: 'boda',
		slug: 'demo-boda-jewelry-box-wedding',
		href: '/boda/demo-boda-jewelry-box-wedding',
		title: 'Boda estilo Jewelry Box',
		description:
			'Una invitación refinada para ceremonia y recepción con estética clásica y luminosa.',
		styleTags: ['romántica', 'clásica', 'refinada'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
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
		description:
			'Una propuesta delicada y familiar para compartir ceremonia, padrinos y recepción.',
		styleTags: ['delicada', 'familiar', 'angelical'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
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
		description:
			'Un diseño suave y emotivo para anunciar una bienvenida con detalles memorables.',
		styleTags: ['celestial', 'suave', 'emotiva'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
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
		description:
			'Una experiencia con carácter para celebrar una fecha especial con familia e invitados.',
		styleTags: ['hacienda', 'cálida', 'con carácter'],
		visibility: 'featured',
		reviewStatus: 'approved',
		featured: true,
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
		featured: false,
		sortOrder: 900,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años. Quiero conocer opciones editoriales.',
		thumbnail: {
			assetSlug: 'demo-xv-editorial',
			key: 'hero',
			alt: 'Vista principal de variante editorial de XV años',
		},
		exclusionReason: 'Perfil/client-like demo pendiente de revisión manual.',
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
		featured: false,
		sortOrder: 910,
		ctaMessage:
			'Hola, me gustaría una invitación digital para XV años. Quiero conocer opciones celestiales.',
		thumbnail: {
			assetSlug: 'demo-xv-celestial-blue',
			key: 'hero',
			alt: 'Vista principal de variante celestial de XV años',
		},
		exclusionReason: 'Perfil/client-like demo pendiente de revisión manual.',
	},
	{
		eventType: 'primera-comunion',
		publicSlug: 'bautizo',
		slug: 'demo-primera-comunion-illustrated',
		href: '/primera-comunion/demo-primera-comunion-illustrated',
		title: 'Primera comunión ilustrada',
		description: 'Demo relacionado, no incluido en el alcance público inicial de showrooms.',
		styleTags: ['familiar', 'ilustrada'],
		visibility: 'hidden',
		reviewStatus: 'needs-review',
		featured: false,
		sortOrder: 920,
		ctaMessage:
			'Hola, me gustaría una invitación digital para primera comunión. Quiero conocer opciones.',
		thumbnail: {
			assetSlug: 'demo-primera-comunion-illustrated',
			key: 'hero',
			alt: 'Vista principal del demo de primera comunión ilustrada',
		},
		exclusionReason: 'Tipo de evento diferido fuera del alcance Phase 1/2.',
	},
] as const satisfies readonly DemoShowroomItem[];

export function getDemoShowroomByPublicSlug(publicSlug: string): DemoShowroomEvent | undefined {
	return DEMO_SHOWROOM_EVENTS.find((event) => event.publicSlug === publicSlug);
}

export function getDemoShowroomByEventType(eventType: EventType): DemoShowroomEvent | undefined {
	return DEMO_SHOWROOM_EVENTS.find((event) => event.eventType === eventType);
}

export function getFeaturedDemoShowroomItems(eventType?: EventType): DemoShowroomItem[] {
	return DEMO_SHOWROOM_ITEMS.filter((item) => {
		if (eventType && item.eventType !== eventType) return false;
		return item.visibility === 'featured' && item.reviewStatus === 'approved' && item.featured;
	}).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getShowroomPublicSlugs(): DemoShowroomPublicSlug[] {
	return DEMO_SHOWROOM_EVENTS.map((event) => event.publicSlug);
}
