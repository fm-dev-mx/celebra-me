/**
 * Spanish copy and number formatting for the platform usage console
 * (super-admin). UI strings are Spanish; identifiers stay English. Label
 * resolution lives here so the client only paints.
 */

import { SUPABASE_FREE_TIER } from './contract/limits';
import type { PlatformUsageLevel } from './contract/meters';
import type {
	PlatformEnvironmentId,
	PlatformMetric,
	PlatformProjection,
	PlatformProviderId,
	PlatformWindow,
} from './contract/types';

export const DECIMAL_GB = 1_000_000_000;
export const BINARY_MB = 1024 * 1024;

export function formatPlatformStorage(bytes: number): string {
	if (bytes >= DECIMAL_GB) {
		const gigabytes = bytes / DECIMAL_GB;
		return `${gigabytes.toLocaleString('es-MX', { maximumFractionDigits: gigabytes < 10 ? 1 : 0 })} GB`;
	}
	if (bytes >= BINARY_MB) return `${Math.round(bytes / BINARY_MB).toLocaleString('es-MX')} MB`;
	if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-MX')} KB`;
	return '0 MB';
}

const DECIMAL_MB = 1_000_000;

function formatOneDecimal(value: number): string {
	return value.toLocaleString('es-MX', { maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0 });
}

/**
 * Platform quotas are published in decimal units (500 MB, 10 GB), so the
 * console compares and prints them in decimal units too: 500_000_000 bytes
 * reads as «500 MB», not as the binary 477 MB.
 */
export function formatPlatformBytes(bytes: number): string {
	if (bytes >= DECIMAL_GB) return `${formatOneDecimal(bytes / DECIMAL_GB)} GB`;
	if (bytes >= DECIMAL_MB) return `${formatOneDecimal(bytes / DECIMAL_MB)} MB`;
	if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1000)).toLocaleString('es-MX')} KB`;
	return '0 MB';
}

/** Short counts: 950, 1.9k, 12k, 1.2 M. */
export function formatPlatformCount(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) return `${formatOneDecimal(value / 1_000_000)} M`;
	if (abs >= 1000) return `${formatOneDecimal(value / 1000)}k`;
	return Math.round(value).toLocaleString('es-MX');
}

export function formatPlatformPercent(ratio: number): string {
	const percent = ratio * 100;
	if (percent > 0 && percent < 1) return '<1 %';
	return `${Math.round(percent).toLocaleString('es-MX')} %`;
}

export function formatPlatformMoney(usd: number): string {
	return `${usd.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

/** Freshness stamp and projection times read in the business time zone. */
export function formatPlatformTime(iso: string): string {
	return new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: 'America/Mazatlan',
	}).format(new Date(iso));
}

