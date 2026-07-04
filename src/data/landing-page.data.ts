import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Invitaciones digitales elegantes para confirmar y guiar a tus invitados',
		subtitle:
			'RSVP, pases digitales, ubicación, música y galería en una experiencia personalizada para compartir por WhatsApp.',
		primaryCtaLabel: 'Quiero cotizar por WhatsApp',
		secondaryCtaLabel: 'Ver demos de invitaciones',
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
			label: 'Recibir asesoría por WhatsApp',
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
			label: 'Quiero cotizar por WhatsApp',
			href: '#contacto',
		},
	},
	about: {
		eyebrow: 'DIRECCIÓN VISUAL INCLUIDA',
		title: 'No parece una plantilla. Se siente como su evento.',
		description:
			'No entregamos un PDF estático ni una plantilla genérica. Diseñamos una invitación web personalizada, elegante y clara, lista para compartir por WhatsApp.',
		values: [
			{
				name: 'Más que un archivo',
				description:
					'Una experiencia web con secciones claras, ubicación, RSVP y detalles importantes.',
			},
			{
				name: 'Personalización real',
				description:
					'Diseño, contenido y flujo alineados al tono de su celebración; cuando aplica, con nombre, pase o confirmación individual.',
			},
			{
				name: 'Lista para compartir',
				description:
					'Revisamos estructura, presentación y publicación antes de enviarla a sus invitados.',
			},
		],
		cta: {
			label: 'Recibir asesoría por WhatsApp',
			href: '#contacto',
		},
	},
	testimonials: {
		eyebrow: 'EXPERIENCIAS QUE SE SIENTEN CUIDADAS',
		title: 'La invitación también debe dar tranquilidad.',
		subtitle:
			'Cuando la información está clara, sus invitados confirman mejor, preguntan menos y viven una experiencia más cuidada desde el primer mensaje.',
		testimonials: [
			{
				name: 'Mariana G.',
				text: 'Por primera vez no tuvimos que reenviar ubicación, horario ni detalles por separado. Todo estaba claro desde la invitación.',
				role: 'Boda',
				guests: '72 invitados',
			},
			{
				name: 'Laura M.',
				text: 'Mis invitados confirmaron desde WhatsApp y pudimos saber con tiempo quién realmente asistiría.',
				role: 'XV años',
			},
			{
				name: 'Fernanda C.',
				text: 'Se veía elegante, pero lo mejor fue lo práctica que resultó antes del evento.',
				role: 'Boda civil',
			},
			{
				name: 'Andrea R.',
				text: 'Nos ayudó a ordenar la lista sin estar preguntando uno por uno.',
				role: 'Bautizo',
			},
		],
		proofLine: 'RSVP claro · Menos dudas · Información en un solo enlace',
	},
	pricing: {
		eyebrow: 'INVERSIÓN PARA SU CELEBRACIÓN',
		title: 'Elija el nivel de experiencia que quiere para su invitación',
		intro: 'Desde una invitación elegante lista para personalizar, hasta una experiencia visual diseñada con mayor dirección editorial para su evento.',
		note: 'Promoción de lanzamiento desde $899 MXN. Pago único.',
		decisionGuide: {
			title: 'Cómo elegir rápido',
			rows: [
				'Colección: quiero algo elegante, rápido y funcional.',
				'Signature: quiero que se vea más personalizado y cuidado.',
				'Atelier: quiero una experiencia más completa y con mayor dirección visual.',
			],
			cta: 'Ayúdeme a elegir',
			message: 'Hola, quiero que me ayuden a elegir el mejor paquete para mi evento.',
		},
		tiers: [
			{
				id: 'coleccion',
				title: 'Colección',
				description: 'Invitación premium lista para personalizar.',
				price: { amount: '899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $1,299 MXN',
				idealFor:
					'Ideal para eventos que necesitan una invitación elegante, clara y funcional sin una dirección visual compleja.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Diseño premium seleccionado',
							'Personalización de nombres, fecha, textos y datos del evento',
							'RSVP y control de acompañantes',
							'Ubicación, música, galería e itinerario',
							'Pases digitales por WhatsApp',
						],
					},
				],
				cta: 'Elegir Colección',
				ctaMessage:
					'Hola, quiero elegir el paquete Colección de $899 MXN para mi invitación digital.',
			},
			{
				id: 'signature',
				title: 'Signature',
				description: 'La opción más equilibrada para una invitación con estilo propio.',
				badge: 'MÁS ELEGIDO',
				isPrimary: true,
				price: { amount: '1,699', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $2,299 MXN',
				idealFor:
					'Ideal para celebraciones donde la invitación debe sentirse más alineada a la paleta, fotografía y tono del evento.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Colección',
							'Adaptación editorial de fotografías y paleta visual',
							'Mayor curaduría en portada, secciones e interludios',
							'Revisión prioritaria de contenido',
							'Mejor acompañamiento durante personalización',
						],
					},
				],
				cta: 'Elegir Signature',
				ctaMessage:
					'Hola, quiero elegir el paquete Signature de $1,699 MXN para mi invitación digital.',
			},
			{
				id: 'atelier',
				title: 'Atelier',
				description: 'Una experiencia digital con mayor dirección visual y acompañamiento.',
				isExclusive: true,
				price: { amount: '2,899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $3,899 MXN',
				idealFor:
					'Ideal para eventos donde la invitación debe sentirse como una extensión visual de la celebración.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Signature',
							'Dirección visual avanzada',
							'Estructura extendida de secciones',
							'Mayor personalización de narrativa visual',
							'Acompañamiento prioritario',
							'Revisión final más detallada antes de entrega',
						],
					},
				],
				cta: 'Elegir Atelier',
				ctaMessage:
					'Hola, quiero elegir el paquete Atelier de $2,899 MXN para mi invitación digital.',
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
		eyebrow: 'ASÍ EMPEZAMOS',
		title: 'Del primer mensaje a una invitación lista para enviar.',
		subtitle:
			'Nos comparte los datos del evento, preparamos la invitación y dejamos configurado el panel para que pueda compartirla con sus invitados.',
		deliveryDossier: {
			title: 'Entrega preparada',
			subtitle: 'Lo que recibe al final del proceso',
			rows: [
				{ label: 'Invitación personalizada', status: 'Lista' },
				{ label: 'Panel de invitados incluido', status: 'Configurado' },
				{ label: 'Enlace para WhatsApp', status: 'Listo' },
				{ label: 'Confirmaciones', status: 'Activas' },
			],
			footnote: 'Cada elemento revisado antes de la entrega.',
		},
		steps: [
			{
				title: 'Nos comparte los datos',
				description:
					'Reunimos fecha, ubicación, horarios, fotos y detalles importantes del evento.',
			},
			{
				title: 'Preparamos la experiencia',
				description:
					'Diseñamos la invitación, ordenamos la información y configuramos el panel de invitados.',
			},
			{
				title: 'Le entregamos todo listo',
				description:
					'Recibe su enlace para compartir y puede consultar respuestas desde el panel.',
			},
		],
		cta: {
			label: 'Quiero cotizar por WhatsApp',
			message: 'Hola, quiero empezar mi invitación digital con panel de invitados.',
		},
	},
	contact: {
		title: 'Cotice su invitación',
		subtitle: 'Comparta los datos básicos y le orientamos por WhatsApp.',
	},
};
