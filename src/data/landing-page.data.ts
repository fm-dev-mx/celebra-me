import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Experiencias de invitación personalizadas para guiar a sus invitados',
		subtitle:
			'RSVP, pases digitales, ubicación, música y galería en una experiencia premium para compartir por WhatsApp.',
		primaryCtaLabel: 'Cotizar por WhatsApp',
		secondaryCtaLabel: 'Ver demos de invitaciones',
		secondaryCtaUrl: '#tipo-evento',
		whatsappPhone: import.meta.env.CONTACT_WHATSAPP || '521000000000',
		whatsappMessage:
			'Hola, quiero hacer válida la promo de lanzamiento de mi invitación digital premium.\\n\\nCupón: LANZAMIENTO-899',
	},
	productProof: {
		title: 'Una invitación elegante que también organiza a sus invitados.',
		description:
			'Confirmaciones, pases, ubicación, música y detalles del evento organizados en una invitación personalizada.',
		cta: {
			label: 'Cotizar mi invitación por WhatsApp',
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
		title: 'Elija con una recomendación clara',
		intro: 'Signature es nuestra sugerencia para la mayoría de eventos; Colección y Atelier ajustan el nivel de personalización.',
		note: 'Promoción de lanzamiento desde $899 MXN. Pago único.',
		decisionGuide: {
			title: '¿No sabe cuál elegir?',
			rows: [
				'Le recomendamos el paquete ideal por WhatsApp según evento, invitados y estilo.',
			],
			cta: 'Recibir recomendación personalizada',
			message: 'Hola, quiero que me ayuden a elegir el mejor paquete para mi evento.',
		},
		tiers: [
			{
				id: 'signature',
				title: 'Signature',
				description: 'La experiencia recomendada: personalizada, cuidada y lista para coordinar invitados.',
				badge: 'RECOMENDADO',
				isPrimary: true,
				price: { amount: '1,699', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $2,299 MXN',
				idealFor: 'Ideal para eventos que deben sentirse personalizados sin complicar el proceso.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Diseño personalizado con paleta y portada cuidada',
							'RSVP, acompañantes y pases digitales',
							'Ubicación, horario, música y galería',
							'Revisión prioritaria antes de publicar',
							'Acompañamiento durante la personalización',
						],
					},
				],
				cta: 'Elegir Signature',
				ctaMessage:
					'Hola, quiero elegir el paquete Signature de $1,699 MXN para mi invitación digital.',
			},
			{
				id: 'coleccion',
				title: 'Colección',
				description: 'Invitación premium lista para personalizar con lo esencial para compartir.',
				price: { amount: '899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $1,299 MXN',
				idealFor: 'Para una invitación elegante, clara y rápida de personalizar.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Diseño premium seleccionado',
							'Personalización de datos del evento',
							'RSVP y control de acompañantes',
							'Ubicación, música e itinerario',
							'Pases digitales por WhatsApp',
						],
					},
				],
				cta: 'Elegir Colección',
				ctaMessage:
					'Hola, quiero elegir el paquete Colección de $899 MXN para mi invitación digital.',
			},
			{
				id: 'atelier',
				title: 'Atelier',
				description: 'Dirección visual más profunda para eventos que necesitan una experiencia distintiva.',
				isExclusive: true,
				price: { amount: '2,899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $3,899 MXN',
				idealFor: 'Para una experiencia más dirigida, narrativa y visualmente distintiva.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Signature',
							'Dirección visual avanzada',
							'Estructura extendida de secciones',
							'Mayor personalización de narrativa visual',
							'Acompañamiento prioritario',
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
		title: 'Un proceso guiado hasta la entrega.',
		subtitle:
			'Le acompañamos como un concierge: definimos el estilo, ordenamos la información y dejamos todo listo para compartir.',
		deliveryDossier: {
			title: 'Entrega preparada',
			subtitle: 'Lo que recibe al final del proceso',
			rows: [
				{ label: 'Invitación personalizada', status: 'Lista' },
				{ label: 'RSVP y pases digitales', status: 'Activos' },
				{ label: 'Enlace para WhatsApp', status: 'Listo' },
				{ label: 'Revisión final', status: 'Incluida' },
			],
			footnote: 'Cada elemento revisado antes de la entrega.',
		},
		steps: [
			{
				title: 'Definimos el estilo',
				description: 'Aterrizamos tono, evento, paleta y referencias visuales principales.',
			},
			{
				title: 'Personalizamos la invitación',
				description: 'Organizamos textos, fotos, horarios, ubicación y detalles importantes.',
			},
			{
				title: 'Activamos RSVP y pases',
				description: 'Configuramos confirmaciones y pases digitales para sus invitados.',
			},
			{
				title: 'Le entregamos el enlace listo para compartir',
				description: 'Recibe la invitación revisada y preparada para enviar por WhatsApp.',
			},
		],
		cta: {
			label: 'Quiero iniciar mi invitación',
			message: 'Hola, quiero empezar mi invitación digital con panel de invitados.',
		},
	},
	contact: {
		title: 'Le ayudamos a elegir la invitación ideal',
		subtitle: 'Cuéntenos qué está organizando y le recomendamos la experiencia adecuada para su evento.',
	},
};
