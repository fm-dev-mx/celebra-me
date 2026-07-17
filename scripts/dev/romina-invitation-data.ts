export const ROMINA_EVENT = {
	eventType: 'xv',
	slug: 'romina-rios-chaparro',
	assetSlug: 'romina-rios-chaparro',
	baseDemoId: 'demo-xv-premiere-floral',
	themeId: 'premiere-floral',
	visualProfileId: 'romina-rios-chaparro',
	title: 'XV años de Romina Ríos Chaparro',
	localDateTime: '2026-08-14T17:00',
	timeZone: 'America/Chihuahua',
	startsAtUtc: '2026-08-14T23:00:00.000Z',
} as const;

export const ROMINA_ASSET_SPECS = [
	{
		key: 'hero',
		fileName: 'IMG_3263.jpeg',
		displayName: 'Romina — portada',
		alt: 'Romina con vestido verde salvia vista de espaldas entre follaje',
	},
	{
		key: 'portrait',
		fileName: 'IMG_3462.jpeg',
		displayName: 'Romina — retrato de presentación',
		alt: 'Retrato sonriente de Romina entre flores',
	},
	{
		key: 'family',
		fileName: 'IMG_3405.jpeg',
		displayName: 'Romina — familia',
		alt: 'Romina acompañada por su familia y sus mascotas',
	},
	{
		key: 'sageLandscape',
		fileName: 'IMG_3191.jpeg',
		displayName: 'Romina — vestido salvia horizontal',
		alt: 'Romina con vestido verde salvia en un jardín botánico',
	},
	{
		key: 'social',
		fileName: 'IMG_3201.jpeg',
		displayName: 'Romina — vista previa social',
		alt: 'Romina con vestido verde salvia en una composición horizontal',
	},
	{
		key: 'petPortrait',
		fileName: 'IMG_3308.jpeg',
		displayName: 'Romina — retrato con mascota',
		alt: 'Romina posa con una de sus mascotas',
	},
	{
		key: 'petLandscape',
		fileName: 'IMG_3324.jpeg',
		displayName: 'Romina — mascotas',
		alt: 'Romina comparte un momento con sus mascotas en el jardín',
	},
	{
		key: 'whitePortrait',
		fileName: 'IMG_3331.jpeg',
		displayName: 'Romina — capítulo blanco',
		alt: 'Romina con vestido blanco en un entorno botánico',
	},
	{
		key: 'whiteBotanical',
		fileName: 'IMG_3386.jpeg',
		displayName: 'Romina — retrato botánico',
		alt: 'Romina con vestido blanco entre vegetación y cactus',
	},
	{
		key: 'pinkFloral',
		fileName: 'IMG_3449.jpeg',
		displayName: 'Romina — capítulo floral',
		alt: 'Romina con vestido rosa junto a una estructura floral',
	},
	{
		key: 'closing',
		fileName: 'IMG_3442.jpeg',
		displayName: 'Romina — cierre XV',
		alt: 'Romina junto a globos con el número quince',
	},
] as const;

export type RominaAssetKey = (typeof ROMINA_ASSET_SPECS)[number]['key'];

export interface UploadedAssetRef {
	type: 'uploaded';
	assetId: string;
	src: string;
}

export type RominaAssetMap = Record<RominaAssetKey, UploadedAssetRef>;

const ceremonyAddress =
	'Boulevard Benito Juárez #200, Col. Centro, C.P. 31700, Nuevo Casas Grandes, Chihuahua';
const receptionAddress = 'Libramiento Gómez Morín, C.P. 31805, Nuevo Casas Grandes, Chihuahua';

