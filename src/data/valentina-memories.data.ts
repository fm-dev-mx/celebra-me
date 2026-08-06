/**
 * Single source of truth for the Valentina Hernández XV permanent Memories QR.
 *
 * The QR payload must never be derived from BASE_URL, request origin, Preview
 * URLs, or environment variables — it is a permanent printed contract.
 */

export const VALENTINA_MEMORIES_ROUTE_PATH = '/r/valentina' as const;

/** Exact URL encoded by the printable QR assets. */
export const VALENTINA_MEMORIES_QR_TARGET_URL = 'https://celebra-me.com/r/valentina' as const;

export const VALENTINA_MEMORIES_SVG_PUBLIC_PATH = '/qr/valentina-memories.svg' as const;
export const VALENTINA_MEMORIES_PNG_PUBLIC_PATH = '/qr/valentina-memories.png' as const;

export const VALENTINA_MEMORIES_SVG_RELATIVE_PATH = 'public/qr/valentina-memories.svg' as const;
export const VALENTINA_MEMORIES_PNG_RELATIVE_PATH = 'public/qr/valentina-memories.png' as const;

export const valentinaMemoriesPageCopy = {
	title: 'Recuerdos de Valentina | Celebra-me',
	description:
		'Espacio temporal para subir fotos y videos de los XV años de Valentina Hernández Almaguer.',
	subtitle: 'Próximamente',
	heading: 'Recuerdos de Valentina',
	body: 'Pronto podrá subir aquí fotos y videos de la celebración de XV años de Valentina. Gracias por guardar estos momentos con tanto cariño.',
	primaryCtaLabel: 'Ver la invitación',
	primaryCtaHref: '/xv/valentina-hernandez',
	secondaryCtaLabel: 'Volver al inicio',
	secondaryCtaHref: '/',
	footer: 'Celebra-me • Recuerdos digitales',
	robots: 'noindex',
} as const;

/**
 * Fixed QR generation parameters. Changing any of these regenerates the
 * printable assets and must be intentional.
 */
export const valentinaMemoriesQrParams = {
	errorCorrectionLevel: 'H' as const,
	/** Quiet-zone modules around the QR matrix (QR Code Model 2). */
	marginModules: 4,
	foregroundColor: '#000000',
	backgroundColor: '#FFFFFF',
	/** SVG viewBox / render width used for the canonical vector artifact. */
	svgWidthPx: 1024,
	/** Derived PNG must be at least this size on each edge. */
	pngSizePx: 2000,
} as const;

export type ValentinaMemoriesQrParams = typeof valentinaMemoriesQrParams;
