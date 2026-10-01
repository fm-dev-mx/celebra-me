import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import {
	formatMxn,
	getExpressDelivery,
	getPromoPackage,
	getStartingPrice,
} from '@/data/promo-campaign.data';
import { CLIENT_TESTIMONIALS } from '@/data/testimonials.data';

const PRIMARY_CTA_LABEL = 'Cotizar por WhatsApp';

/** Featured demo opened by the hero secondary action ("Ver una invitación"). */
const HERO_DEMO_SLUG = 'demo-xv-celestial-blue';
const heroDemo = DEMO_SHOWROOM_ITEMS.find((item) => item.slug === HERO_DEMO_SLUG);
if (!heroDemo) throw new Error(`Missing hero demo: ${HERO_DEMO_SLUG}`);

const expressDelivery = getExpressDelivery();
const expressDeliveryPackages = expressDelivery.appliesTo
	.map((packageId) => getPromoPackage(packageId).name)
	.join(' y ');
const expressDeliveryPrice = `+${formatMxn(expressDelivery.price)} MXN`;
const esencialName = getPromoPackage('esencial').name;
const signatureName = getPromoPackage('signature').name;
const atelierName = getPromoPackage('atelier').name;

export const landingData: LandingPageData = {
	seo: {
		title: 'Celebra-me | Invitaciones Digitales Premium',
		description: `Invitaciones digitales con pase y confirmación para cada invitado. Diseño único, panel de invitados y envío por WhatsApp. Desde ${formatMxn(getStartingPrice())} MXN, sin anticipo.`,
	},
	hero: {
		title: 'Invitaciones digitales con pase y confirmación para cada invitado',
		subtitle: 'Usted la envía por WhatsApp y ve quién confirmó.',
		priceLine: {
			prefix: 'Desde',
			suffix: 'MXN, pago único.',
		},
		paymentNote: 'Sin anticipo: paga al recibir su invitación terminada.',
		primaryCtaLabel: PRIMARY_CTA_LABEL,
		secondaryCtaLabel: 'Ver una invitación',
		secondaryCtaUrl: heroDemo.href,
		secondaryCtaDemoSlug: heroDemo.slug,
	},
	eventSelector: {
		eyebrow: 'DEMOS POR EVENTO',
		title: 'Vea cómo puede lucir su invitación',
		description: 'Elija su evento y abra la demo completa.',
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
		cta: {
			label: PRIMARY_CTA_LABEL,
		},
	},
	guestExperience: {
		eyebrow: 'PARA SUS INVITADOS',
		title: 'Una invitación clara desde el primer mensaje',
		description:
			'Todo lo que necesitan para llegar, confirmar y celebrar con usted, en un solo enlace.',
		values: [
			{
				name: 'Su nombre y sus pases',
				description: 'Cada invitación muestra a quién va dirigida y cuántos lugares tiene.',
			},
			{
				name: 'Confirmación en un toque',
				description: 'Responden desde la misma invitación.',
			},
			{
				name: 'Cómo llegar',
				description:
					'Google Maps, Waze y Apple Maps. La ubicación se muestra a quienes confirman.',
			},
			{
				name: 'Calendario y mesa de regalos',
				description:
					'Guardan la fecha con un toque y ven su mesa de regalos en la invitación.',
			},
		],
		cta: {
			label: PRIMARY_CTA_LABEL,
		},
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
				includes: ['QR de recuerdos'],
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
					'Celebra-me carga su lista de invitados (Excel o legible)',
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
				answer: 'Sin anticipo. Usted revisa su invitación 100 % terminada con un Invitado de prueba y paga al aprobarla; en ese momento se activa su panel de invitados.',
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
				answer: `Fecha, lugar, nombres, fotos y detalles del evento, además de su lista de invitados. En ${atelierName}, nosotros la cargamos a partir de su lista en Excel o legible.`,
			},
		],
	},
	howItWorks: {
		eyebrow: 'PROCESO',
		title: 'Nosotros la diseñamos. Usted la envía desde su panel.',
		steps: [
			{ title: 'Nos envía los datos de su evento.' },
			{ title: 'Diseñamos su invitación.' },
			{ title: 'La revisa terminada y paga al aprobarla.' },
			{ title: 'La envía por WhatsApp y ve quién confirmó.' },
		],
		cta: {
			label: PRIMARY_CTA_LABEL,
		},
	},
	contact: {
		eyebrow: 'COTIZACIÓN',
		title: 'Cuéntenos de su evento',
		cta: {
			label: PRIMARY_CTA_LABEL,
		},
		formIntro: 'O déjenos sus datos y le contactamos.',
		about: {
			title: 'Nosotros',
			text: 'Celebra-me es atendido por Francisco Mendoza desde Los Mochis, Sinaloa.',
			email: 'contacto@celebra-me.com',
		},
	},
};