/** «hace 5 min», «hace 2 h»; «hace un momento» under a minute or for future stamps. */
export function formatPlatformAge(iso: string, now: Date): string {
	const elapsedMs = now.getTime() - new Date(iso).getTime();
	if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return 'hace un momento';
	const minutes = Math.floor(elapsedMs / 60_000);
	if (minutes < 60) return `hace ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `hace ${hours} h`;
	const days = Math.floor(hours / 24);
	return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

export const platformCopy = {
	title: 'Consumo de la plataforma',
	intro: 'Superar un límite solo genera un aviso en esta página: las subidas y las ventas no se bloquean.',
	loading: 'Consultando a los proveedores…',
	loadError:
		'No se pudo consultar el consumo de la plataforma. Recarga la página en unos minutos.',
	updated: (age: string, time: string) => `Actualizado ${age} · ${time} (hora de Mazatlán)`,
	notUpdated: 'Sin lecturas recientes de los proveedores.',
	noData: 'Sin datos',
	pendingConfig: 'Pendiente: completa la configuración indicada arriba.',
	noQuota: 'Sin cuota verificada',
	ofLimit: (limit: string) => `de ${limit}`,
	unconfigured: 'Este bloque mostrará datos en cuanto se complete la configuración de abajo.',
	unavailable:
		'El proveedor no respondió. El resto del panel sigue funcionando; vuelve a intentarlo en unos minutos.',
	projectionExhausts: (time: string) =>
		`Al ritmo actual, se agotaría el ${formatPlatformTime(time)}`,
	projectionSafe: 'Al ritmo actual, alcanza hasta el próximo reinicio',
	overage: (amount: string) => `Excedente estimado: ${amount}.`,
	spend: (amount: string) => `Costo del periodo: ${amount}.`,
	link: (provider: string) => `Abrir el panel de ${provider}`,
	committedHint:
		'El almacenamiento comprometido por cada espacio se consulta en «Espacios de recuerdos».',
} as const;

export type PlatformOverallLevel = 'ok' | 'attention' | 'warning' | 'critical';

export const platformSummaryCopy = {
	heading: 'Estado general',
	title: {
		ok: 'Todo en orden',
		attention: 'Faltan datos por leer',
		warning: 'Hay cuotas por revisar',
		critical: 'Hay cuotas críticas',
	} satisfies Record<PlatformOverallLevel, string>,
	detail: {
		ok: 'Ninguna cuota supera el 70 % de su límite.',
		attention:
			'Las cuotas visibles están por debajo del 70 %, pero hay bloques sin datos. Revisa los avisos de cada proveedor.',
		warning: 'Una o más cuotas superan el 70 % de su límite.',
		critical:
			'Una o más cuotas superan el 90 % de su límite. Revísalas antes de que se agoten.',
	} satisfies Record<PlatformOverallLevel, string>,
	critical: (count: number) => `${plural(count, 'crítica', 'críticas')} (≥ 90 %)`,
	warning: (count: number) => `${count} en aviso (≥ 70 %)`,
	healthy: (count: number) => plural(count, 'cuota en orden', 'cuotas en orden'),
	missing: (count: number) => plural(count, 'dato por configurar', 'datos por configurar'),
	unavailable: (count: number) =>
		plural(count, 'proveedor sin respuesta', 'proveedores sin respuesta'),
} as const;

/** Meter badge; normal meters carry no badge. */
export const platformLevelLabel: Record<PlatformUsageLevel, string | null> = {
	normal: null,
	warning: 'Aviso',
	critical: 'Crítico',
};

export const platformProviderName: Record<PlatformProviderId, string> = {
	cloudflare: 'Cloudflare',
	supabase: 'Supabase',
};

/** Plan line under each provider name; Cloudflare limits come from `CLOUDFLARE_PAID_PLAN`. */
export const platformProviderPlan: Record<PlatformProviderId, string> = {
	cloudflare: 'Workers Paid y R2 Paid · una cuenta para ambos entornos',
	supabase: 'Plan Free · un proyecto por entorno',
};

export const platformProviderNote: Record<PlatformProviderId, string> = {
	cloudflare:
		'Las cuotas incluidas se renuevan cada mes; si se superan, el excedente se cobra por uso.',
	supabase: `El límite del plan es el tamaño de la base de datos: ${formatPlatformBytes(SUPABASE_FREE_TIER.databaseBytes)} por proyecto; al superarlo, la base pasa a solo lectura. El disco es solo un dato informativo.`,
};

export const platformProviderLink: Record<PlatformProviderId, string> = {
	cloudflare: 'https://dash.cloudflare.com/',
	supabase: 'https://supabase.com/dashboard',
};

export const platformGroupCopy = {
	sharedTitle: 'Toda la cuenta',
	sharedHint: 'Cuotas compartidas por Producción y Preview.',
	environmentsTitle: 'Por entorno',
	cloudflareEnvironmentHint: 'El bucket R2 que declara cada entorno.',
	supabaseEnvironmentHint: 'Cada entorno tiene su propio proyecto y su propia base de datos.',
} as const;

export const platformEnvironmentLabel: Record<PlatformEnvironmentId, string> = {
	production: 'Producción',
	preview: 'Preview',
};

export const platformMissingStateLabel: Record<'absent' | 'invalid', string> = {
	absent: 'Falta configurar',
	invalid: 'Valor no válido',
};

export const platformMissingLinkLabel = 'Generar o revisar la credencial';

interface MissingInfo {
	description: string;
	setupUrl: string;
	/** Link text when the generic credential label does not fit. */
	linkLabel?: string;
}

/** Setup guidance per environment variable name (names are not secrets). */
const MISSING_INFO: Record<string, MissingInfo> = {
	MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN: {
		description:
			'Token de solo lectura de analítica de Cloudflare: cree un Account API Token (Manage account → Account API tokens, no asociado a un usuario) con permiso Account → Analytics: Read.',
		setupUrl:
			'https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=Celebra-me%20platform%20usage',
	},
	MEMORIES_CLOUDFLARE_ACCOUNT_ID: {
		description: 'Identificador de la cuenta de Cloudflare (32 caracteres hexadecimales).',
		setupUrl:
			'https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/',
	},
	MEMORIES_R2_BUCKET_NAME: {
		description:
			'Nombre del bucket R2 de recuerdos de este entorno: celebra-memories en Producción y celebra-memories-staging en Preview.',
		setupUrl: 'https://dash.cloudflare.com/?to=/:account/r2',
		linkLabel: 'Ver los buckets R2',
	},
	SUPABASE_MANAGEMENT_TOKEN: {
		description:
			'Token personal de solo lectura de la Management API de Supabase (permisos Usage Analytics: Read y Disk Config: Read).',
		setupUrl: 'https://supabase.com/dashboard/account/tokens',
	},
	SUPABASE_PROJECT_REF_PREVIEW: {
		description: 'Referencia del proyecto Supabase de Preview (ajustes del proyecto).',
		setupUrl: 'https://supabase.com/dashboard',
	},
	SUPABASE_PROJECT_REF_PRODUCTION: {
		description: 'Referencia del proyecto Supabase de Producción (ajustes del proyecto).',
		setupUrl: 'https://supabase.com/dashboard',
	},
};

/** Setup guidance for one variable name. */
export function platformMissingInfo(name: string): MissingInfo {
	return (
		MISSING_INFO[name] ?? {
			description: 'Configuración del panel de plataforma.',
			setupUrl: '',
		}
	);
}

/** Deployment serving the panel: Local shows both environments. */
export type PlatformDeployment = PlatformEnvironmentId | 'local';

const WORKER_NAME: Record<PlatformEnvironmentId, string> = {
	production: 'celebra-me',
	preview: 'celebra-me-preview',
};

export interface MissingDestination {
	text: string;
	/** Command that sets the value, when the deployment has one. */
	command: string | null;
}

/** Where a missing value goes for the deployment that reported it. */
export function platformMissingDestination(deployment: PlatformDeployment): MissingDestination {
	if (deployment === 'local') {
		return {
			text: 'Dónde: en tu archivo .env.local; después reinicia el servidor local.',
			command: null,
		};
	}
	const worker = WORKER_NAME[deployment];
	return {
		text: `Dónde: secreto del Worker «${worker}» (${platformEnvironmentLabel[deployment]}). Cárgalo con el comando de abajo o en Cloudflare → Workers y Pages → ${worker} → Configuración → Variables y secretos.`,
		command: `pnpm ops:cloudflare:${deployment}:secrets`,
	};
}

export const platformWindowLabel: Record<PlatformWindow, string> = {
	dayUtc: 'Hoy · se reinicia a las 17:00 (hora de Mazatlán)',
	monthUtc: 'Este mes · se reinicia el día 1 (UTC)',
	snapshot: 'Medición reciente',
};

const METRIC_LABELS: Record<string, string | ((resource: string) => string)> = {
	cfR2StorageBucket: (resource) =>
		resource ? `Almacenamiento R2 · ${resource}` : 'Almacenamiento R2 del entorno',
	cfR2StorageAccount: 'Almacenamiento R2 (todos los buckets)',
	cfR2ClassA: 'Operaciones R2 de escritura (Clase A)',
	cfR2ClassB: 'Operaciones R2 de lectura (Clase B)',
	cfWorkersRequests: 'Peticiones a Workers',
	cfDurableObjectsRequests: 'Peticiones a Durable Objects',
	sbDatabase: 'Tamaño de la base de datos',
	sbDisk: 'Disco (incluye WAL)',
};

/** Why a figure has no quota, shown instead of «Sin cuota verificada». */
const METRIC_NOTES: Record<string, string> = {
	sbDisk: 'Solo informativo, sin alertas: incluye WAL y archivos del sistema, así que no es el tamaño de la base que limita el plan.',
};

/** Why a figure is blank, shown instead of «Sin datos». */
const METRIC_EMPTY: Record<string, string> = {
	sbDatabase:
		'No se puede leer desde este despliegue: consúltalo en Supabase → Usage («Database Size»).',
};

export function platformMetricLabel(metric: PlatformMetric): string {
	const label = METRIC_LABELS[metric.id] ?? metric.id;
	return typeof label === 'function' ? label(metric.resource ?? '') : label;
}

export function platformMetricNote(metric: PlatformMetric): string | null {
	return METRIC_NOTES[metric.id] ?? null;
}

export function platformMetricEmpty(metric: PlatformMetric): string | null {
	return METRIC_EMPTY[metric.id] ?? null;
}

export function platformProjectionLabel(projection: PlatformProjection): string | null {
	if (projection.kind === 'exhaustsAt') return platformCopy.projectionExhausts(projection.at);
	if (projection.kind === 'safe') return platformCopy.projectionSafe;
	return null;
}

export function platformMetricFormat(metric: PlatformMetric): (value: number) => string {
	return metric.id === 'cfR2StorageBucket' ||
		metric.id === 'cfR2StorageAccount' ||
		metric.id === 'sbDatabase' ||
		metric.id === 'sbDisk'
		? formatPlatformBytes
		: formatPlatformCount;
}
