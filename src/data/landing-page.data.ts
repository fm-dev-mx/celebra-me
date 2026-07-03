import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Invitaciones digitales premium con RSVP y control de invitados',
		subtitle:
			'Diseñamos una experiencia personalizada para tu evento, con confirmaciones, pases digitales, ubicación, música, galería y envío por WhatsApp.',
		backgroundImage: {
			desktopUrl:
				'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2069',
			mobileUrl:
				'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800&h=1200',
		},
		backgroundImages: [
			{
				desktopUrl:
					'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2069',
				mobileUrl:
					'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800&h=1200',
				alt: 'Recepción elegante con iluminación cálida para invitaciones digitales premium',
			},
			{
				desktopUrl:
					'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&q=80&w=1800',
				alt: 'Celebración nupcial elegante con flores y mesa preparada',
			},
			{
				desktopUrl:
					'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1800',
				alt: 'Evento social con vestido formal y ambiente editorial',
			},
			{
				desktopUrl:
					'https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?auto=format&fit=crop&q=80&w=1800',
				alt: 'Mesa de celebración familiar con detalles delicados',
			},
		],
		primaryCtaLabel: 'Cotizar por WhatsApp',
		primaryCtaUrl: '#contacto',
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
					'Una portada cuidada presenta su celebración con elegancia desde el primer enlace.',
				icon: 'SparklesIcon',
			},
			{
				title: 'Información clara',
				description:
					'Ubicación, horarios, galería, música y detalles importantes quedan en un solo lugar.',
				icon: 'MapLocationIcon',
			},
			{
				title: 'Control real',
				description:
					'RSVP, acompañantes y pases digitales ayudan a organizar antes del evento.',
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
					'Sus invitados confirman asistencia desde el enlace.',
				icon: 'CheckSealIcon',
			},
			{
				title: 'Pases por WhatsApp',
				description:
					'Comparta enlaces o pases personalizados en segundos.',
				icon: 'EnvelopedIcon',
			},
			{
				title: 'Detalles del evento',
				description:
					'Fotos, música, horarios, ubicación y notas importantes.',
				icon: 'MapLocationIcon',
			},
			{
				title: 'Lista ordenada',
				description:
					'Vea respuestas y acompañantes antes de celebrar.',
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
			'Cada invitación combina dirección visual, estructura clara y acompañamiento cercano.',
		values: [
			{
				name: 'Vanguardia Digital',
				description: 'Interacciones útiles, no adornos innecesarios.',
				icon: 'DiamondIcon',
			},
			{
				name: 'Detalle Impecable',
				description: 'Tipografía, ritmo visual y lectura cuidada.',
				icon: 'SparklesIcon',
			},
			{
				name: 'Cercanía y Calidez',
				description: 'Le guiamos desde contenido hasta envío.',
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
		subtitle: 'Opiniones anónimas basadas en eventos reales y patrones aprobados.',
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
		intro: 'La promo de lanzamiento aplica al paquete base. Los niveles superiores agregan diseño y operación.',
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
					'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium de $899 MXN para el paquete Colección.\n\nCupón: LANZAMIENTO-899',
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
					'Hola, quiero cotizar el paquete Premium para mi invitación digital.\n\nCupón: LANZAMIENTO-899',
				href: '#',
			},
			{
				id: 'exclusivo',
				title: 'Exclusivo',
				description: 'Experiencia completa con mayor personalización.',
				isExclusive: true,
				price: { amount: '2,199', currency: 'MXN', period: 'pago único' },
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
				cta: 'Cotizar por WhatsApp',
				ctaMessage:
					'Hola, quiero cotizar el paquete Exclusivo para mi invitación digital.\n\nCupón: LANZAMIENTO-899',
				href: '#',
			},
		],
	},
	faq: {
		title: 'Preguntas frecuentes',
		faqs: [
			{
				question: '¿Qué incluye la invitación digital premium?',
				answer: 'Incluye diseño, galería, música, ubicación, itinerario, RSVP, pases digitales y enlace para compartir.',
			},
			{
				question: '¿Cómo funciona el RSVP?',
				answer: 'Sus invitados confirman desde la invitación. Usted consulta las respuestas antes del evento.',
			},
			{
				question: '¿Puedo controlar acompañantes?',
				answer: 'Sí. Puede definir acompañantes por invitación y evitar confirmaciones fuera de control.',
			},
			{
				question: '¿Cuánto tarda la entrega?',
				answer: 'La entrega estimada es de 24 a 72 horas hábiles tras recibir la información completa.',
			},
			{
				question: '¿Cómo se comparte por WhatsApp?',
				answer: 'Recibe un enlace listo para enviar. También puede usar pases personalizados por invitado.',
			},
			{
				question: '¿Qué necesito para comenzar?',
				answer: 'Nombre del evento, fecha, ubicación, fotos, música y lista de invitados si desea pases personalizados.',
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
