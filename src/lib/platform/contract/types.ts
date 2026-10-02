/**
 * Provider usage shapes for the super-admin platform console. Pure types and
 * data only: no imports, so contract, server and UI can share them.
 */

export type PlatformProviderId = 'cloudflare' | 'supabase' | 'vercel' | 'cloudinary';

/**
 * Whose quota a figure belongs to. Shared figures are labeled as account or
 * project, never as a single environment.
 */
export type PlatformScope = 'account' | 'project' | 'preview' | 'production';

/** Accumulation window of a `used` figure. */
export type PlatformWindow = 'dayUtc' | 'monthUtc' | 'billingCycle' | 'creditCycle' | 'snapshot';

export interface PlatformMeter {
	used: number | null;
	/** Quota the figure is compared against; null when no quota is verified. */
	limit: number | null;
}

export interface PlatformMetric {
	/** Stable identifier; the Spanish label lives in `platform/dashboard-copy.ts`. */
	id: string;
	/** Resource the figure belongs to (R2 bucket name) when several share an id. */
	resource?: string;
	meter: PlatformMeter;
	window: PlatformWindow;
	scope: PlatformScope;
	/** Estimated overage in USD when documented prices exist; null otherwise. */
	overageUsd: number | null;
	/** Constant-rate estimate for the "when" question. */
	projection: PlatformProjection;
}

/**
 * Constant-rate projection of quota exhaustion inside the current window.
 * `safe` means the observed rate does not exhaust the quota before the window
 * resets; `unknown` means no rate is computable (snapshot or zero elapsed).
 */
export type PlatformProjection =
	{ kind: 'exhaustsAt'; at: string } | { kind: 'safe' } | { kind: 'unknown' };

export interface PlatformProviderUsageOk {
	kind: 'ok';
	fetchedAt: string;
	metrics: PlatformMetric[];
	/** Period spend in USD when the provider exposes it; null = not available. */
	spendUsd: number | null;
}

export type PlatformProviderUsage =
	PlatformProviderUsageOk | { kind: 'unconfigured' } | { kind: 'unavailable' };

/** One entry per provider; a failing provider only blanks its own card. */
export type PlatformUsageReport = Record<PlatformProviderId, PlatformProviderUsage>;

export const PLATFORM_PROVIDER_IDS = [
	'cloudflare',
	'supabase',
	'vercel',
	'cloudinary',
] as const satisfies readonly PlatformProviderId[];
