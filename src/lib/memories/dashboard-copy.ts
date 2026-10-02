/**
 * Spanish copy and number formatting for the memories dashboards (super-admin
 * console and host summary). Guest-facing copy stays in `copy.ts`.
 */

import type { MemoriesWindowState } from './contract/catalog';
import {
	CLOUDFLARE_USAGE_CRITICAL_RATIO,
	CLOUDFLARE_USAGE_WARNING_RATIO,
	type MemoriesEntitlement,
} from './contract/limits';
import { formatMemoriesDate } from './copy';

export const MEMORIES_WINDOW_LABEL: Record<MemoriesWindowState, string> = {
	before: 'Programado',
	open: 'Abierto',
	closed: 'Cerrado',
	expired: 'Vencido',
	disabled: 'Pausado',
};

export const MEMORIES_WINDOW_BADGE: Record<MemoriesWindowState, string> = {
	before: 'dashboard-badge--draft',
	open: 'dashboard-badge--active',
	closed: 'dashboard-badge--generated',
	expired: 'dashboard-badge--generated',
	disabled: 'dashboard-badge--expired',
};

/** Console order: what needs attention first, finished spaces last. */
export const MEMORIES_WINDOW_ORDER: Record<MemoriesWindowState, number> = {
	open: 0,
	before: 1,
	closed: 2,
	disabled: 3,
	expired: 4,
};

export const MEMORIES_ENTITLEMENT_LABEL: Record<MemoriesEntitlement, string> = {
	package: 'Incluido en paquete',
	addon: 'Complemento',
	courtesy: 'Cortesía',
};

const DECIMAL_GB = 1_000_000_000;
const BINARY_MB = 1024 * 1024;

export function formatMemoriesStorage(bytes: number): string {
	if (bytes >= DECIMAL_GB) {
		const gigabytes = bytes / DECIMAL_GB;
		return `${gigabytes.toLocaleString('es-MX', { maximumFractionDigits: gigabytes < 10 ? 1 : 0 })} GB`;
	}
	if (bytes >= BINARY_MB) return `${Math.round(bytes / BINARY_MB).toLocaleString('es-MX')} MB`;
	if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-MX')} KB`;
	return '0 MB';
}

export function formatMemoriesCount(value: number): string {
	return new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(
		value,
	);
}

export function memoriesUsageRatio(used: number, limit: number): number {
	return limit > 0 ? Math.max(0, used / limit) : 0;
}

/** Meter fill in 5 % steps, rendered by CSS (`[data-fill]`) instead of inline styles. */
export function memoriesMeterStep(percent: number): number {
	const clamped = Math.max(0, Math.min(100, percent));
	return clamped > 0 && clamped < 5 ? 5 : Math.round(clamped / 5) * 5;
}

export type MemoriesUsageLevel = 'normal' | 'warning' | 'critical';

export function memoriesUsageLevel(ratio: number): MemoriesUsageLevel {
	if (ratio >= CLOUDFLARE_USAGE_CRITICAL_RATIO) return 'critical';
	if (ratio >= CLOUDFLARE_USAGE_WARNING_RATIO) return 'warning';
	return 'normal';
}

export function pluralize(count: number, singular: string, plural: string): string {
	return `${count.toLocaleString('es-MX')} ${count === 1 ? singular : plural}`;
}

export function buildMemoriesHostStatusCopy(input: {
	windowState: MemoriesWindowState;
	timeZone: string;
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
}): string {
	const date = (iso: string) => formatMemoriesDate(iso, input.timeZone);
	switch (input.windowState) {
		case 'before':
			return `Sus invitados podrán compartir recuerdos a partir del ${date(input.uploadStartsAt)}.`;
		case 'open':
			return `Sus invitados pueden compartir recuerdos hasta el ${date(input.uploadEndsAt)}.`;
		case 'closed':
			return `La carga cerró. Descargue sus recuerdos antes del ${date(input.retentionEndsAt)}; después se eliminan.`;
		case 'disabled':
			return 'La carga está en pausa. Sus recuerdos se conservan; escríbanos si necesita reanudarla.';
		default:
			return 'El periodo de conservación terminó y los recuerdos ya no están disponibles.';
	}
}