function googleMapsSearch(query: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function appleMapsSearch(query: string): string {
	return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

export function buildRominaPublishedContent(assets: RominaAssetMap): Record<string, unknown> {
	const ceremonyQuery = `Catedral de Nuestra Señora de la Medalla Milagrosa, ${ceremonyAddress}`;
	const receptionQuery = `Gabro Jardín de Eventos, ${receptionAddress}`;

	return {
		eventType: ROMINA_EVENT.eventType,
		isDemo: false,
		templateId: 'xv-premiere-floral',
		visualProfileId: ROMINA_EVENT.visualProfileId,
		title: ROMINA_EVENT.title,
		description: 'Acompáñeme a celebrar este momento tan especial.',
		theme: { preset: ROMINA_EVENT.themeId },
		eventTiming: {
			localDateTime: ROMINA_EVENT.localDateTime,
			timeZone: ROMINA_EVENT.timeZone,
			startsAtUtc: ROMINA_EVENT.startsAtUtc,
		},
		sectionOrder: [
			'quote',
			'family',
			'countdown',
			'location',
			'itinerary',
			'gallery',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		_assetSlug: ROMINA_EVENT.assetSlug,
		hero: {
			name: 'Romina Ríos Chaparro',
			label: 'Mis XV',
			date: ROMINA_EVENT.startsAtUtc,
			backgroundImage: assets.hero,
			backgroundImageMobile: assets.hero,
			backgroundImageDesktop: assets.hero,
			portrait: assets.portrait,
			focalPoint: '50% 42%',
			focalPointMobile: '50% 42%',
			focalPointTablet: '50% 40%',
			focalPointDesktop: '58% 46%',
		},
		envelope: {
			disabled: false,
			cardLabel: 'Mis XV',
			envelopeName: 'Romina',
			cardName: 'Romina',
			cardTagline: '14 · 08 · 2026',
			sealStyle: 'wax',
			sealIcon: 'monogram',
			sealInitials: 'R',
			microcopy: 'Abra su invitación',
			closedPalette: {
				primary: 'surfacePrimary',
				accent: 'actionAccent',
				background: 'surfaceDark',
			},
		},
		quote: {
			text: 'Hay momentos que se sueñan toda la vida. Me hará muy feliz compartir con usted la celebración de mis XV años.',
			author: 'Romina',
		},
		family: {
			parents: {
				mother: 'Claudia Chaparro Juárez',
				father: 'Christian Miguel Ríos',
			},
			parentsOrder: 'mother-first',
			godparents: [{ name: 'Fernando Nájera' }, { name: 'Esmeralda Carbajal' }],
			labels: {
				sectionTitle: 'Mi familia',
				parentsTitle: 'Con el amor de mis padres',
				godparentsTitle: 'Acompañada por mis padrinos',
			},
			featuredImage: assets.family,
			focalPoint: '50% 35%',
		},
		countdown: {
			title: 'La celebración comienza en',
			footerText: 'Ceremonia · 5:00 p. m.',
		},
		location: {
			visibility: 'public',
			introEyebrow: '14 de agosto de 2026',
			introHeading: 'Ceremonia y recepción',
			ceremony: {
				venueEvent: 'Ceremonia',
				venueName: 'Catedral de Nuestra Señora de la Medalla Milagrosa',
				address: ceremonyAddress,
				city: 'Nuevo Casas Grandes, Chihuahua',
				date: '14 de agosto de 2026',
				time: '5:00 p. m.',
				mapUrl: googleMapsSearch(ceremonyQuery),
				googleMapsUrl: googleMapsSearch(ceremonyQuery),
				appleMapsUrl: appleMapsSearch(ceremonyQuery),
			},
			reception: {
				venueEvent: 'Recepción',
				venueName: 'Gabro Jardín de Eventos',
				address: receptionAddress,
				city: 'Nuevo Casas Grandes, Chihuahua',
				date: '14 de agosto de 2026',
				time: 'Cena a partir de las 8:30 p. m.',
				mapUrl: googleMapsSearch(receptionQuery),
				googleMapsUrl: googleMapsSearch(receptionQuery),
				appleMapsUrl: appleMapsSearch(receptionQuery),
			},
		},
		interludes: [
			{
				image: assets.sageLandscape,
				afterSection: 'location',
				alt: 'Romina con vestido verde salvia en un jardín botánico',
				height: 'tall',
				focalPoint: '50% 42%',
			},
		],
		itinerary: {
			title: 'Programa',
			items: [
				{ time: '5:00 p. m.', label: 'Ceremonia', iconName: 'Church' },
				{ time: '8:30 p. m.', label: 'Cena', iconName: 'Dinner' },
				{ time: '9:30 p. m.', label: 'Celebración', iconName: 'Party' },
			],
		},
		gallery: {
			eyebrow: 'Recuerdos',
			title: 'Romina',
			subtitle: 'Una historia entre naturaleza, familia y sueños',
			items: [
				{
					image: assets.portrait,
					alt: 'Retrato sonriente de Romina entre flores',
					focalPointMobile: '50% 28%',
					focalPointDesktop: '50% 24%',
				},
				{
					image: assets.sageLandscape,
					alt: 'Romina con vestido verde salvia en un jardín botánico',
					focalPoint: '50% 45%',
				},
				{
					image: assets.petPortrait,
					alt: 'Romina posa con una de sus mascotas',
					focalPoint: '50% 30%',
				},
				{
					image: assets.whitePortrait,
					alt: 'Romina con vestido blanco en un entorno botánico',
					focalPoint: '50% 30%',
				},
				{
					image: assets.petLandscape,
					alt: 'Romina comparte un momento con sus mascotas en el jardín',
					focalPoint: '50% 48%',
				},
				{
					image: assets.whiteBotanical,
					alt: 'Romina con vestido blanco entre vegetación y cactus',
					focalPoint: '50% 32%',
				},
				{
					image: assets.social,
					alt: 'Romina con vestido verde salvia en una composición horizontal',
					focalPoint: '50% 44%',
				},
				{
					image: assets.pinkFloral,
					alt: 'Romina con vestido rosa junto a una estructura floral',
					focalPoint: '50% 28%',
				},
				{
					image: assets.closing,
					alt: 'Romina junto a globos con el número quince',
					focalPoint: '50% 45%',
				},
			],
		},
		rsvp: {
			title: 'Confirme su asistencia',
			subcopy:
				'Será muy especial contar con su presencia. Confirme su asistencia para ayudarnos a preparar cada detalle.',
			guestCap: 4,
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			confirmationMessage:
				'Gracias por confirmar. Será un gusto compartir este día con usted.',
			personalizedAccess: {
				title: 'Pase de acceso',
				subtitle: 'Esta invitación ha sido preparada especialmente para:',
				footerText: 'Favor de confirmar su asistencia en la siguiente sección.',
			},
		},
		thankYou: {
			message: 'Gracias por ser parte de este momento tan especial.',
			closingName: 'Romina',
			date: '14 de agosto de 2026',
			image: assets.closing,
			focalPoint: '50% 42%',
		},
		sharing: {
			ogImage: assets.social,
			ogDescription: 'Invitación a los XV años de Romina Ríos Chaparro',
			whatsappTemplate:
				'Hola {name}, le compartimos su invitación para los XV años de Romina: {inviteUrl}',
		},
	};
}
