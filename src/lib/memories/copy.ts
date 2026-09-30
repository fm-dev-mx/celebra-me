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

export function buildMemoriesUploadSummaryCopy(maxSessionVideos: number): string {
	return `Fotos hasta ${formatMiB(MEMORIES_MAX_IMAGE_BYTES)} MiB. Videos hasta ${MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos y ${formatMiB(MEMORIES_MAX_VIDEO_BYTES)} MiB. Máximo ${maxSessionVideos} videos.`;
}

export function buildMemoriesVideoTooLongCopy(): string {
	return `El video no puede durar más de ${MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos.`;
}

export function buildMemoriesPageCopy(input: { eventTitle: string }) {
	return {
		title: `Recuerdos · ${input.eventTitle} | Celebra-me`,
		description: `Espacio temporal para subir fotos y videos de ${input.eventTitle}.`,
		subtitle: `Recuerdos · ${input.eventTitle}`,
		heading: 'Comparta sus fotos y videos',
		body: 'Suba una foto o un video de la celebración de forma rápida y segura.',
		recoveryCtaLabel: 'Recuperar mis recuerdos',
		organizerCtaLabel: 'Acceso del organizador',
		footer: 'Celebra-me • Recuerdos digitales',
		robots: 'noindex',
	} as const;
}

export const memoriesRecoveryFormCopy = {
	inputLabel: 'Código de recuperación',
	submit: 'Recuperar recuerdos',
	submitting: 'Recuperando…',
	failed: 'No pudimos recuperar sus recuerdos. Revise el código e intente de nuevo.',
} as const;

export function buildMemoriesRecoveryPageCopy(input: { eventTitle: string }) {
	return {
		title: `Recuperar recuerdos · ${input.eventTitle} | Celebra-me`,
		description: `Recupere de forma segura los recuerdos que compartió para ${input.eventTitle}.`,
		heading: 'Recupere sus recuerdos',
		body: 'Escriba el código que guardó al comenzar.',
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
	chooseFile: 'Elija una foto o un video',
	chooseFileTitle: 'Comparta un recuerdo',
	chooseFileBody: 'Toque para elegir una foto o un video desde su dispositivo.',
	selectedFileTitle: 'Revise su recuerdo antes de subirlo',
	selectedFileFallback: 'Archivo seleccionado',
	selectedFileSize: 'Tamaño original',
	selectedPreviewAlt: 'Vista previa del recuerdo seleccionado',
	captionLabel: 'Descripción opcional',
	captionPlaceholder: 'Por ejemplo: Baile con la familia',
	confirmUpload: 'Subir recuerdo',
	changeFile: 'Elegir otro archivo',
	cancelSelection: 'Cancelar',
	stepOne: 'Paso 1 de 2',
	stepTwo: 'Paso 2 de 2',
	quotaLabel: 'Cupo disponible',
	detailsLabel: 'Ver formatos, límites y privacidad',
	privacyHint:
		'Usted podrá ver sus recuerdos y solo la persona organizadora podrá verlos y descargarlos todos. Los formatos que no se puedan optimizar pueden conservar metadatos del teléfono.',
	displayNameLabel: 'Su nombre o apodo',
	continueLabel: 'Continuar',
	saveLabel: 'Guardar',
	profileSectionLabel: 'Su perfil de recuerdos',
	onboardingSectionLabel: 'Iniciar sesión de recuerdos',
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
	videoTooLong: buildMemoriesVideoTooLongCopy(),
	videoUnreadable: 'No se pudo leer el video. Intente con otro archivo.',
	windowClosed: 'La ventana para subir recuerdos no está abierta.',
	rateLimited: 'Hay demasiadas solicitudes. Intente de nuevo en un momento.',
	quotaReached: 'Esta sesión o el evento ya no tienen espacio para otro archivo.',
	signFailed: 'No se pudo preparar la subida. Intente de nuevo.',
	putFailed: 'No pudimos subir el archivo. Revise su conexión e intente de nuevo.',
	networkFailed: 'No tiene conexión. Intente de nuevo cuando vuelva a estar en línea.',
	unavailable: 'La carga de recuerdos no está disponible en este momento.',
	recoveryCodeTitle: 'Guarde su código de recuperación',
	recoveryCodeHint:
		'Permite recuperar sus recuerdos en otro dispositivo. No se envía al servidor en texto visible ni debe compartirse públicamente.',
	recoveryCodeManualHint: 'También puede seleccionar el código y copiarlo manualmente.',
	copyRecoveryCode: 'Copiar código',
	recoveryCodeCopied: 'Código copiado',
	captionSaveFailed:
		'El recuerdo se guardó, pero la descripción no. Puede reintentar sólo la descripción.',
	retryCaption: 'Reintentar descripción',
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

export type MemoriesCaptureCopy = typeof memoriesCaptureCopy;
