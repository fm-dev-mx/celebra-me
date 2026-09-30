import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';
import {
	formatMxn,
	getExpressDelivery,
	getPromoPackage,
	getStartingPrice,
} from '@/data/promo-campaign.data';

const expressDelivery = getExpressDelivery();
const expressDeliveryPackages = expressDelivery.appliesTo
	.map((packageId) => getPromoPackage(packageId).name)
	.join(' y ');
const expressDeliveryPrice = `+${formatMxn(expressDelivery.price)} MXN`;

export const landingData: LandingPageData = {
	seo: {
		title: 'Celebra-me | Invitaciones Digitales Premium',
		description: `Invitaciones digitales con pase y confirmación para cada invitado. Diseño único, panel de invitados y envío por WhatsApp. Desde ${formatMxn(getStartingPrice())} MXN, sin anticipo.`,
	},
	hero: {
		eyebrow: 'INVITACIONES DIGITALES',
		title: 'Con pases y confirmación, personalizada para cada invitado',
		subtitle: 'Agregue a sus invitados, asigne pases y lleve el control de confirmaciones.',
		primaryCtaLabel: 'Cotizar mi invitación',
		secondaryCtaLabel: 'Ver demos de invitaciones',
		secondaryCtaUrl: '#tipo-evento',
		proofLine: 'RSVP · Pases digitales · Galería',
	},
	eventSelector: {
		eyebrow: 'DEMOS POR EVENTO',
		title: 'Vea cómo puede lucir su invitación',
		description:
			'Explore demos para boda, XV años, cumpleaños y otros eventos. El diseño se adapta al estilo de su celebración.',
	},
	productProof: {
		eyebrow: 'NO ES UN PDF, TAMPOCO ES UN ENLACE IGUAL PARA TODOS',
		title: 'La invitación también organiza su evento',
		description:
			'Puede agregar invitados, asignar pases y enviar una invitación personal para cada persona o familia.',
		items: [
			{
				title: 'Lista de invitados',
				description: 'Organice personas, familias o grupos desde un solo lugar.',
			},
			{
				title: 'Pases claros',
				description: 'Defina cuántos accesos tiene cada invitado.',
			},
			{
				title: 'Invitación personal',
				description: 'Cada invitado recibe su invitación con su nombre o el de su familia.',
			},
			{
				title: 'Confirmaciones ordenadas',
				description: 'Vea quién confirmó sin perderse entre mensajes.',
			},
		],
		cta: {
			label: 'Iniciar mi invitación',
		},
	},
	services: {
		eyebrow: 'LO QUE PUEDE INCLUIR',
		title: 'Todo claro para sus invitados, todo bajo control para usted',
		subtitle: 'Cada detalle del evento, presentado de forma clara.',
		dossierSubtext: 'Activamos solo lo que su evento necesita.',
		dossierTag: 'SECCIONES A MEDIDA',
		closingStatement: 'Menos mensajes sueltos. Más claridad para usted y sus invitados.',
		items: [
			{
				title: 'Confirmación RSVP',
				description: 'Cada invitado puede confirmar asistencia desde su invitación.',
			},
			{
				title: 'Pases digitales',
				description: 'Defina cuántos lugares tiene cada invitado o familia.',
			},
			{
				title: 'Ubicación y mesa de regalos',
				description: 'Incluye dirección con Maps, mesa de regalos y código de vestimenta.',
			},
			{
				title: 'Itinerario, música y galería',
				description:
					'Muestre horarios, agregue su canción favorita e incluya su sesión de fotos.',
			},
		],
		cta: {
			label: 'Quiero cotizar por WhatsApp',
		},
	},
	guestExperience: {
		eyebrow: 'PARA SUS INVITADOS',
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
		faqs: [
			{
				question: '¿La invitación se envía por WhatsApp?',
				answer: 'Sí. Desde su panel puede enviar las invitaciones a sus invitados. Cada persona recibe su propia invitación, no un enlace genérico para todos.',
			},
			{
				question: '¿Cada invitado recibe una invitación diferente?',
				answer: 'Sí. Cada invitado puede recibir una invitación personal con su nombre, sus pases y su opción para confirmar asistencia.',
			},
			{
				question: '¿Qué es el panel de invitados?',
				answer: 'Es el espacio donde puede organizar su lista, asignar pases, enviar invitaciones y revisar confirmaciones.',
			},
			{
				question: '¿Es una plantilla, PDF o imagen?',
				answer: 'No. Es una invitación digital interactiva. Todos los paquetes incluyen la capacidad de organizar invitados, pases digitales y confirmaciones en tiempo real; los paquetes superiores elevan el diseño y la dirección visual.',
			},
			{
				question: '¿Puedo asignar pases por familia?',
				answer: 'Sí. Puede asignar pases por persona, pareja, familia o grupo.',
			},
			{
				question: '¿Cómo veo quién confirmó?',
				answer: 'Las respuestas quedan ordenadas para que pueda revisar quién confirmó y quién sigue pendiente.',
			},
		],
		helpSection: {
			title: '¿Prefiere resolverlo directamente?',
			description:
				'Le ayudamos por WhatsApp a elegir el nivel adecuado según su evento, cantidad de invitados y estilo.',
			cta: 'Hablar con un asesor',
		},
	},
	howItWorks: {
		eyebrow: 'PROCESO SIMPLE',
		title: 'Nosotros la diseñamos. Usted la envía desde su panel.',
		subtitle:
			'Le entregamos una invitación lista para usar, con una forma clara de organizar invitados, pases y confirmaciones.',
		deliveryDossier: {
			title: 'Entrega preparada',
			subtitle: 'Lo que recibe al final del proceso',
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
				title: 'Nos comparte los datos',
				description: 'Fecha, lugar, nombres, fotos y detalles del evento.',
			},
			{
				title: 'Diseñamos su invitación',
				description: 'Adaptamos el estilo y las secciones según su celebración.',
			},
			{
				title: 'Agrega a sus invitados',
				description: 'Puede organizar personas, familias o grupos.',
			},
			{
				title: 'Envía y revisa confirmaciones',
				description:
					'Cada invitado recibe su propia invitación y usted ve quién ya respondió.',
			},
		],
		cta: {
			label: 'Quiero iniciar mi invitación',
		},
	},
	contact: {
		eyebrow: 'COTICE SU INVITACIÓN',
		title: 'Cuéntenos qué evento está preparando',
		subtitle:
			'Le ayudamos a elegir el paquete adecuado según el nivel de personalización, diseño y acompañamiento que necesita su evento.',
		cta: {
			label: 'Cotizar por WhatsApp',
		},
		microcopy:
			'Le asesoramos para elegir la estructura y el nivel de diseño ideal para su celebración.',
		formIntro: 'O déjenos sus datos y le contactamos.',
		channelPrimary: {
			value: 'Cotizar por WhatsApp',
		},
		channelSecondary: {
			value: 'Escribir por correo',
		},
	},
};
