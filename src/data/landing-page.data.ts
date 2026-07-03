import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Invitaciones digitales premium con RSVP y control de invitados',
		subtitle:
			'Experiencia personalizada para tu evento: confirmaciones en tiempo real, pases digitales y envío por WhatsApp.',
		primaryCtaLabel: 'Cotizar por WhatsApp',
		secondaryCtaLabel: 'Ver demos reales',
		secondaryCtaUrl: '#tipo-evento',
		whatsappPhone: import.meta.env.CONTACT_WHATSAPP || '521000000000',
		whatsappMessage:
			'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nCupón: LANZAMIENTO-899',
		socialProofText: 'Acompañamiento personalizado para eventos especiales',
		highlights: [
			{ label: 'RSVP integrado', icon: 'CheckSealIcon' },
			{ label: 'Pases digitales', icon: 'EnvelopedIcon' },
			{ label: 'Control de invitados', icon: 'UserGroupIcon' },
			{ label: 'Envío por WhatsApp', icon: 'WhatsApp' },
		],
	},
	productProof: {
		title: 'Más que una invitación bonita',
		description:
			'Una experiencia digital que informa, confirma asistencia y ayuda a organizar invitados.',
		items: [
			{
				title: 'Primera impresión premium',
				description:
					'Presentación elegante que impresiona a sus invitados desde el primer instante.',
				icon: 'SparklesIcon',
			},
			{
				title: 'Información clara',
				description:
					'Horarios, ubicación, itinerario y mesa de regalos en un solo enlace.',
				icon: 'MapLocationIcon',
			},
			{
				title: 'Control real',
				description:
					'Confirme asistencia, límite de pases y acompañantes sin hojas de cálculo.',
				icon: 'CheckIcon',
			},
		],
		cta: {
			label: 'Hablar sobre mi evento',
			href: '#contacto',
			message:
				'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\n\nCupón: LANZAMIENTO-899',
		},
	},
	services: {
		title: 'Incluido en tu invitación',
		subtitle:
			'Lo esencial para compartir, confirmar y organizar sin fricción.',
		items: [
			{
				title: 'RSVP integrado',
				description:
					'Confirmación inmediata y control de pases desde cualquier dispositivo.',
				icon: 'CheckSealIcon',
			},
			{
				title: 'Pases por WhatsApp',
				description:
					'Envíe pases digitales personalizados directamente por WhatsApp.',
				icon: 'EnvelopedIcon',
			},
			{
				title: 'Detalles del evento',
				description:
					'Ubicación de Google Maps, itinerario interactivo y mesa de regalos.',
				icon: 'MapLocationIcon',
			},
			{
				title: 'Lista ordenada',
				description:
					'Descargue la lista de asistencia en tiempo real con un clic.',
				icon: 'UserGroupIcon',
			},
		],
		cta: {
			label: 'Resolver dudas por WhatsApp',
			href: '#contacto',
		},
	},
	about: {
		title: 'Diseño con intención',
		description:
			'Diseños sofisticados y soporte personalizado para que su evento sea impecable.',
		values: [
			{
				name: 'Vanguardia Digital',
				description: 'Interacciones fluidas diseñadas para facilitar la confirmación.',
				icon: 'DiamondIcon',
			},
			{
				name: 'Detalle Impecable',
				description: 'Estética premium, tipografía curada y maquetación editorial.',
				icon: 'SparklesIcon',
			},
			{
				name: 'Cercanía y Calidez',
				description: 'Acompañamiento personal en el proceso de diseño y publicación.',
				icon: 'UserGroupIcon',
			},
		],
		cta: {
			label: 'Hablar sobre mi evento',
			href: '#contacto',
		},
	},
	testimonials: {
		title: 'Clientes que organizaron mejor',
		subtitle: 'Experiencias reales de anfitriones que simplificaron su organización.',
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
		eyebrow: 'Inversión para tu celebración',
		title: 'Paquetes claros',
		intro: 'Ahorre hoy con la promoción de lanzamiento. Precios transparentes y sin sorpresas.',
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
				cta: 'Quiero este paquete',
				ctaMessage:
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium para el paquete Colección.\n\nCupón: LANZAMIENTO-899',
				href: '#',
			},
			{
				id: 'premium',
				title: 'Premium',
				description:
					'Dirección visual para un evento con estilo propio.',
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
				cta: 'Quiero este paquete',
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
				cta: 'Quiero este paquete',
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
		subtitle: 'Tres pasos para publicar y compartir con control.',
		steps: [
			{
				icon: 'SparklesIcon',
				title: 'Cuéntanos tu evento',
				description: 'Comparta fecha, lugar, fotos, música y lista de invitados.',
			},
			{
				icon: 'HeartIcon',
				title: 'Diseñamos tu invitación',
				description: 'Armamos una experiencia clara, elegante y lista para revisar.',
			},
			{
				icon: 'CheckIcon',
				title: 'Comparte y controla',
				description: 'Envíe por WhatsApp y consulte confirmaciones, pases y acompañantes.',
			},
		],
	},
	contact: {
		title: 'Cotice su invitación',
		subtitle: 'Comparta los datos básicos y le orientamos por WhatsApp.',
	},
};
