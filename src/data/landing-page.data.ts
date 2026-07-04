import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Invitaciones digitales elegantes para confirmar y guiar a tus invitados',
		subtitle:
			'RSVP, pases digitales, ubicación, música y galería en una experiencia personalizada para compartir por WhatsApp.',
		primaryCtaLabel: 'Cotizar por WhatsApp',
		secondaryCtaLabel: 'Ver demos reales',
		secondaryCtaUrl: '#tipo-evento',
		whatsappPhone: import.meta.env.CONTACT_WHATSAPP || '521000000000',
		whatsappMessage:
			'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nCupón: LANZAMIENTO-899',
		socialProofText: 'Acompañamiento personalizado para eventos especiales',
		highlights: [
			{ label: 'RSVP', icon: 'CheckSealIcon' },
			{ label: 'Pases digitales', icon: 'EnvelopedIcon' },
			{ label: 'Control de invitados', icon: 'UserGroupIcon' },
			{ label: 'Envío por WhatsApp', icon: 'WhatsApp' },
		],
	},
	productProof: {
		title: 'Una invitación elegante con control de invitados',
		description:
			'Celebra-me reúne invitación digital, confirmaciones, pases y seguimiento de invitados en una experiencia clara para compartir por WhatsApp.',
		cta: {
			label: 'Quiero una invitación con RSVP',
			href: '#contacto',
			message:
				'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nCupón: LANZAMIENTO-899',
		},
	},
	services: {
		eyebrow: 'INCLUIDO EN CADA EXPERIENCIA',
		title: 'Todo claro para sus invitados, todo bajo control para usted',
		subtitle:
			'Confirmaciones, pases, ubicación y detalles reunidos en una experiencia elegante para compartir por WhatsApp.',
		dossierSubtext: 'Resueltos desde un solo enlace.',
		closingStatement: 'Menos dudas · Menos mensajes · Más control',
		items: [
			{
				title: 'Confirmaciones',
				description: 'RSVP sin perseguir mensajes.',
			},
			{
				title: 'Accesos digitales',
				description: 'Pases claros para invitados y acompañantes.',
			},
			{
				title: 'Información del evento',
				description: 'Ubicación, horario, itinerario y detalles.',
			},
			{
				title: 'Visibilidad para usted',
				description: 'Respuestas y acompañantes organizados.',
			},
		],
		cta: {
			label: 'Cotizar invitación con control de invitados',
			href: '#contacto',
		},
	},
	about: {
		title: 'Diseño con intención',
		description:
			'Diseñamos una experiencia visual coherente con el tono de su celebración: elegante, clara y lista para compartir. No solo se ve bien; guía a sus invitados desde el primer mensaje.',
		values: [
			{
				name: 'Dirección visual',
				description:
					'Paleta, tipografía y ritmo pensados para que la invitación se sienta propia.',
			},
			{
				name: 'Claridad para invitados',
				description:
					'Cada sección orienta sin saturar: ceremonia, recepción, ubicación y confirmación.',
			},
			{
				name: 'Entrega cuidada',
				description:
					'Acompañamiento personal para revisar contenido, estilo y publicación.',
			},
		],
		cta: {
			label: 'Solicitar asesoría',
			href: '#contacto',
		},
	},
	testimonials: {
		title: 'Anfitriones que ganaron claridad',
		subtitle:
			'Experiencias reales de anfitriones que compartieron por WhatsApp, confirmaron asistencia y ordenaron mejor su evento.',
		testimonials: [
			{
				name: 'Boda',
				text: 'Pudimos enviar la invitación por WhatsApp y tener las confirmaciones más claras desde el primer día.',
				role: 'Ceremonia nupcial',
			},
			{
				name: 'Cliente de XV años',
				text: 'La invitación se sintió premium y nos ayudó a explicar horarios, ubicación y pases sin repetir mensajes.',
				role: 'Celebración de XV años',
			},
			{
				name: 'Baby shower',
				text: 'El enlace reunió toda la información y fue fácil de compartir con familia e invitados.',
				role: 'Celebración familiar',
			},
		],
	},
	pricing: {
		eyebrow: 'Inversión para su celebración',
		title: 'Paquetes claros',
		intro: 'Tres niveles con promoción de lanzamiento, pensados para elegir rápido y sin letra pequeña.',
		note: 'Promo base: $899 MXN. Precio regular base: $1,299 MXN.',
		tiers: [
			{
				id: 'coleccion',
				title: 'Colección',
				description: 'Diseño premium listo para personalizar.',
				badge: 'Beneficio de Lanzamiento',
				price: { amount: '899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $1,299 MXN',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Personalización de diseño seleccionado',
							'RSVP y control de acompañantes',
							'Galería, música, ubicación e itinerario',
							'Pases digitales por WhatsApp',
						],
					},
				],
				footnote: '*Tiempo estimado una vez recibido el contenido completo del evento.',
				cta: 'Elegir este paquete',
				ctaMessage:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium para el paquete Colección.\n\nCupón: LANZAMIENTO-899',
				href: '#',
			},
			{
				id: 'premium',
				title: 'Premium',
				description: 'Dirección visual para un evento con estilo propio.',
				badge: 'El Favorito',
				isPrimary: true,
				price: { amount: '1,499', currency: 'MXN', period: 'pago único' },
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Colección',
							'Adaptación editorial de fotografía y paleta',
							'Mayor curaduría visual',
							'Revisión prioritaria de contenido',
						],
					},
				],
				cta: 'Elegir este paquete',
				ctaMessage:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium para el paquete Premium.\n\nCupón: LANZAMIENTO-1499',
				href: '#',
			},
			{
				id: 'exclusivo',
				title: 'Exclusivo',
				description: 'Experiencia completa con mayor personalización.',
				isExclusive: true,
				price: { amount: '2,299', currency: 'MXN', period: 'pago único' },
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Premium',
							'Estructura extendida de secciones',
							'Personalización visual avanzada',
							'Acompañamiento prioritario',
						],
					},
				],
				cta: 'Elegir este paquete',
				ctaMessage:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium para el paquete Exclusivo.\n\nCupón: LANZAMIENTO-2299',
				href: '#',
			},
		],
	},
	faq: {
		title: 'Preguntas frecuentes',
		faqs: [
			{
				question: '¿Qué incluye la invitación digital premium?',
				answer: 'Diseño personalizado, RSVP, pases digitales por WhatsApp, mapa, música, itinerario y mesa de regalos.',
			},
			{
				question: '¿Cómo funciona el RSVP?',
				answer: 'Ingresan al enlace, seleccionan sus nombres y confirman asistencia y acompañantes al instante.',
			},
			{
				question: '¿Puedo controlar acompañantes?',
				answer: 'Sí, puede asignar un número exacto de pases para cada familia o invitado principal.',
			},
			{
				question: '¿Cuánto tarda la entrega?',
				answer: 'De 24 a 72 horas hábiles una vez que nos comparte los datos de su evento.',
			},
			{
				question: '¿Cómo se comparte por WhatsApp?',
				answer: 'Le entregamos un enlace y pases listos para compartir fácilmente por WhatsApp.',
			},
			{
				question: '¿Cómo empiezo el diseño?',
				answer: 'Elija su paquete, realice el pago y le guiaremos para recopilar su información.',
			},
		],
	},
	howItWorks: {
		title: 'Cómo funciona',
		subtitle:
			'Un proceso simple para convertir la información de su evento en una invitación lista para compartir.',
		steps: [
			{
				icon: 'SparklesIcon',
				title: 'Definimos la información clave',
				description: 'Fecha, lugar, fotos, música, itinerario y lista de invitados.',
			},
			{
				icon: 'HeartIcon',
				title: 'Diseñamos una experiencia personalizada',
				description: 'Armamos una experiencia clara, elegante y lista para revisar.',
			},
			{
				icon: 'CheckIcon',
				title: 'Comparte por WhatsApp y recibe confirmaciones',
				description:
					'Sus invitados confirman asistencia y reciben la información importante.',
			},
		],
	},
	contact: {
		title: 'Cotice su invitación',
		subtitle: 'Comparta los datos básicos y le orientamos por WhatsApp.',
	},
};
