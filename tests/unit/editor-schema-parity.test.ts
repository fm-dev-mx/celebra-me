import { InvitationEditorSectionSchemas } from '@/lib/intake/schemas/invitation-editor.schema';

/**
 * Regression test: every editable section from real published content
 * must pass the editor section schema after mergePublishedWithDraft.
 *
 * This test uses the actual Leah Lexa published content fixture and
 * simulates the merge to catch unrecognized_keys before browser testing.
 */

const LEAH_LEXA_PUBLISHED_CONTENT = {
	eventType: 'baby-shower',
	isDemo: false,
	title: 'Baby Shower de Leah Lexa',
	description:
		'Invitacion real para celebrar el Baby Shower de Leah Lexa. Los recursos visuales incluyen imagenes oficiales del cliente.',
	_assetSlug: 'leah-lexa-baby-shower',
	theme: { fontFamily: 'serif', preset: 'celestial-blue' },
	eventTiming: {
		localDateTime: '2026-06-21T14:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2026-06-21T20:00:00.000Z',
	},
	sectionOrder: [
		'quote',
		'family',
		'location',
		'gifts',
		'personalizedAccess',
		'rsvp',
		'gallery',
		'thankYou',
	],
	sectionStyles: {
		location: { showFlourishes: true },
		rsvp: {
			labels: {
				name: 'Tu nombre',
				guestCount: 'Personas que asistirán',
				attendance: '¿Me acompañas?',
				confirmButton: 'Confirmar asistencia',
			},
		},
	},
	hero: {
		name: 'Leah Lexa',
		label: 'Mi Baby Shower',
		date: '2026-06-21T20:00:00.000Z',
		backgroundImage: 'hero',
	},
	quote: {
		text: 'Los tiempos de Dios son perfectos, y les ha dado la dicha a mis papis de hacer crecer nuestra familia.',
		author: 'Leah Lexa',
	},
	family: {
		featuredImage: 'family',
		parents: { father: 'Hugo', mother: 'Fernanda' },
		parentsOrder: 'father-first',
		focalPoint: '50% 50%',
		labels: {
			sectionTitle: 'Mis papis',
			sectionSubtitle: 'Hugo y Fernanda',
			parentsTitle: 'Con mucho amor',
			sectionMessage:
				'Quieren compartir con ustedes mi Baby Shower. Desde la pancita de mamá, ya siento el cariño con el que me esperan.',
		},
	},
	gallery: {
		variant: 'single',
		presentation: 'pet-keepsake',
		title: 'La manada también te espera',
		subtitle: 'En casa ya hay patitas listas para recibirte con amor.',
		items: [{ image: 'gallery03' }],
	},
	location: {
		introEyebrow: 'Nos vemos para celebrar',
		introHeading: 'Domingo, 21 de junio de 2026',
		introLede: 'Quiero compartir este día tan especial con ustedes.',
		indicationsHeading: 'Detalles para mis invitados',
		venues: [
			{
				type: 'custom',
				id: 'baby-shower',
				venueEvent: 'Baby Shower',
				venueName: 'Casa de mi familia',
				address: 'Calle 22, Manzana 1, Lote 20, Col. Guadalupe Proletaria, C.P. 07670',
				city: 'Ciudad de México',
				date: 'domingo, 21 de junio de 2026',
				time: '2:00 PM',
				mapUrl: 'https://www.google.com/maps/search/?api=1&query=Calle%2022%2C%20Manzana%201%2C%20Lote%2020%2C%20Col.%20Guadalupe%20Proletaria%2C%20C.P.%2007670',
				coordinates: { lat: 19.4853, lng: -99.143 },
			},
		],
		indications: [
			{
				iconName: 'MapLocation',
				styleVariant: 'default',
				text: 'Referencia: Casa color naranja al final de la calle.',
			},
			{
				iconName: 'DressCode',
				styleVariant: 'reserved',
				text: 'Código de vestimenta: Ropa casual en colores pastel.',
			},
		],
	},
	gifts: {
		title: 'Mesa de regalos',
		subtitle:
			'Si desean tener un detalle para mí, mis papis prepararon una opción especial con mucho cariño.',
		items: [
			{
				type: 'store',
				title: 'Un detalle con cariño',
				description: 'Mesa disponible en Liverpool',
				url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/51975133',
			},
		],
	},
	rsvp: {
		title: 'Confirma tu asistencia',
		subcopy:
			'Tu respuesta ayuda a mis papis a preparar cada detalle para recibirme con mucho cariño.',
		guestCap: 100,
		accessMode: 'personalized-only',
		confirmationMessage:
			'Gracias por confirmar. Mis papis y yo estamos muy felices de saber que nos acompañarán.',
		confirmationMode: 'api',
	},
	thankYou: {
		image: 'gallery02',
		message: 'Este primer recuerdo y cada muestra de cariño serán parte de mi historia.',
		closingName: 'Leah Lexa',
	},
	envelope: {
		disabled: false,
		sealStyle: 'wax',
		sealIcon: 'monogram',
		sealInitials: 'LL',
		sealVariant: 'premium-rose',
		microcopy: 'Toca para abrir mi invitación',
		documentLabel: 'Baby Shower',
		cardLabel: 'Baby Shower',
		cardTagline: 'Una celebración celestial',
		stampText: 'Leah Lexa',
		stampYear: '2026',
		closedPalette: {
			primary: 'surfacePrimary',
			accent: 'actionAccent',
			background: 'surfacePrimary',
		},
	},
	sharing: {
		whatsappTemplate:
			'Hola {name}, soy Leah Lexa. Te comparto la invitación a mi Baby Shower: {inviteUrl}',
		ogImage: 'hero',
		ogDescription:
			'Acompáñame en mi Baby Shower el domingo, 21 de junio de 2026, a las 2:00 PM.',
	},
};

