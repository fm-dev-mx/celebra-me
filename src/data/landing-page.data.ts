import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';
import { formatMxn, getExpressDelivery, getPromoPackage } from '@/data/promo-campaign.data';

const expressDelivery = getExpressDelivery();
const expressDeliveryPackages = expressDelivery.appliesTo
	.map((packageId) => getPromoPackage(packageId).name)
	.join(' y ');
const expressDeliveryPrice = `+${formatMxn(expressDelivery.price)} MXN`;

export const landingData: LandingPageData = {
	hero: {
		eyebrow: 'INVITACIONES DIGITALES',
		title: 'Con pases y confirmación, personalizada para cada invitado',
		subtitle: 'Agrega tus invitados, asigna pases y lleva el control de confirmaciones.',
		primaryCtaLabel: 'Cotizar mi invitación',
		secondaryCtaLabel: 'Ver demos de invitaciones',
		secondaryCtaUrl: '#tipo-evento',
		proofLine: 'RSVP · Pases digitales · Galería',
	},
	eventSelector: {
		eyebrow: 'DEMOS POR EVENTO',
		title: 'Revisa cómo puede verse tu invitación',
		description:
			'Explora demos para boda, XV años, cumpleaños y otros eventos. El diseño se adapta al estilo de tu celebración.',
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
			label: 'Iniciar mi invitación',
		},
	},
	services: {
		eyebrow: 'LO QUE PUEDE INCLUIR',
		title: 'Todo claro para sus invitados, todo bajo control para usted',
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
				title: 'Ubicación y mesa de regalos',
				description: 'Incluye dirección con Maps, mesa de regalos y código de vestimenta.',
			},
			{
				title: 'Itinerario, música y galería',
				description:
					'Muestra horarios, agrega tu canción favorita e incluye tu sesión de fotos.',
			},
		],
		cta: {
			label: 'Quiero cotizar por WhatsApp',
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
		eyebrow: 'INVERSIÓN PARA SU CELEBRACIÓN',
		title: 'Elija con una recomendación clara',
		intro: 'Todos los paquetes incluyen diseño único, pases, confirmación y panel de invitados, agregar al calendario y cambios y correcciones sin costo. Pago único.',
		extras: {
			title: 'Extras',
			items: [
				`${expressDelivery.name}: ${expressDeliveryPrice}, disponible para ${expressDeliveryPackages}.`,
			],
		},
		tiers: [
			{
				packageId: 'esencial',
				includes: [
					'Diseño único, pases, confirmación y panel de invitados',
					'Agregar al calendario',
					'Cambios y correcciones sin costo',
				],
				details: [
					{ label: 'Entrega', value: '3 a 5 días hábiles' },
					{ label: 'Carga de la lista de invitados', value: 'La realiza usted' },
					{ label: 'Firma de Celebra-me al pie', value: 'Discreta' },
					{ label: expressDelivery.name, value: expressDeliveryPrice },
				],
			},
			{
				packageId: 'signature',
				badge: 'RECOMENDADO',
				isPrimary: true,
				includesFrom: 'Todo lo de Esencial, más:',
				includes: ['QR de recuerdos'],
				details: [
					{ label: 'Entrega', value: '3 a 5 días hábiles' },
					{ label: 'Carga de la lista de invitados', value: 'La realiza usted' },
					{ label: 'Firma de Celebra-me al pie', value: 'Discreta' },
					{ label: expressDelivery.name, value: expressDeliveryPrice },
				],
			},
			{
				packageId: 'atelier',
				isExclusive: true,
				includesFrom: 'Todo lo de Signature, más:',
				includes: [
					'Entrega en 48 horas',
					'Celebra-me carga su lista de invitados',
					'Su invitación a su nombre, sin la firma de Celebra-me',
				],
				details: [
					{ label: 'Entrega', value: '48 horas' },
					{
						label: 'Carga de la lista de invitados',
						value: 'Celebra-me, con lista en Excel o legible',
					},
					{ label: 'Firma de Celebra-me al pie', value: 'Se retira' },
					{ label: expressDelivery.name, value: 'No aplica' },
				],
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
				answer: 'No. Es una invitación digital interactiva. Todos los paquetes incluyen la capacidad de organizar invitados, pases digitales y confirmaciones en tiempo real; los paquetes superiores elevan el diseño y la dirección visual.',
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
				title: 'Envías y revisas confirmaciones',
				description:
					'Cada invitado recibe su propia invitación y puedes ver quién ya respondió.',
			},
		],
		cta: {
			label: 'Quiero iniciar mi invitación',
		},
	},
	contact: {
		eyebrow: 'COTIZA TU INVITACIÓN',
		title: 'Cuéntanos qué evento estás preparando',
		subtitle:
			'Te ayudamos a elegir el paquete adecuado según el nivel de personalización, diseño y acompañamiento que necesita tu evento.',
		cta: {
			label: 'Cotizar por WhatsApp',
		},
		microcopy:
			'Te asesoraremos para elegir la estructura y el nivel de diseño ideal para tu celebración.',
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
