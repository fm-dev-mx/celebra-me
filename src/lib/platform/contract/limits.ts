/**
 * Free-plan allowances, warning thresholds and documented overage prices for
 * the platform usage console. These quotas bound every project at once; they
 * are account- or project-wide, never per event.
 *
 * Sources (consulted 2026-10-02): Cloudflare R2 pricing (updated 2026-10-01),
 * Cloudflare Workers pricing (updated 2026-10-02), Supabase pricing.
 */

/**
 * Cloudflare Free-plan allowances. Account-wide, not per environment; the
 * admin console compares live usage against them.
 */
export const CLOUDFLARE_FREE_TIER = {
	/** R2 Standard storage, GB-month (decimal GB). */
	r2StorageBytes: 10_000_000_000,
	r2ClassAOperationsPerMonth: 1_000_000,
	r2ClassBOperationsPerMonth: 10_000_000,
	/** Workers requests, reset at 00:00 UTC. */
	workersRequestsPerDay: 100_000,
	/** Durable Objects requests, reset at 00:00 UTC. */
	durableObjectsRequestsPerDay: 100_000,
} as const;

/** Supabase Free-plan allowance per project (pricing page: 500 MB database). */
export const SUPABASE_FREE_TIER = {
	databaseBytes: 500_000_000,
} as const;

/**
 * R2 Standard overage prices in USD (R2 pricing, consulted 2026-10-01). Used
 * only to estimate an overage once a free allowance is exceeded; the estimates
 * go stale when Cloudflare reprices and must be re-cited then.
 */
export const R2_OVERAGE_PRICES_USD = {
	storagePerGbMonth: 0.015,
	classAOperationsPerMillion: 4.5,
	classBOperationsPerMillion: 0.36,
} as const;

/** Share of an allowance at which the console warns, then flags as critical. */
export const PLATFORM_USAGE_WARNING_RATIO = 0.7;
export const PLATFORM_USAGE_CRITICAL_RATIO = 0.9;
