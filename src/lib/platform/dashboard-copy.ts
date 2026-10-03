/**
 * Spanish copy and number formatting for the platform usage console
 * (super-admin). UI strings are Spanish; identifiers stay English. Label
 * resolution lives here so the client only paints.
 */

import type {
	PlatformMetric,
	PlatformProjection,
	PlatformProviderId,
	PlatformScope,
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

export function formatPlatformCount(value: number): string {
	return new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(
		value,
	);
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

export const platformCopy = {
	title: 'Consumo de la plataforma',
	intro: 'Límites y costos de los proveedores de infraestructura. Las cuotas compartidas se marcan como de la cuenta o del proyecto, nunca como de un entorno. Superar un límite solo genera esta advertencia: las subidas y las ventas no se bloquean.',
	loading: 'Consultando proveedores…',
	loadError: 'No se pudo consultar el consumo de la plataforma.',
	approx: (time: string) => `Aproximado · actualizado ${formatPlatformTime(time)}`,
	noData: 'Sin datos',
	noQuota: 'sin cuota verificada',
	unconfigured: 'Sin configurar: faltan credenciales de solo lectura para este proveedor.',
	unavailable:
		'No disponible: el proveedor no respondió. El resto de las tarjetas sigue operando.',
	projectionExhausts: (time: string) =>
		`Al ritmo actual, la cuota se agotaría el ${formatPlatformTime(time)}.`,
	projectionSafe: 'Al ritmo actual, la cuota no se agota antes del próximo reinicio.',
	overage: (amount: string) => `Excedente estimado: ${amount}.`,
	spend: (amount: string) => `Costo del periodo: ${amount}.`,
	link: 'Ver el panel del proveedor',
	committedHint:
		'El almacenamiento comprometido por espacios se consulta en «Espacios de recuerdos».',
} as const;

export const platformProviderTitle: Record<PlatformProviderId, string> = {
	cloudflare: 'Cloudflare · cuenta compartida',
	supabase: 'Supabase · un proyecto por entorno',
	vercel: 'Vercel · proyecto (plan Hobby)',
	cloudinary: 'Cloudinary · cuenta compartida',
};

export const platformProviderLink: Record<PlatformProviderId, string> = {
	cloudflare: 'https://dash.cloudflare.com/',
	supabase: 'https://supabase.com/dashboard',
	vercel: 'https://vercel.com/dashboard',
	cloudinary: 'https://console.cloudinary.com/',
};

/** Static cost notes for the free plans in force (documented 2026-10-02). */
export const platformProviderCostNote: Record<PlatformProviderId, string> = {
	cloudflare: 'Costo del periodo: $0 (plan gratuito). Solo se factura si se supera una cuota.',
	supabase:
		'Costo del periodo: $0 (plan gratuito). No hay excedentes facturables: el límite es duro.',
	vercel: 'Costo del periodo: $0 (plan Hobby). No hay precios on-demand en este plan.',
	cloudinary: 'Costo del periodo: $0 (plan gratuito). Sin excedentes facturables verificados.',
};

export const platformScopeLabel: Record<PlatformScope, string> = {
	account: 'de la cuenta, no de un entorno',
	project: 'del proyecto, no de un entorno',
	preview: 'entorno Preview',
	production: 'entorno Producción',
};

export const platformWindowLabel: Record<PlatformWindow, string> = {
	dayUtc: 'día UTC · reinicia 00:00 UTC (17:00 en Mazatlán)',
	monthUtc: 'mes calendario UTC',
	billingCycle: 'ciclo de facturación',
	creditCycle: 'ciclo de créditos del proveedor',
	snapshot: 'instantánea reciente',
};

const METRIC_LABELS: Record<string, string | ((resource: string) => string)> = {
	cfR2StorageBucket: (resource) => `Almacenamiento R2 · bucket «${resource}»`,
	cfR2StorageAccount: 'Almacenamiento R2 · total de la cuenta',
	cfR2ClassA: 'Operaciones R2 Clase A · total de la cuenta',
	cfR2ClassB: 'Operaciones R2 Clase B · total de la cuenta',
	cfWorkersRequests: 'Peticiones de Workers · total de la cuenta',
	cfDurableObjectsRequests: 'Peticiones de Durable Objects · total de la cuenta',
	sbDatabase: 'Base de datos / disco',
	clCredits: 'Créditos usados',
	clStorage: 'Almacenamiento',
	clBandwidth: 'Ancho de banda del periodo',
	clRequests: 'Peticiones del periodo',
	clResources: 'Recursos almacenados',
};

export function platformMetricLabel(metric: PlatformMetric): string {
	const label = METRIC_LABELS[metric.id] ?? metric.id;
	return typeof label === 'function' ? label(metric.resource ?? '') : label;
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
		metric.id === 'clStorage' ||
		metric.id === 'clBandwidth'
		? formatPlatformStorage
		: formatPlatformCount;
}