export const memoriesAdminCopy = {
	activate: 'Activar evento',
	empty: 'Todavía no hay espacios de recuerdos. Use «Activar evento» para crear el primero.',
	loadError: 'No se pudieron cargar los espacios de recuerdos.',
	expiredSummary: (count: number) => `Vencidos (${count})`,
	platformTitle: 'Capacidad de Cloudflare (plan gratuito)',
	platformApprox: (time: string) => `Aproximado · actualizado ${time}`,
	platformUnconfigured:
		'Sin datos de Cloudflare: falta configurar el token de solo lectura. El almacenamiento se estima con los registros de la plataforma.',
	platformUnavailable:
		'Cloudflare no respondió. El almacenamiento se estima con los registros de la plataforma.',
	platformLoading: 'Consultando Cloudflare…',
	storage: 'Almacenamiento R2',
	storageEstimated: 'Almacenamiento registrado',
	classA: 'Escrituras R2 (mes)',
	classB: 'Lecturas R2 (mes)',
	workers: 'Solicitudes Workers (hoy)',
	durableObjects: 'Durable Objects (hoy)',
	committed: (committed: string, limit: string) =>
		`Comprometido por espacios vigentes: ${committed} de ${limit}.`,
	committedOver:
		'Los cupos de los espacios vigentes superan el almacenamiento gratuito. Reduzca un cupo o evite activar otro espacio hasta que uno cierre.',
	noData: 'Sin dato',
	copyUrl: 'Copiar enlace',
	copied: 'Enlace copiado.',
	downloadQr: 'Descargar QR',
	openPage: 'Abrir página',
	edit: 'Editar',
	pause: 'Pausar',
	resume: 'Reanudar',
	window: (opens: string, closes: string) => `Abre ${opens} · cierra ${closes}`,
	retention: (date: string) => `Se conserva hasta ${date}`,
	lastUpload: (date: string) => `Última subida: ${date}`,
	noUploads: 'Sin subidas todavía',
	inFlight: (count: number) => pluralize(count, 'en proceso', 'en proceso'),
	rejected: (count: number) => pluralize(count, 'rechazado', 'rechazados'),
	pauseTitle: 'Pausar espacio de recuerdos',
	pauseMessage: (title: string) =>
		`Los invitados de «${title}» no podrán subir archivos mientras esté en pausa. Nada se borra y el QR impreso seguirá funcionando al reanudar.`,
	resumeTitle: 'Reanudar espacio de recuerdos',
	resumeMessage: (title: string) =>
		`Los invitados de «${title}» podrán volver a subir archivos dentro de la ventana configurada.`,
	paused: 'Espacio en pausa.',
	resumed: 'Espacio reanudado.',
	toggleError: 'No se pudo cambiar el estado del espacio.',
	created: (url: string) => `Espacio activado. URL pública: ${url}`,
	updated: 'Espacio actualizado.',
} as const;

export const memoriesFormCopy = {
	createTitle: 'Activar recuerdos para un evento',
	editTitle: 'Editar espacio de recuerdos',
	pickerLabel: 'Buscar evento publicado',
	pickerPlaceholder: 'Nombre del evento',
	pickerEmpty: 'No hay eventos publicados pendientes de activar.',
	pickerNoMatch: 'Ningún evento coincide con la búsqueda.',
	showPast: (count: number) => `Mostrar eventos anteriores (${count})`,
	choose: 'Configurar',
	back: 'Elegir otro evento',
	windowSection: 'Ventana de carga',
	planSection: 'Plan y cupo',
	slug: 'Slug público',
	slugHelp: 'Esta URL se imprime en el QR y no puede cambiarse después.',
	timeZone: 'Zona horaria',
	uploadStarts: 'Apertura de carga',
	uploadEnds: 'Cierre de carga',
	retentionEnds: 'Fin de retención',
	retentionHelp: 'Hasta esta fecha los anfitriones pueden descargar; después se eliminan.',
	entitlement: 'Origen comercial',
	profile: 'Perfil de cupo',
	profileStandard: 'Estándar',
	profileExtended: 'Ampliado',
	profileCustom: 'Personalizado',
	customLimits: 'Límites personalizados',
	maxEventBytes: 'Almacenamiento del evento (GB)',
	maxEventObjects: 'Archivos del evento',
	maxSessionFiles: 'Archivos por invitado',
	maxSessionVideos: 'Videos por invitado',
	maxSessionBytes: 'Almacenamiento por invitado (MB)',
	limitsSummary: (input: {
		eventStorage: string;
		eventObjects: number;
		sessionFiles: number;
		sessionVideos: number;
		sessionStorage: string;
	}) =>
		`Hasta ${input.eventStorage} y ${input.eventObjects.toLocaleString('es-MX')} archivos; cada invitado sube hasta ${input.sessionFiles} archivos (${input.sessionVideos} videos, ${input.sessionStorage}).`,
	submitCreate: 'Activar espacio',
	submitEdit: 'Guardar cambios',
	saving: 'Guardando…',
	cancel: 'Cancelar',
	validationError: 'Revise los valores: la ventana, la retención o el slug no son válidos.',
	conflictError: 'El evento ya tiene recuerdos o el slug público está en uso.',
	saveError: 'No se pudo guardar el espacio de recuerdos.',
} as const;

export const memoriesCapacityCopy = {
	title: 'Capacidad estimada',
	photosOnly: 'Solo fotos',
	photosBoundByFiles: 'la detiene el límite de archivos, no el almacenamiento',
	videosOnly: 'Solo videos',
	videosAtMaxSize: (count: string, size: string) =>
		`${count} si todos pesan el máximo de ${size}`,
	mix: (photosPerVideo: number) => `Álbum mixto (${photosPerVideo} fotos por video)`,
	mixValue: (photos: string, videos: string) => `${photos} fotos + ${videos} videos`,
	guests: (photos: number, videos: number) =>
		`Invitados que caben si cada uno sube su máximo (${photos} fotos + ${videos} videos)`,
	disclaimer: (photo: string, video: string, seconds: number, maxVideo: string) =>
		`Estimación con fotos de ${photo} y videos de ${video} (unos 30 s). No son mediciones reales: cada video puede durar hasta ${seconds} s y pesar hasta ${maxVideo}.`,
} as const;

export const memoriesHostCopy = {
	eyebrow: 'Resumen',
	photos: 'Fotos',
	videos: 'Videos',
	guests: 'Invitados que compartieron',
	capacity: 'Espacio disponible',
	lastUpload: (date: string) => `Última subida: ${date}`,
	shareTitle: 'Enlace para sus invitados',
	downloadQr: 'Descargar QR',
	copyUrl: 'Copiar enlace',
	copied: 'Enlace copiado.',
	loadError: 'No se pudo cargar el resumen.',
} as const;

export { DECIMAL_GB as MEMORIES_DECIMAL_GB, BINARY_MB as MEMORIES_BINARY_MB };
