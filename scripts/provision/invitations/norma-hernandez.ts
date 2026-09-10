import {
	defineInvitation,
	type InvitationAssetSpec,
	type UploadedAssetMap,
} from './invitation-definition.ts';

export const NORMA_EVENT = {
	slug: 'norma-hernandez',
	eventType: 'cumple',
	title: '65 años de Norma Hernandez',
	baseDemoId: 'demo-cumple-luxury-hacienda',
	themeId: 'luxury-hacienda',
	localDateTime: '2026-11-14T17:00',
	timeZone: 'America/Mazatlan',
	startsAtUtc: '2026-11-15T00:00:00.000Z',
	heroDate: '2026-11-14T17:00:00.000Z',
} as const;

export const NORMA_COPY = {
	childhood:
		'Doy gracias a Dios por mi vida, por estar presente en cada momento, por llenarme de fe, esperanza y amor, y por no permitir que me rindiera ante las adversidades.',
	children:
		'A ustedes, mis hijos, que han llenado mi vida de amor, alegrías y felicidad: gracias, gracias, gracias.',
	grandchildren:
		'A mis hermosos peques, que dan brillo a mi existencia cada domingo y dejan la casa de la Yaya patas para arriba: gracias, gracias, gracias.',
	family: 'El tiempo sigue su camino, dejando huellas de amor, felicidad, paz y una inmensa alegría en esta gran familia que Dios me ha regalado. Por eso y tanto más, gracias, Dios.',
	life: 'Smile at life',
	closing:
		'Gracias por acompañarnos en este día tan especial para mí y mi familia. Su presencia hará de esta noche un momento inolvidable.',
} as const;

export const NORMA_PHOTOGRAPHS = [
	{
		key: 'childhood',
		width: 900,
		height: 1600,
		alt: 'Norma durante su infancia, fotografía de época restaurada',
		optimizationRole: 'hero-desktop',
	},
	{
		key: 'children',
		width: 900,
		height: 1600,
		alt: 'Norma acompañada de sus tres hijos',
		optimizationRole: 'gallery',
	},
	{
		key: 'grandchildren',
		width: 900,
		height: 1600,
		alt: 'Norma junto a sus cuatro nietos',
		optimizationRole: 'gallery',
	},
	{
		key: 'family',
		width: 1600,
		height: 900,
		alt: 'Un recuerdo de Navidad con la familia de Norma',
		optimizationRole: 'gallery',
	},
	{
		key: 'life',
		width: 1086,
		height: 1448,
		alt: 'Norma con un ramo de flores en un patio luminoso',
		optimizationRole: 'gallery',
	},
	{
		key: 'closing',
		width: 1024,
		height: 1536,
		alt: 'Retrato de Norma con vestido azul de celebración',
		optimizationRole: 'editorial-featured',
	},
] as const;

export type NormaAssetKey = (typeof NORMA_PHOTOGRAPHS)[number]['key'];
export const NORMA_ASSETS: readonly InvitationAssetSpec[] = NORMA_PHOTOGRAPHS.map((photo) => ({
	...photo,
	relativePath: `${photo.key}.webp`,
	displayName: photo.alt,
	sourcePolicy: 'preserve',
	delivery: { mode: 'original', width: photo.width, height: photo.height },
}));

const city = 'Culiacán, Sinaloa';
const date = '14 de noviembre de 2026';
const venueData = [
	{
		type: 'ceremony',
		venueEvent: 'Ceremonia religiosa',
		venueName: 'Nuestra Señora de Guadalupe · La Lomita',
		address: 'Av. Juan Pablo II s/n, colonia Lomas de Guadalupe',
		time: '5:00 p. m.',
	},
	{
		type: 'reception',
		venueEvent: 'Recepción',
		venueName: 'Salón El Conquistador · Hotel San Luis Lindavista',
		address: 'Av. Obregón y Río Sinaloa n.º 1, colonia Guadalupe',
		time: '6:00 p. m.',
	},
] as const;

