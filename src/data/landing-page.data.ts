import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';
import { formatMxn, getCatalogPackage, getExpressDelivery } from '@/data/promo-campaign.data';
import { CLIENT_TESTIMONIALS } from '@/data/testimonials.data';

export const PRIMARY_CTA_LABEL = 'Quiero mi invitación';
/** Small reassurance line shown under the primary WhatsApp CTA in the header and the hero. */
export const PRIMARY_CTA_TRUST_LINE = 'Respuesta en minutos · Sin compromiso';

const expressDelivery = getExpressDelivery();
const expressDeliveryPackages = expressDelivery.appliesTo
	.map((packageId) => getCatalogPackage(packageId).name)
	.join(' y ');
const expressDeliveryPrice = `+${formatMxn(expressDelivery.price)} MXN`;
const esencialName = getCatalogPackage('esencial').name;
const signatureName = getCatalogPackage('signature').name;
const atelierName = getCatalogPackage('atelier').name;

export const landingData: LandingPageData = {
	seo: {
		title: 'Celebra-me | Invitaciones Digitales Premium',
		// No price here: search engines keep this text long after a promo row ends.
		description:
			'Invitaciones digitales con pase y confirmación para cada invitado. Diseño único, panel de invitados y envío por WhatsApp, sin anticipo.',
		ogTitle: 'Celebra-me | Invitaciones Digitales Premium',
		ogDescription:
			'Invitaciones digitales con pase y confirmación para cada invitado. Diseño único, panel de invitados y envío por WhatsApp, sin anticipo.',
		ogImage: '/images/og/og-vitrina.jpg',
	},
	hero: {
		eyebrow: 'Invitaciones digitales',
		title: 'Invitaciones con pase y confirmación para cada invitado',
		titleEmphasis: 'confirmación',
		subtitle:
			'La diseñamos para su evento y usted la comparte desde su panel. Abajo puede recorrer cada estilo como lo verán sus invitados.',
		mobileSubtitle: 'La diseñamos para su evento; usted la comparte desde su panel.',
		priceLine: {
			prefix: 'Desde',
			suffix: 'MXN, pago único.',
		},
		paymentNote: 'Sin anticipo: pague al recibir su invitación terminada.',
		primaryCtaLabel: PRIMARY_CTA_LABEL,
		primaryCtaTrustLine: PRIMARY_CTA_TRUST_LINE,
		fanLabel: 'Toque una para verla abajo',
	},
	vitrina: {
		title: 'Así la verán sus invitados',
		description:
			'Es la invitación real: toque el sobre para abrirla y deslice para recorrerla. Cambie a Tablet o PC para verla en otra pantalla.',
	},
	productProof: {
		eyebrow: 'SU PANEL DE INVITADOS',
		title: 'La invitación también organiza su evento',
		description: 'Organice a sus invitados desde un solo panel, sin perseguir respuestas.',
		features: [
			{ title: 'Lista desde Excel', text: 'Importe a sus invitados en un paso.' },
			{
				title: 'Envío por WhatsApp',
				text: 'Mensaje editable y recordatorios a quien no ha confirmado.',
			},
			{
				title: 'Vistas y confirmaciones',
				text: 'Quién ya vio su invitación y quién confirmó.',
			},
			{ title: 'Exportación', text: 'Descargue su lista con las respuestas.' },
		],
	},
	testimonials: {
		title: 'Lo que dicen nuestros clientes',
		testimonials: CLIENT_TESTIMONIALS,
		notice: 'Testimonios reales de clientes. Omitimos sus nombres por privacidad.',
	},
	pricing: {
		title: 'Elija su paquete',
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
					{ label: expressDelivery.name, value: expressDeliveryPrice },
				],
			},
			{
				packageId: 'signature',
				badge: 'RECOMENDADO',
				isPrimary: true,
				includesFrom: `Todo lo de ${esencialName}, más:`,
				includes: ['QR para que sus invitados compartan fotos y videos del evento'],
				details: [
					{ label: 'Entrega', value: '3 a 5 días hábiles' },
					{ label: expressDelivery.name, value: expressDeliveryPrice },
				],
			},
			{
				packageId: 'atelier',
				isExclusive: true,
				includesFrom: `Todo lo de ${signatureName}, más:`,
				includes: [
					'Entrega en 48 horas',
					'Nosotros cargamos su lista de invitados, en Excel o escrita a mano, siempre que se lea bien',
					'Su invitación a su nombre, sin la firma de Celebra-me',
				],
				details: [],
			},
		],
	},
	faq: {
		title: 'Preguntas frecuentes',
		faqs: [
			{
				question: '¿Cómo y cuándo pago?',
				answer: 'Sin anticipo. Usted revisa su invitación 100 % terminada, tal como la verá un invitado, y paga al aprobarla; en ese momento se activa su panel de invitados.',
			},
			{
				question: '¿Cuánto tarda?',
				answer: `De 3 a 5 días hábiles desde que recibimos la información completa. ${atelierName} se entrega en 48 horas. En ${expressDeliveryPackages} puede agregar la ${expressDelivery.name.toLowerCase()} por ${expressDeliveryPrice}.`,
			},
			{
				question: '¿Puedo pedir cambios?',
				answer: 'Sí. Hacemos los cambios necesarios hasta que apruebe su invitación. Después, las correcciones de fecha, lugar u horario no tienen costo.',
			},
			{
				question: '¿La invitación lleva publicidad?',
				answer: `No. ${esencialName} y ${signatureName} llevan una firma discreta de Celebra-me al pie. En ${atelierName}, su invitación va a su nombre, sin la firma de Celebra-me.`,
			},
			{
				question: '¿Cuánto tiempo estará disponible?',
				answer: 'Su invitación permanece en línea durante un año garantizado a partir de la fecha de su evento.',
			},
			{
				question: '¿Qué necesito enviar?',
				answer: `Fecha, lugar, nombres, fotos y detalles del evento, además de su lista de invitados. En ${atelierName}, nosotros la cargamos a partir de su lista en Excel o escrita a mano, siempre que se lea bien.`,
			},
		],
	},
	howItWorks: {
		eyebrow: 'PROCESO',
		title: 'De la idea a su invitación, en cuatro pasos',
		steps: [
			{ title: 'Nos envía los datos de su evento.' },
			{ title: 'Diseñamos su invitación.' },
			{ title: 'La revisa terminada y la aprueba.' },
			{ title: 'La comparte con sus invitados.' },
		],
	},
	contact: {
		eyebrow: 'COTIZACIÓN',
		title: 'Cuéntenos de su evento',
		cta: {
			label: PRIMARY_CTA_LABEL,
		},
		cardIntro: 'Escríbanos por WhatsApp y le enviamos su cotización.',
		checklist: [
			'El tipo de evento, por ejemplo XV años o boda.',
			'La fecha del evento.',
			'Lo que imagina para su invitación.',
		],
		about: {
			title: 'Nosotros',
			text: 'Celebra-me es atendido por Francisco Mendoza desde Los Mochis, Sinaloa.',
			email: 'contacto@celebra-me.com',
		},
	},
};
