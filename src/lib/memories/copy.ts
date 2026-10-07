/**
 * Guest-facing Spanish copy for event memories. Pure builders: they receive the
 * event title and the global limits so no client identity lives in code.
 */

import {
	MEMORIES_ALLOWED_EXTENSIONS,
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
} from './contract/media-policy';
import type { MemoriesWindowState } from './contract/catalog';

function formatMiB(bytes: number): number {
	return bytes / (1024 * 1024);
}

export function formatMemoriesFileSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMemoriesDateTime(iso: string, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('es-MX', {
			timeZone,
			dateStyle: 'long',
			timeStyle: 'short',
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

export function formatMemoriesDate(iso: string, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('es-MX', { timeZone, dateStyle: 'long' }).format(
			new Date(iso),
		);
	} catch {
		return iso.slice(0, 10);
	}
}

export function buildMemoriesUploadLimitsCopy(maxSessionVideos: number): string {
	const formats = MEMORIES_ALLOWED_EXTENSIONS.map((extension) => extension.toUpperCase()).join(
		', ',
	);
	return `Formatos: ${formats}. Fotos: máximo ${formatMiB(MEMORIES_MAX_IMAGE_BYTES)} MiB después de optimizar. Videos: máximo ${formatMiB(MEMORIES_MAX_VIDEO_BYTES)} MiB y ${MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos; hasta ${maxSessionVideos} videos por sesión.`;
}

export function buildMemoriesVideoTooLongCopy(): string {
	return `El video no puede durar más de ${MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos.`;
}

export function buildMemoriesPageCopy(input: { eventTitle: string }) {
	return {
		title: `Recuerdos · ${input.eventTitle} | Celebra-me`,
		description: `Espacio temporal para subir fotos y videos de ${input.eventTitle}.`,
		subtitle: 'Recuerdos de la celebración',
		heading: 'Comparta sus fotos y videos',
		body: 'Comparta las fotos y videos que tomó hoy. Solo los anfitriones podrán verlos.',
		recoveryCtaLabel: 'Recuperar mis recuerdos',
		organizerCtaLabel: 'Acceso del organizador',
		footer: 'Celebra-me • Recuerdos digitales',
		robots: 'noindex',
	} as const;
}

export const memoriesGalleryCopy = {
	title: 'Galería',
	eyebrow: 'Galería de recuerdos',
	intro: 'Las fotos y videos que compartieron los invitados.',
	empty: 'Todavía no hay recuerdos en la galería.',
	loadError: 'No se pudo cargar la galería. Revise su conexión e intente de nuevo.',
	retry: 'Intentar de nuevo',
	loadMore: 'Ver más recuerdos',
	loading: 'Cargando…',
	photoBy: (name: string) => `Foto de ${name}`,
	videoBy: (name: string) => `Video de ${name}`,
	video: 'Video',
	sharedBy: (name: string, time: string) => `Compartido por ${name} · ${time}`,
	position: (index: number, total: number) => `Recuerdo ${index} de ${total}`,
	previous: 'Anterior',
	next: 'Siguiente',
	download: 'Descargar',
	close: 'Cerrar',
	unavailableTitle: 'Esta galería no está disponible',
	unavailableBody:
		'El enlace cambió o la galería ya no se comparte. Pida el enlace nuevo a los anfitriones.',
} as const;

export const memoriesRecoveryFormCopy = {
	inputLabel: 'Código de recuperación',
	inputHint: '12 letras y números; los guiones se agregan solos.',
	noCodeTitle: '¿No tiene el código?',
	noCodeBody:
		'Sin él no podemos mostrarle lo que subió desde otro teléfono, pero sus recuerdos siguen guardados para los anfitriones. Puede seguir compartiendo desde la página principal.',
	submit: 'Recuperar recuerdos',
	submitting: 'Recuperando…',
	failed: 'No pudimos recuperar sus recuerdos. Revise el código e intente de nuevo.',
} as const;

export function buildMemoriesRecoveryPageCopy(input: { eventTitle: string }) {
	return {
		title: `Recuperar recuerdos · ${input.eventTitle} | Celebra-me`,
		description: `Recupere de forma segura los recuerdos que compartió para ${input.eventTitle}.`,
		heading: 'Vuelva a ver sus recuerdos',
		body: 'Escriba el código que recibió después de su primera subida.',
		backLabel: 'Volver a compartir recuerdos',
		organizerLabel: 'Acceso del organizador',
		robots: 'noindex',
	} as const;
}

export function buildMemoriesWindowCopy(input: {
	windowState: MemoriesWindowState;
	timeZone: string;
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
}): string | null {
	switch (input.windowState) {
		case 'before':
			return `La carga de recuerdos abre el ${formatMemoriesDateTime(input.uploadStartsAt, input.timeZone)}.`;
		case 'closed':
			return `La ventana para subir recuerdos cerró el ${formatMemoriesDateTime(input.uploadEndsAt, input.timeZone)}. Puede ver y recuperar lo que compartió hasta el ${formatMemoriesDate(input.retentionEndsAt, input.timeZone)}.`;
		case 'expired':
			return 'Los recuerdos de este evento ya no están disponibles.';
		case 'disabled':
			return 'La carga de recuerdos no está disponible en este momento.';
		default:
			return null;
	}
}

export const memoriesCaptureCopy = {
	chooseFile: 'Elegir fotos y videos',
	chooseFileTitle: 'Comparta sus recuerdos',
	chooseFileBody: 'Puede elegir varias fotos y videos a la vez.',
	addMore: 'Agregar más',
	reviewTitle: (count: number) =>
		count === 1 ? 'Revise su recuerdo' : `Revise sus ${count} recuerdos`,
	reviewBody: 'Toque la × para quitar alguno antes de subir.',
	removeFile: (name: string) => `Quitar ${name}`,
	invalidTile: {
		unsupported_type: 'Formato no admitido',
		file_too_large: 'Archivo muy pesado',
		video_too_large: 'Video muy pesado',
	} as Record<string, string>,
	invalidTileFallback: 'No se puede subir',
	invalidSummary: (count: number) =>
		count === 1
			? 'Un archivo no se puede subir; quítelo o elija otro.'
			: `${count} archivos no se pueden subir; quítelos o elija otros.`,
	confirmUploadCount: (count: number) =>
		count === 1 ? 'Subir 1 recuerdo' : `Subir ${count} recuerdos`,
	captionLabelAll: 'Descripción para estos recuerdos (opcional)',
	captionToggle: 'Agregar una descripción (opcional)',
	quotaRemaining: (remaining: number, limit: number) =>
		`Le quedan ${remaining} de ${limit} archivos`,
	quotaVideosRemaining: (remaining: number) =>
		remaining === 1 ? '1 video disponible' : `${remaining} videos disponibles`,
	progressTitle: (done: number, total: number) => `Subiendo ${done} de ${total}`,
	keepOpen: 'Mantenga esta página abierta hasta que terminen.',
	offline: 'Sin conexión. Las subidas seguirán solas cuando vuelva la señal.',
	statusWaiting: 'En espera',
	statusOptimizing: 'Optimizando…',
	statusPreparing: 'Preparando…',
	statusConfirming: 'Confirmando…',
	statusDone: 'Guardado',
	cancelPending: 'Cancelar las pendientes',
	successCount: (count: number) =>
		count === 1
			? 'Se guardó. Gracias por compartir este momento.'
			: `Se guardaron ${count} recuerdos. Gracias por compartir estos momentos.`,
	thanks: (name: string) => `¡Gracias, ${name}!`,
	failedCount: (count: number) =>
		count === 1 ? 'Un archivo no se subió.' : `${count} archivos no se subieron.`,
	noneSaved: 'No se pudo guardar ningún recuerdo',
	addToCalendar: 'Agregar a mi calendario',
	calendarTitle: (eventTitle: string) => `Compartir recuerdos · ${eventTitle}`,
	memoryOptions: 'Opciones del recuerdo',
	closeOptions: 'Cerrar',
	deleteTitle: '¿Eliminar este recuerdo?',
	deleteBody: 'Los anfitriones ya no podrán verlo. El espacio se libera al día siguiente.',
	deleteFailed: 'No se pudo eliminar. Intente de nuevo.',
	captionFailed: 'No se pudo guardar la descripción. Intente de nuevo.',
	welcomeNameHelp: 'Así sabrán quién compartió cada recuerdo.',
	eventFullTitle: 'El álbum está lleno',
	eventFullBody:
		'Los anfitriones recibieron todos los recuerdos que caben. Gracias por querer compartir.',
	captionPlaceholder: 'Por ejemplo: Baile con la familia',
	cancelSelection: 'Cancelar',
	detailsLabel: 'Ver formatos, límites y privacidad',
	privacyHint:
		'Usted podrá ver sus recuerdos y solo la persona organizadora podrá verlos y descargarlos todos. Los formatos que no se puedan optimizar pueden conservar metadatos del teléfono.',
	displayNameLabel: '¿Cómo se llama?',
	continueLabel: 'Continuar',
	saveLabel: 'Guardar',
	profileSectionLabel: 'Su perfil de recuerdos',
	onboardingSectionLabel: 'Iniciar sesión de recuerdos',
	uploadAnother: 'Subir más',
	chooseOtherFiles: 'Elegir otros archivos',
	viewMemories: 'Ver mis recuerdos',
	retry: 'Intentar de nuevo',
	completionRejected: 'No pudimos validar este archivo y no se guardó. Intente con otro archivo.',
	unsupportedType: 'Este tipo de archivo no está permitido.',
	fileTooLarge: 'El archivo supera el tamaño permitido. Intente con otro archivo.',
	videoTooLarge:
		'El video pesa más de lo permitido. Intente con uno más corto o grabado en menor calidad.',
	videoTooLong: buildMemoriesVideoTooLongCopy(),
	videoUnreadable: 'No se pudo leer el video. Intente con otro archivo.',
	windowClosed: 'La ventana para subir recuerdos no está abierta.',
	rateLimited: 'Hay demasiadas solicitudes. Espere un minuto e intente de nuevo.',
	uploadsInProgress:
		'Todavía hay subidas suyas en proceso. Espere unos minutos e intente de nuevo.',
	quotaReached: 'Esta sesión o el evento ya no tienen espacio para otro archivo.',
	sessionFilesReached:
		'Ya alcanzó el máximo de archivos por invitado. Si elimina alguno, el espacio se libera al día siguiente.',
	sessionVideosReached: 'Ya alcanzó el máximo de videos por invitado. Todavía puede subir fotos.',
	sessionBytesReached:
		'Este archivo ya no cabe en su espacio como invitado. Intente con uno más pequeño.',
	eventFull:
		'El espacio de recuerdos de este evento está lleno. Avise a quien organiza el evento.',
	sessionLost:
		'Su sesión ya no está activa. Recargue la página; si no aparecen sus recuerdos, use «Recuperar mis recuerdos».',
	signFailed: 'No se pudo preparar la subida. Intente de nuevo.',
	putFailed: 'No pudimos subir el archivo. Revise su conexión e intente de nuevo.',
	networkFailed: 'No tiene conexión. Intente de nuevo cuando vuelva a estar en línea.',
	uploadExpired:
		'La subida anterior ya no es válida. Toque «Intentar de nuevo» para subir el archivo otra vez.',
	unavailable: 'La carga de recuerdos no está disponible en este momento.',
	recoveryCodeTitle: 'Guarde su código',
	recoveryCodeHint:
		'Lo necesitará para ver o eliminar sus recuerdos si cambia de teléfono o de navegador. No lo comparta.',
	recoveryCodeManualHint: 'También puede tomar una captura de pantalla.',
	copyRecoveryCode: 'Copiar código',
	recoveryCodeCopied: 'Código copiado',
	captionSaveFailed:
		'El recuerdo se guardó, pero la descripción no. Puede reintentar sólo la descripción.',
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
	noMemories: 'Todavía no ha compartido recuerdos desde este dispositivo.',
} as const;
