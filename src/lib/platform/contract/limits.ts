/**
 * Plan allowances, warning thresholds and documented overage prices for the
 * platform usage console. These quotas bound every project at once; they are
 * account- or project-wide, never per event.
 *
 * Sources (consulted 2026-10-18): Cloudflare Workers pricing
 * (developers.cloudflare.com/workers/platform/pricing, updated 2026-10-02),
 * Durable Objects pricing (developers.cloudflare.com/durable-objects/platform/pricing,
 * updated 2026-10-18), R2 pricing (developers.cloudflare.com/r2/pricing,
 * updated 2026-10-01), Supabase pricing.
 */

/**
 * Cloudflare allowances for an account on Workers Paid with R2 Paid.
 * Account-wide, not per environment. Cloudflare resets monthly allowances on
 * the subscription renewal date; the console approximates that cycle with the
 * UTC calendar month (`monthUtc`).
 */
export const CLOUDFLARE_PAID_PLAN = {
	/** R2 Standard storage included per month, GB-month (decimal GB). */
	r2StorageBytes: 10_000_000_000,
	r2ClassAOperationsPerMonth: 1_000_000,
	r2ClassBOperationsPerMonth: 10_000_000,
	/** Workers Standard requests included per month (static assets are free). */
	workersRequestsPerMonth: 10_000_000,
	/** Workers Standard CPU milliseconds included per month. */
	workersCpuMsPerMonth: 30_000_000,
	/** Durable Objects requests included per month (HTTP, RPC sessions, alarms). */
	durableObjectsRequestsPerMonth: 1_000_000,
	/** Durable Objects compute duration included per month, GB-s. */
	durableObjectsDurationGbSecondsPerMonth: 400_000,
	/** SQLite-backed Durable Objects storage included per month, GB-month. */
	durableObjectsSqlStorageBytes: 5_000_000_000,
} as const;

/** Supabase Free-plan allowance per project (pricing page: 500 MB database). */
export const SUPABASE_FREE_TIER = {
	databaseBytes: 500_000_000,
} as const;

/**
 * R2 Standard overage prices in USD (R2 pricing, consulted 2026-10-18). Used
 * only to estimate an overage once an included allowance is exceeded; the
 * estimates go stale when Cloudflare reprices and must be re-cited then.
 */
export const R2_OVERAGE_PRICES_USD = {
	storagePerGbMonth: 0.015,
	classAOperationsPerMillion: 4.5,
	classBOperationsPerMillion: 0.36,
} as const;

/** Share of an allowance at which the console warns, then flags as critical. */
export const PLATFORM_USAGE_WARNING_RATIO = 0.7;
export const PLATFORM_USAGE_CRITICAL_RATIO = 0.9;
