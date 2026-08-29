/**
 * Single source of truth for the Valentina Hernández XV permanent Memories QR.
 *
 * The QR payload must never be derived from BASE_URL, request origin, Preview
 * URLs, or environment variables — it is a permanent printed contract.
 * Upload constraints live in `valentina-memories-upload.contract.ts`.
 */

export const VALENTINA_MEMORIES_ROUTE_PATH = '/r/valentina' as const;

/** Exact URL encoded by the printable QR assets. */
export const VALENTINA_MEMORIES_QR_TARGET_URL = 'https://celebra-me.com/r/valentina' as const;

export const VALENTINA_MEMORIES_SVG_RELATIVE_PATH = 'public/qr/valentina-memories.svg' as const;
export const VALENTINA_MEMORIES_PNG_RELATIVE_PATH = 'public/qr/valentina-memories.png' as const;

export const valentinaMemoriesPageCopy = {
	title: 'Recuerdos de Valentina | Celebra-me',
	description:
		'Espacio temporal para subir fotos y videos de los XV años de Valentina Hernández Almaguer.',
	subtitle: 'Comparta un recuerdo',
	heading: 'Recuerdos de Valentina',
	body: 'Puede subir aquí una foto o un video de la celebración de XV años de Valentina. Gracias por guardar estos momentos con tanto cariño.',
	primaryCtaLabel: 'Ver la invitación',
	primaryCtaHref: '/xv/valentina-hernandez',
	secondaryCtaLabel: 'Volver al inicio',
	secondaryCtaHref: '/',
	footer: 'Celebra-me • Recuerdos digitales',
	robots: 'noindex',
} as const;

export const valentinaMemoriesCaptureCopy = {
	chooseFile: 'Elija una foto o un video',
	chooseFileHint: 'Acepta fotos y videos breves de la celebración.',
	uploading: 'Subiendo su recuerdo…',
	success: 'Se guardó. Gracias por compartir este momento.',
	uploadAnother: 'Subir otra',
	retry: 'Intentar de nuevo',
	unsupportedType: 'Este tipo de archivo no está permitido.',
	fileTooLarge: 'El archivo supera el tamaño permitido.',
	videoTooLong: 'El video no puede durar más de 60 segundos.',
	videoUnreadable: 'No se pudo leer el video. Intente con otro archivo.',
	windowClosed: 'La ventana para subir recuerdos no está abierta.',
	rateLimited: 'Hay demasiadas solicitudes. Intente de nuevo en un momento.',
	signFailed: 'No se pudo preparar la subida. Intente de nuevo.',
	putFailed: 'No se pudo completar la subida. Intente de nuevo.',
	networkFailed: 'No hay conexión. Intente de nuevo.',
	unavailable: 'La carga de recuerdos no está disponible en este momento.',
	recoveryCodeTitle: 'Guarde su código de recuperación',
	recoveryCodeHint:
		'Permite recuperar sus recuerdos en otro dispositivo. No lo comparta públicamente.',
	myMemories: 'Mis recuerdos',
	validationPending: 'En validación',
	duplicate: 'Duplicado',
	accepted: 'Disponible',
	rejected: 'No aprobado',
	deleted: 'Eliminado',
	editCaption: 'Editar descripción',
	saveCaption: 'Guardar',
	deleteMemory: 'Eliminar recuerdo',
	confirmDelete: '¿Desea eliminar este recuerdo?',
	noMemories: 'Todavía no ha registrado recuerdos en este dispositivo.',
	recoveryPrompt: '¿Ya tiene un código de recuperación?',
	recoveryInputLabel: 'Código de recuperación',
	recover: 'Recuperar recuerdos',
	recoveryFailed: 'No se pudo recuperar la sesión. Revise el código e intente de nuevo.',
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