/**
 * Simulate what getSectionValue returns for a given section after
 * mergePublishedWithDraft has produced the effective content.
 */
function extractSectionValue(
	content: Record<string, unknown>,
	section: keyof typeof InvitationEditorSectionSchemas,
): unknown {
	const draftContent = content as Record<string, unknown>;
	switch (section) {
		case 'main':
			return {
				title: draftContent.title,
				description: draftContent.description,
				hero: draftContent.hero ?? {},
			};
		case 'messages':
			return { quote: draftContent.quote, thankYou: draftContent.thankYou };
		case 'location':
			return { ...(draftContent.location ?? {}), eventTiming: draftContent.eventTiming };
		case 'publication':
			return { sectionOrder: draftContent.sectionOrder ?? [] };
		default:
			return draftContent[section] ?? {};
	}
}

const SECTIONS_TO_TEST: Array<keyof typeof InvitationEditorSectionSchemas> = [
	'main',
	'family',
	'location',
	'countdown',
	'itinerary',
	'rsvp',
	'music',
	'envelope',
	'gifts',
	'messages',
	'gallery',
	'photoNotes',
	'publication',
	'sharing',
];

describe('Editor section schema parity with Leah Lexa published content', () => {
	for (const section of SECTIONS_TO_TEST) {
		it(`accepts merged "${section}" value from real published content`, () => {
			const value = extractSectionValue(LEAH_LEXA_PUBLISHED_CONTENT, section);
			const schema = InvitationEditorSectionSchemas[section];
			const result = schema.safeParse(value);

			if (!result.success) {
				const unrecognized = result.error.issues.filter(
					(i) => i.code === 'unrecognized_keys',
				);
				const otherIssues = result.error.issues.filter(
					(i) => i.code !== 'unrecognized_keys',
				);

				const lines: string[] = [];
				if (unrecognized.length > 0) {
					lines.push(`\n  Section: ${section}`);
					for (const issue of unrecognized) {
						lines.push(
							`  unrecognized_keys at [${issue.path.join('.')}]: ${(issue as any).keys?.join(', ') ?? 'unknown'}`,
						);
					}
				}
				if (otherIssues.length > 0) {
					lines.push(`\n  Section: ${section} — other issues:`);
					for (const issue of otherIssues) {
						lines.push(`  [${issue.path.join('.')}] ${issue.code}: ${issue.message}`);
					}
				}

				if (lines.length > 0) {
					throw new Error(`Schema parity failure:\n${lines.join('\n')}`);
				}
			}
		});
	}
});
