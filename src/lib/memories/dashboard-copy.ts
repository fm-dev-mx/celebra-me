/**
 * Spanish copy and number formatting for the memories dashboards (super-admin
 * console and host summary). Guest-facing copy stays in `copy.ts`.
 */

import type { MemoriesWindowState } from './contract/catalog';
import { type MemoriesEntitlement } from './contract/limits';
import {
	BINARY_MB,
	DECIMAL_GB,
	formatPlatformStorage as formatMemoriesStorage,
} from '@/lib/platform/dashboard-copy';
import {
	platformMeterStep as memoriesMeterStep,
	platformUsageLevel as memoriesUsageLevel,
	platformUsageRatio as memoriesUsageRatio,
} from '@/lib/platform/contract/meters';
import { formatMemoriesDate } from './copy';

export { formatMemoriesStorage, memoriesMeterStep, memoriesUsageLevel, memoriesUsageRatio };

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

/** `YYYY-MM-DD` event date as a long Spanish date; the raw value if unreadable. */
export function formatMemoriesEventDate(eventDate: string): string {
	const instant = Date.parse(`${eventDate}T00:00:00Z`);
	if (Number.isNaN(instant)) return eventDate;
	return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(
		new Date(instant),
	);
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

export interface MemoriesLoadErrorGuide {
	title: string;
	steps: readonly string[];
}

/**
 * Turns a failed admin list request into a cause and the steps that resolve it.
 * Only the stable status/code pair is read; provider details never reach the browser.
 */
export function describeMemoriesLoadError(failure: {
	status: number | null;
	code?: string;
}): MemoriesLoadErrorGuide {
	const { status, code } = failure;
	if (code === 'schema_out_of_date') {
		return {
			title: 'La base de datos de este entorno no tiene las migraciones más recientes.',
			steps: [
				'Local: ejecute «pnpm db:migrate -- --target local».',
				'Preview: ejecute «pnpm db:migrate -- --target preview».',
				'Producción: el responsable aplica la migración con «pnpm prod:apply».',
				'Recargue esta página al terminar.',
			],
		};
	}
	if (status === 401 || code === 'unauthorized') {
		return {
			title: 'Su sesión expiró.',
			steps: ['Cierre sesión, vuelva a iniciarla y regrese a esta página.'],
		};
	}
	if (status === 403 || code === 'forbidden') {
		return {
			title: 'Esta sección requiere una cuenta de superadministrador con verificación en dos pasos.',
			steps: [
				'Inicie sesión con una cuenta de superadministrador.',
				'Complete la verificación en dos pasos o use un dispositivo de confianza.',
			],
		};
	}
	if (status === 429 || code === 'rate_limited') {
		return {
			title: 'Se hicieron demasiadas consultas seguidas.',
			steps: ['Espere un minuto y use «Reintentar».'],
		};
	}
	if (status === 408 || code === 'timeout') {
		return {
			title: 'El servidor tardó demasiado en responder.',
			steps: [
				'Confirme que Supabase y Cloudflare estén disponibles para este entorno.',
				'Use «Reintentar».',
			],
		};
	}
	if (code === 'upstream_error') {
		return {
			title: 'El servicio de autenticación rechazó la solicitud.',
			steps: ['Cierre sesión, vuelva a iniciarla y regrese a esta página.'],
		};
	}
	if (code === 'service_unavailable') {
		return {
			title: 'Un servicio externo no respondió.',
			steps: [
				'Local: confirme que Supabase esté en marcha («pnpm db:start»).',
				'Use «Reintentar» en unos segundos.',
			],
		};
	}
	return {
		title: 'El servidor respondió con un error inesperado.',
		steps: [
			'Confirme que el servidor de desarrollo y Supabase estén en marcha («pnpm db:start»).',
			'Revise la terminal de «pnpm dev» (o los registros de Vercel) y busque «[rsvp]» para ver la causa.',
			'Use «Reintentar» después de corregirla.',
		],
	};
}

export const memoriesAdminCopy = {
	activate: 'Activar evento',
	empty: 'Todavía no hay espacios de recuerdos. Use «Activar evento» para crear el primero.',
	loadError: 'No se pudieron cargar los espacios de recuerdos.',
	retry: 'Reintentar',
	expiredSummary: (count: number) => `Vencidos (${count})`,
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
	expectedParticipation: (guests: number, expected: number) =>
		`${guests.toLocaleString('es-MX')} de ${expected.toLocaleString('es-MX')} invitados esperados`,
	hostDownloaded: (date: string) => `El anfitrión descargó por última vez: ${date}`,
	hostNeverDownloaded: 'El anfitrión aún no descarga',
	deletionSoon: (days: number) => `Se borra en ${pluralize(days, 'día', 'días')} · sin descargar`,
	deletionNotice: (count: number) =>
		count === 1
			? '1 espacio se borra pronto y su anfitrión aún no descarga. Conviene avisarle.'
			: `${count} espacios se borran pronto y sus anfitriones aún no descargan. Conviene avisarles.`,
	noteLabel: 'Nota interna',
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
	pickerNoDate: 'Fecha sin definir',
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
	eventOn: (title: string, date: string) => `${title} · ${date}`,
	scheduleAroundEvent: (before: number, after: number) =>
		`Abre ${pluralize(Math.abs(before), 'día', 'días')} ${before >= 0 ? 'antes' : 'después'} del evento y cierra ${pluralize(Math.abs(after), 'día', 'días')} ${after >= 0 ? 'después' : 'antes'}.`,
	retentionSpan: (days: number, max: number) =>
		`Los archivos se conservan ${pluralize(days, 'día', 'días')} desde la apertura (máximo ${max}).`,
	scheduleIssue: {
		missing: 'Indique fecha y hora.',
		ends_before_start: 'El cierre debe ser posterior a la apertura.',
		retention_before_end: 'La retención no puede terminar antes del cierre.',
		retention_too_long: (max: number) =>
			`La retención no puede superar ${max} días desde la apertura.`,
	},
	expectedGuests: 'Invitados esperados (opcional)',
	expectedGuestsHelp: 'Sirve para estimar si el cupo alcanza; no limita las subidas.',
	fileLimits: (photo: string, seconds: number, video: string) =>
		`Cada foto: hasta ${photo} · cada video: hasta ${seconds} s y ${video}. Iguales para todos los eventos.`,
	noteSection: 'Nota interna',
	note: 'Nota',
	noteHelp: 'Solo visible para administración. Ejemplo: referencia de pago o acuerdos.',
	noteCounter: (length: number, max: number) => `${length} / ${max}`,
	commitment: (projected: string, limit: string) =>
		`Con este espacio quedarían comprometidos ${projected} de los ${limit} gratuitos de Cloudflare.`,
	commitmentOver:
		'Supera el almacenamiento gratuito: si los espacios se llenan, Cloudflare cobraría el excedente.',
	commitmentAcknowledge: 'Entiendo que puede generar cargos de almacenamiento',
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
	perExpectedGuest: (expected: number) =>
		`Por cada uno de los ${expected.toLocaleString('es-MX')} invitados esperados`,
	perExpectedGuestValue: (files: number, storage: string) =>
		`≈ ${files.toLocaleString('es-MX')} archivos · ${storage}`,
	typicalFit: (photos: number, videos: number) =>
		`Invitados que caben con un uso típico (${photos} fotos + ${videos} video)`,
	shortForExpected: (supported: number, expected: number) =>
		`El cupo alcanza para unos ${supported.toLocaleString('es-MX')} invitados con uso típico y usted espera ${expected.toLocaleString('es-MX')}. Si casi todos participan, conviene ampliar el cupo o reducir los videos por invitado.`,
	disclaimer: (photo: string, video: string, seconds: number, maxVideo: string) =>
		`Estimación con fotos de ${photo} y videos de ${video} (unos 30 s). No son mediciones reales: cada video puede durar hasta ${seconds} s y pesar hasta ${maxVideo}.`,
} as const;

export const memoriesHostCopy = {
	eyebrow: 'Resumen',
	statusTitle: 'Estado',
	photos: 'Fotos',
	videos: 'Videos',
	guests: 'Invitados',
	spaceUsed: 'Espacio usado',
	spaceUsedLabel: (percent: number) => `${percent} % del espacio usado`,
	nearFull: (remaining: number) =>
		`Queda ${remaining} % del espacio. Le recomendamos descargar lo recibido para tener una copia.`,
	full: 'El álbum está lleno y sus invitados ya no pueden subir archivos. Todo lo recibido está a salvo; si necesita más espacio, escríbanos.',
	timelineLabel: 'Fechas del espacio de recuerdos',
	opens: (past: boolean) => (past ? 'Abrió' : 'Abre'),
	closes: (past: boolean) => (past ? 'Cerró' : 'Cierra'),
	deletes: 'Se borra',
	lastUpload: (date: string) => `Última subida: ${date}`,
	noUploads: 'Aún no hay subidas.',
	loadError: 'No se pudo cargar el resumen.',
	retry: 'Reintentar',
	deletionCountdown: (days: number) =>
		days === 1
			? 'Sus recuerdos se eliminan mañana. Descárguelos ahora.'
			: `Sus recuerdos se eliminan en ${days} días. Descárguelos ahora.`,
} as const;

export const memoriesShareCopy = {
	title: 'Galería para sus invitados',
	offBody:
		'Comparta un enlace para que sus invitados vean las fotos y videos disponibles. Lo que usted oculte no aparece.',
	onBody: 'Cualquier persona con este enlace puede ver la galería hasta que se borren los recuerdos.',
	enable: 'Compartir galería',
	copy: 'Copiar enlace',
	copied: 'Enlace copiado.',
	rotate: 'Generar enlace nuevo',
	rotateHint: 'El enlace anterior dejará de funcionar.',
	disable: 'Dejar de compartir',
	open: 'Abrir galería',
	error: 'No se pudo cambiar el enlace. Intente de nuevo.',
	notConfigured: 'La galería compartida todavía no está disponible. Escríbanos para activarla.',
} as const;

export const memoriesQrCopy = {
	title: 'QR para sus invitados',
	alt: 'Código QR de la página de recuerdos',
	viewAndPrint: 'Ver e imprimir',
	copyUrl: 'Copiar enlace',
	copied: 'Enlace copiado.',
	downloadQr: 'Descargar QR',
	print: 'Imprimir tarjeta',
	modalSubtitle: 'Imprímalo y colóquelo donde sus invitados lo vean.',
	placementTitle: 'Cómo colocarlo',
	placementSteps: [
		'Imprima la tarjeta en tamaño media carta o mayor; el código debe medir al menos 4 cm.',
		'Colóquela donde la gente espera: en cada mesa, en la entrada y junto a la pista.',
		'Pruébela antes del evento con dos teléfonos distintos, con la luz del salón.',
		'Pida que lo anuncien el maestro de ceremonias o el DJ después del primer baile.',
	],
	printPreviewTitle: 'Tarjeta para imprimir',
	printEyebrow: 'Comparta sus fotos',
	printBody:
		'Abra la cámara de su teléfono, apunte al código y suba las fotos y videos que tomó hoy.',
	printNoApp: 'No necesita descargar ninguna aplicación.',
	close: 'Cerrar',
} as const;

export { DECIMAL_GB as MEMORIES_DECIMAL_GB, BINARY_MB as MEMORIES_BINARY_MB };
