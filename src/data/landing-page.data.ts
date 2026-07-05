import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		eyebrow: 'INVITACIONES DIGITALES',
		title: 'Con pases y confirmación, personalizada para cada invitado',
		subtitle: 'Agrega tus invitados, asigna pases y lleva el control de confirmaciones.',
		primaryCtaLabel: 'Cotizar mi invitación',
		secondaryCtaLabel: 'Ver demos',
		secondaryCtaUrl: '#tipo-evento',
		whatsappPhone: import.meta.env.CONTACT_WHATSAPP || '521000000000',
		whatsappMessage:
			'Hola, quiero cotizar una invitación digital personalizada con panel de invitados.',
		proofLine: 'Lista de invitados · Pases · Confirmaciones',
	},
	eventSelector: {
		eyebrow: 'DEMOS POR EVENTO',
		title: 'Revisa cómo puede verse tu invitación',
		description:
			'Explora demos para boda, XV años, cumpleaños y otros eventos. El diseño se adapta al estilo de tu celebración.',
		cta: 'Ver demo',
	},
	productProof: {
		eyebrow: 'NO ES UN PDF, TAMPOCO ES UN ENLACE IGUAL PARA TODOS',
		title: 'La invitación también organiza tu evento',
		description:
			'Puedes agregar invitados, asignar pases y enviar una invitación personal para cada persona o familia.',
		items: [
			{
				title: 'Lista de invitados',
				description: 'Organiza personas, familias o grupos desde un solo lugar.',
			},
			{
				title: 'Pases claros',
				description: 'Define cuántos accesos tiene cada invitado.',
			},
			{
				title: 'Invitación personal',
				description:
					'Cada invitado recibe su una invitación con su nombre o el de su familia.',
			},
			{
				title: 'Confirmaciones ordenadas',
				description: 'Revisa quién confirmó sin perderte entre mensajes.',
			},
		],
		cta: {
			label: 'Quiero una invitación con control',
			message:
				'Hola, quiero una invitación digital con panel de invitados para organizar invitados, pases y confirmaciones.',
		},
	},
	services: {
		eyebrow: 'LO QUE PUEDE INCLUIR',
		title: 'Todo lo necesario para guiar a tus invitados',
		subtitle: 'Presenta cada detalle de forma clara.',
		dossierSubtext: 'Activamos solo lo que tu evento necesita.',
		dossierTag: 'SECCIONES A MEDIDA',
		closingStatement: '',
		items: [
			{
				title: 'Confirmación RSVP',
				description: 'Cada invitado puede confirmar asistencia desde su invitación.',
			},
			{
				title: 'Pases digitales',
				description: 'Define cuántos lugares tiene cada invitado o familia.',
			},
			{
				title: 'Ubicación',
				description: 'Incluye dirección y acceso directo a Google Maps o Waze.',
			},
			{
				title: 'Itinerario',
				description: 'Muestra horarios y momentos importantes.',
			},
			{
				title: 'Música',
				description: 'Agrega tu canción favorita.',
			},
			{
				title: 'Galería',
				description: 'Incluye tu sesión de fotos, recuerdos o momentos especiales.',
			},
			{
				title: 'Mesa de regalos',
				description: 'Incluye enlaces o datos de regalo de forma discreta.',
			},
			{
				title: 'Código de vestimenta',
				description: 'Indica el estilo sugerido de forma clara.',
			},
		],
		cta: {
			label: 'Quiero cotizar por WhatsApp',
			href: '#contacto',
		},
	},
	guestExperience: {
		eyebrow: 'PARA TUS INVITADOS',
		title: 'Una invitación clara desde el primer mensaje',
		description:
			'Al abrirla, cada invitado puede ver sus pases, consultar los detalles del evento y confirmar asistencia.',
		values: [
			{
				name: 'Su nombre',
				description: 'Cada invitación muestra el nombre del invitado o familia.',
			},
			{
				name: 'Sus pases',
				description: 'El invitado sabe cuántos lugares tiene asignados.',
			},
			{
				name: 'Detalles del evento',
				description:
					'Fecha, ubicación, itinerario, música, galería o información especial.',
			},
			{
				name: 'Confirmación fácil',
				description: 'Responden desde la misma invitación.',
			},
		],
		closingLine: '',
		cta: {
			label: 'Solicitar invitaciones personalizadas',
			message: 'Hola, quiero solicitar invitaciones personalizadas para mi evento.',
		},
	},
	testimonials: {
		eyebrow: 'RESULTADOS REALES',
		title: 'Más claridad antes del evento',
		subtitle:
			'Nuestros clientes no solo buscan una invitación bonita. También valoran saber quién confirmó, cuántos pases tiene cada invitado y qué información recibió cada persona.',
		testimonials: [
			{
				name: 'Mariana G.',
				text: 'Nos ayudó mucho tener los pases claros por familia. La invitación se veía formal y las confirmaciones quedaron más ordenadas.',
				role: 'Boda',
				guests: '72 invitados',
			},
			{
				name: 'Laura M.',
				text: 'Cada invitado recibió su invitación y ya no tuvimos que explicar ubicación, horarios y accesos por separado.',
				role: 'XV años',
			},
			{
				name: 'Fernanda C.',
				text: 'Fue mucho más fácil enviar todo y saber quién ya había confirmado.',
				role: 'Cumpleaños',
			},
			{
				name: 'Andrea R.',
				text: 'Nos ayudó a ordenar la lista sin estar preguntando uno por uno.',
				role: 'Bautizo',
			},
		],
		proofLine: '',
	},
	pricing: {
		eyebrow: 'PAQUETES',
		title: 'Elige la invitación que necesita tu evento',
		intro: 'Todos los paquetes incluyen una invitación digital personalizada. Los planes superiores agregan más control de invitados, pases y personalización.',
		note: 'Pago único. Precios en MXN.',
		decisionGuide: {
			title: '¿No sabes cuál elegir?',
			rows: [
				'Te recomendamos el paquete ideal por WhatsApp según tu evento, invitados y estilo.',
			],
			cta: 'Recibir recomendación personalizada',
			message: 'Hola, quiero que me ayuden a elegir el mejor paquete para mi evento.',
		},
		tiers: [
			{
				id: 'essential',
				title: 'Essential',
				description: 'Para una invitación digital clara y elegante.',
				price: { amount: '899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $1,299 MXN',
				idealFor: 'Para una invitación digital clara y elegante.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Diseño personalizado',
							'Información del evento',
							'Ubicación',
							'Botón de confirmación',
							'Entrega lista para usar',
						],
					},
				],
		cta: 'Elegir Essential',
				ctaMessage:
					'Hola, quiero elegir el paquete Essential de $899 MXN para mi invitación digital.',
			},
			{
				id: 'signature',
				title: 'Signature',
				description: 'Para organizar invitados, pases y confirmaciones.',
				badge: 'MÁS RECOMENDADO',
				isPrimary: true,
				price: { amount: '1,699', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $2,299 MXN',
				idealFor:
					'Ideal para eventos que necesitan control de invitados, pases y confirmaciones.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Essential',
							'Panel de invitados',
							'Invitaciones personales',
							'Pases por invitado',
							'Confirmaciones ordenadas',
						],
					},
				],
		cta: 'Elegir Signature',
				ctaMessage:
					'Hola, quiero elegir el paquete Signature de $1,699 MXN con panel de invitados.',
			},
			{
				id: 'atelier',
				title: 'Atelier',
				description: 'Para una experiencia más cuidada y personalizada.',
				isExclusive: true,
				price: { amount: '2,899', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular: $3,899 MXN',
				idealFor: 'Para eventos que requieren mayor detalle editorial y acompañamiento.',
				sections: [
					{
						title: 'Incluye',
						items: [
							'Todo lo de Signature',
							'Dirección visual avanzada',
							'Más secciones personalizadas',
							'Mayor detalle editorial',
							'Acompañamiento prioritario',
						],
					},
				],
		cta: 'Elegir Atelier',
				ctaMessage:
					'Hola, quiero elegir el paquete Atelier de $2,899 MXN con dirección visual avanzada.',
			},
		],
	},
	faq: {
		pretitle: 'Claridad antes de cotizar',
		title: 'Preguntas frecuentes',
		subtitle:
			'Las dudas más importantes sobre entrega, invitaciones personalizadas, pases y confirmaciones.',
		divider: 'Dudas antes de cotizar',
		faqs: [
			{
				question: '¿La invitación se envía por WhatsApp?',
				answer: 'Sí. Desde tu panel puedes enviar las invitaciones a tus invitados. Cada persona recibe su propia invitación, no un enlace genérico para todos.',
			},
			{
				question: '¿Cada invitado recibe una invitación diferente?',
				answer: 'Sí. Cada invitado puede recibir una invitación personal con su nombre, sus pases y su opción para confirmar asistencia.',
			},
			{
				question: '¿Qué es el panel de invitados?',
				answer: 'Es el espacio donde puedes organizar tu lista, asignar pases, enviar invitaciones y revisar confirmaciones.',
			},
			{
				question: '¿Es una plantilla, PDF o imagen?',
				answer: 'No. Es una invitación digital personalizada. Según el paquete, también puede incluir panel de invitados, pases y confirmaciones.',
			},
			{
				question: '¿Puedo asignar pases por familia?',
				answer: 'Sí. Puedes asignar pases por persona, pareja, familia o grupo.',
			},
			{
				question: '¿Cómo veo quién confirmó?',
				answer: 'Las respuestas quedan ordenadas para que puedas revisar quién confirmó y quién sigue pendiente.',
			},
		],
		helpSection: {
			title: '¿Prefieres resolverlo directamente?',
			description:
				'Te ayudamos por WhatsApp a elegir el nivel adecuado según tu evento, cantidad de invitados y estilo.',
			cta: 'Hablar con un asesor',
			message: 'Hola, quiero asesoría para elegir el paquete ideal de invitación digital.',
		},
	},
	howItWorks: {
		eyebrow: 'PROCESO SIMPLE',
		title: 'Nosotros la diseñamos. Tú la envías desde tu panel.',
		subtitle:
			'Te entregamos una invitación lista para usar, con una forma clara de organizar invitados, pases y confirmaciones.',
		deliveryDossier: {
			title: 'Entrega preparada',
			subtitle: 'Lo que recibes al final del proceso',
			rows: [
				{ label: 'Invitación personalizada', status: 'Lista' },
				{ label: 'Panel de invitados', status: 'Activo' },
				{ label: 'Invitaciones listas para enviar', status: 'Listas' },
				{ label: 'Revisión final', status: 'Incluida' },
			],
			footnote: 'Cada elemento revisado antes de la entrega.',
		},
		steps: [
			{
				title: 'Nos compartes los datos',
				description: 'Fecha, lugar, nombres, fotos y detalles del evento.',
			},
			{
				title: 'Diseñamos tu invitación',
				description: 'Adaptamos el estilo y las secciones según tu celebración.',
			},
			{
				title: 'Agregas tus invitados',
				description: 'Puedes organizar personas, familias o grupos.',
			},
			{
				title: 'Envías las invitaciones',
				description: 'Cada invitado recibe su propia invitación.',
			},
			{
				title: 'Revisas confirmaciones',
				description: 'Puedes ver quién ya respondió y quién sigue pendiente.',
			},
		],
		cta: {
			label: 'Quiero iniciar mi invitación',
			message: 'Hola, quiero empezar mi invitación digital con panel de invitados.',
		},
	},
	contact: {
		eyebrow: 'COTIZA TU INVITACIÓN',
		title: 'Cuéntanos qué evento estás preparando',
		subtitle:
			'Te ayudamos a elegir el paquete adecuado según tu tipo de evento, número de invitados y nivel de control que necesitas.',
		cta: {
			label: 'Cotizar por WhatsApp',
			message: 'Hola, quiero cotizar una invitación digital para mi evento.',
		},
		microcopy:
			'Te diremos si necesitas una invitación sencilla o una experiencia con invitados, pases y confirmaciones.',
		formIntro: 'O déjanos tus datos y te contactamos.',
		channelPrimary: {
			label: 'Principal',
			value: 'Cotizar por WhatsApp',
		},
		channelSecondary: {
			label: 'Secundario',
			value: 'Escribir por correo',
		},
	},
};