export function buildNormaPublishedContent(
	assets: UploadedAssetMap<NormaAssetKey>,
): Record<string, unknown> {
	return {
		eventType: NORMA_EVENT.eventType,
		isDemo: false,
		templateId: 'cumple-luxury-hacienda',
		_assetSlug: NORMA_EVENT.slug,
		visualProfileId: NORMA_EVENT.slug,
		title: NORMA_EVENT.title,
		description:
			'Acompáñenos a celebrar los 65 años de Norma Hernandez el 14 de noviembre de 2026 en Culiacán.',
		theme: { preset: NORMA_EVENT.themeId },
		eventTiming: {
			localDateTime: NORMA_EVENT.localDateTime,
			timeZone: NORMA_EVENT.timeZone,
			startsAtUtc: NORMA_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'quote',
			'gallery',
			'countdown',
			'location',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		composition: { intersections: {} },
		hero: {
			variant: 'framed-portrait',
			name: 'Norma Hernandez',
			label: '65 años',
			nickname: 'Una vida, tantos motivos para agradecer.',
			date: NORMA_EVENT.heroDate,
			backgroundImage: assets.childhood,
			scrollLabel: 'Descubra mi historia',
		},
		envelope: {
			variant: 'luxury-hacienda',
			disabled: false,
			envelopeName: 'Norma Hernandez',
			cardName: 'Norma Hernandez',
			cardLabel: '65 años',
			teaserDetails: '65 años · Una vida para celebrar',
			guestPlacement: 'outside-envelope',
			sealStyle: 'monogram',
			sealIcon: 'monogram',
			sealInitials: 'NH',
			microcopy: 'Abra mi invitación',
			tooltipText: 'Abra mi invitación',
			closedPalette: {
				primary: 'textPrimary',
				accent: 'actionAccent',
				background: 'surfaceSecondary',
			},
		},
		music: {
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1789008926/Maria_Martha_Serra_Lima_-_A_Mi_Manera_opt_stvuaw.mp3',
			autoPlay: true,
		},
		quote: { text: NORMA_COPY.childhood, author: 'Norma Hernandez' },
		gallery: {
			variant: 'narrative-stack',
			eyebrow: 'Mi historia',
			title: 'Lo más hermoso de mi vida',
			items: NORMA_PHOTOGRAPHS.filter(
				(photo) => photo.key !== 'childhood' && photo.key !== 'closing',
			).map((photo) => ({
				key: photo.key,
				layoutRole: photo.key === 'life' ? 'feature' : 'standard',
				image: assets[photo.key],
				alt: photo.alt,
				caption: NORMA_COPY[photo.key],
			})),
		},
		countdown: {
			variant: 'standard',
			title: 'Nos vemos muy pronto',
			footerText: 'Para celebrar la vida, juntos.',
			presentationOptions: { visibleUnits: ['days'] },
		},
		location: {
			variant: 'standard',
			accessPolicy: { visibility: 'public' },
			presentationOptions: { showFlourishes: false, showNavigationButtons: true },
			introEyebrow: 'La celebración',
			introHeading: 'Un día para compartir',
			introLede: 'Será un honor contar con su presencia en estos dos momentos especiales.',
			venues: venueData.map((venue) => {
				const query = encodeURIComponent(`${venue.venueName}, ${venue.address}, ${city}`);
				return {
					...venue,
					city,
					date,
					googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}`,
					appleMapsUrl: `https://maps.apple.com/?q=${query}`,
				};
			}),
			indications: [
				{ iconName: 'DressCode', styleVariant: 'default', text: 'Vestimenta formal' },
			],
		},
		rsvp: {
			variant: 'standard',
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			title: '¿Me acompaña a celebrar?',
			subcopy: 'Su confirmación nos ayudará a recibirlo con todo nuestro cariño.',
			confirmationMessage:
				'Su confirmación quedó registrada. Será un gusto celebrar con usted.',
			responseMessages: {
				confirmed: {
					title: '¡Gracias por confirmar, {guestName}!',
					subtitle: 'Su asistencia ha quedado registrada.',
				},
				declined: {
					title: 'Gracias por avisarnos, {guestName}.',
					subtitle: 'Lamentamos que no pueda acompañarnos.',
				},
			},
			labels: {
				confirmButton: 'Confirmar asistencia',
				name: 'Nombre',
				guestCount: 'Personas que asistirán',
				attendance: 'Asistencia',
			},
			personalizedAccess: {
				variant: 'standard',
				title: 'Un lugar para usted',
				subtitle: 'Esta invitación está dedicada a:',
				footerText: 'Confirme su asistencia con los pases de su invitación.',
			},
			calendar: {
				title: NORMA_EVENT.title,
				description:
					'Ceremonia a las 17:00 en La Lomita. Recepción a las 18:00 en el Salón El Conquistador, Culiacán.',
				startsAt: NORMA_EVENT.startsAtUtc,
			},
		},
		thankYou: {
			variant: 'portrait-letter',
			message: NORMA_COPY.closing,
			closingName: 'Norma Hernandez',
			closingPhrase: 'Con todo mi cariño',
			date,
			image: assets.closing,
		},
		navigation: [
			{ label: 'Ubicaciones', href: '#event-location' },
			{ label: 'Confirmar asistencia', href: '#rsvp' },
		],
		sharing: {
			ogImage: assets.childhood,
			ogDescription: '65 años de Norma Hernandez · 14 de noviembre de 2026 · Culiacán',
			whatsappTemplate:
				'Hola {name}, le comparto mi invitación para celebrar mis 65 años: {inviteUrl}',
		},
	};
}

export const normaInvitation = defineInvitation<NormaAssetKey>({
	slug: NORMA_EVENT.slug,
	managedIdentityId: '0779ce6e-6d45-4dce-8b23-1895b84953ac',
	managedIdentityProvenance: 'persisted',
	previousSlugs: ['norma-margarita-hernandez-zabalsa'],
	createdAt: '2026-09-08T00:00:00.000Z',
	lifecycle: 'published',
	deliveryScope: 'content-and-assets',
	eventType: NORMA_EVENT.eventType,
	title: NORMA_EVENT.title,
	clientName: 'Norma Hernandez',
	hostLoginAlias: 'norma_hernandez',
	photosReceived: true,
	baseDemoId: NORMA_EVENT.baseDemoId,
	themeId: NORMA_EVENT.themeId,
	visualProfileId: NORMA_EVENT.slug,
	eventTiming: {
		localDateTime: NORMA_EVENT.localDateTime,
		timeZone: NORMA_EVENT.timeZone,
		startsAtUtc: NORMA_EVENT.startsAtUtc,
	},
	assets: NORMA_ASSETS,
	buildPublishedContent: buildNormaPublishedContent,
});
