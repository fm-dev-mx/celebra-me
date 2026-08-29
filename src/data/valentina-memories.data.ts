/**
 * Single source of truth for the Valentina Hernández XV permanent Memories QR.
 *
 * The QR payload must never be derived from BASE_URL, request origin, Preview
 * URLs, or environment variables — it is a permanent printed contract.
 * Upload constraints live in `valentina-memories-upload.contract.ts`.
 */

import {
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
} from './valentina-memories-upload.contract';

function formatMiB(bytes: number): number {
	return bytes / (1024 * 1024);
}

export function buildValentinaMemoriesUploadLimitsCopy(): string {
	const formats = Array.from(
		new Set(
			Object.values(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).map(({ extension }) => extension),
		),
	)
		.map((extension) => extension.toUpperCase())
		.join(', ');
	return `Formatos: ${formats}. Fotos: máximo ${formatMiB(VALENTINA_MEMORIES_MAX_IMAGE_BYTES)} MiB después de optimizar. Videos: máximo ${formatMiB(VALENTINA_MEMORIES_MAX_VIDEO_BYTES)} MiB y ${VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos; hasta ${VALENTINA_MEMORIES_SESSION_MAX_VIDEOS} videos por sesión.`;
}

export function buildValentinaMemoriesUploadSummaryCopy(): string {
	return `Fotos hasta ${formatMiB(VALENTINA_MEMORIES_MAX_IMAGE_BYTES)} MiB. Videos hasta ${VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos y ${formatMiB(VALENTINA_MEMORIES_MAX_VIDEO_BYTES)} MiB. Máximo ${VALENTINA_MEMORIES_SESSION_MAX_VIDEOS} videos.`;
}

export function buildValentinaMemoriesVideoTooLongCopy(): string {
	return `El video no puede durar más de ${VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos.`;
}

export const VALENTINA_MEMORIES_ROUTE_PATH = '/r/valentina' as const;
export const VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH = '/r/valentina/recuperar' as const;
export const VALENTINA_MEMORIES_ORGANIZER_LOGIN_PATH =
	'/login?next=%2Fdashboard%2Fmemories' as const;

/** Exact URL encoded by the printable QR assets. */
export const VALENTINA_MEMORIES_QR_TARGET_URL = 'https://celebra-me.com/r/valentina' as const;

export const VALENTINA_MEMORIES_SVG_RELATIVE_PATH = 'public/qr/valentina-memories.svg' as const;
export const VALENTINA_MEMORIES_PNG_RELATIVE_PATH = 'public/qr/valentina-memories.png' as const;

export const valentinaMemoriesPageCopy = {
	title: 'Recuerdos de Valentina | Celebra-me',
	description:
		'Espacio temporal para subir fotos y videos de los XV años de Valentina Hernández Almaguer.',
	subtitle: 'Recuerdos de Valentina',
	heading: 'Comparta sus fotos y videos',
	body: 'Suba una foto o un video de la celebración de Valentina de forma rápida y segura.',
	recoveryCtaLabel: 'Recuperar mis recuerdos',
	recoveryCtaHref: VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH,
	organizerCtaLabel: 'Acceso del organizador',
	organizerCtaHref: VALENTINA_MEMORIES_ORGANIZER_LOGIN_PATH,
	footer: 'Celebra-me • Recuerdos digitales',
	robots: 'noindex',
} as const;

export const valentinaMemoriesRecoveryPageCopy = {
	title: 'Recuperar recuerdos de Valentina | Celebra-me',
	description: 'Recupere de forma segura los recuerdos que compartió para Valentina.',
	heading: 'Recupere sus recuerdos',
	body: 'Escriba el código que guardó al comenzar.',
	inputLabel: 'Código de recuperación',
	submit: 'Recuperar recuerdos',
	submitting: 'Recuperando…',
	failed: 'No pudimos recuperar sus recuerdos. Revise el código e intente de nuevo.',
	backLabel: 'Volver a compartir recuerdos',
	backHref: VALENTINA_MEMORIES_ROUTE_PATH,
	organizerLabel: 'Acceso del organizador',
	organizerHref: VALENTINA_MEMORIES_ORGANIZER_LOGIN_PATH,
	robots: 'noindex',
} as const;

export const valentinaMemoriesCaptureCopy = {
	chooseFile: 'Elija una foto o un video',
	chooseFileHint: buildValentinaMemoriesUploadSummaryCopy(),
	limitsDetails: buildValentinaMemoriesUploadLimitsCopy(),
	detailsLabel: 'Ver formatos, límites y privacidad',
	privacyHint:
		'Usted podrá ver sus recuerdos y solo la persona organizadora podrá verlos y descargarlos todos. Los formatos que no se puedan optimizar pueden conservar metadatos del teléfono.',
	preparing: 'Preparando su recuerdo…',
	optimizing: 'Optimizando su foto…',
	cancelOptimization: 'Cancelar optimización',
	uploading: 'Subiendo su recuerdo…',
	confirming: 'Confirmando que llegó correctamente…',
	success: 'Se guardó. Gracias por compartir este momento.',
	uploadAnother: 'Subir otro recuerdo',
	viewMemories: 'Ver mis recuerdos',
	retry: 'Intentar de nuevo',
	unsupportedType: 'Este tipo de archivo no está permitido.',
	fileTooLarge: 'El archivo supera el tamaño permitido.',
	videoTooLong: buildValentinaMemoriesVideoTooLongCopy(),
	videoUnreadable: 'No se pudo leer el video. Intente con otro archivo.',
	windowClosed: 'La ventana para subir recuerdos no está abierta.',
	rateLimited: 'Hay demasiadas solicitudes. Intente de nuevo en un momento.',
	quotaReached: 'Esta sesión o el evento ya no tienen espacio para otro archivo.',
	signFailed: 'No se pudo preparar la subida. Intente de nuevo.',
	putFailed: 'No pudimos subir el archivo. Revise su conexión e intente de nuevo.',
	networkFailed: 'No tiene conexión. Intente de nuevo cuando vuelva a estar en línea.',
	officialOriginRequired: 'Abra el enlace oficial para compartir recuerdos.',
	officialOriginUnavailable: 'La carga solo está disponible desde el enlace oficial.',
	unavailable: 'La carga de recuerdos no está disponible en este momento.',
	recoveryCodeTitle: 'Guarde su código de recuperación',
	recoveryCodeHint:
		'Permite recuperar sus recuerdos en otro dispositivo. No lo comparta públicamente.',
	copyRecoveryCode: 'Copiar código',
	recoveryCodeCopied: 'Código copiado',
	sharingAs: 'Compartiendo como',
	changeName: 'Cambiar nombre',
	cancelNameChange: 'Cancelar',
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
