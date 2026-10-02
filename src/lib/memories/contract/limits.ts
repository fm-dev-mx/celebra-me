/**
 * Global operational limits for event memories.
 *
 * Everything here applies to every event. Per-event values (upload window,
 * retention, event and session quotas) are stored in `event_memory_settings`;
 * `MEMORIES_LIMIT_PROFILES` only pre-fills the administrator form.
 *
 * This module must stay free of imports so Wrangler can bundle it by relative path.
 */

const SECONDS_PER_DAY = 24 * 60 * 60;

/** Short-lived PUT capability issued by the Sign Worker. */
export const MEMORIES_PRESIGN_TTL_SECONDS = 300;
/** A reservation older than this is inspected in storage instead of waiting for its browser. */
export const MEMORIES_RESERVATION_TTL_SECONDS = MEMORIES_PRESIGN_TTL_SECONDS * 2;
/**
 * A reservation whose object is confirmed absent is released only after this
 * delay: a 60-second video on venue Wi-Fi can keep its PUT open far past the
 * capability expiry, which is checked only when the PUT starts.
 */
export const MEMORIES_UPLOAD_ABANDON_SECONDS = 30 * 60;
/** A released reservation keeps its key scheduled this long so a late PUT is still deleted. */
export const MEMORIES_LATE_UPLOAD_GRACE_SECONDS = 60 * 60;
/** Maximum in-flight uploads per guest session (technical, not commercial). */
export const MEMORIES_SESSION_MAX_IN_FLIGHT = 2;
/** JSON bodies exchanged with the Workers. */
export const MEMORIES_JSON_BODY_MAX_BYTES = 2048;
/** Bytes read from R2 to inspect signatures and container headers. */
export const MEMORIES_INSPECTION_BYTES = 65_536;
/** Browser-side hashing chunk. */
export const MEMORIES_HASH_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Hard cap on how long any object may live in R2, measured from its upload.
 * The database CHECK on `event_memory_settings` and the bucket lifecycle rule
 * are both derived from this value.
 */
export const MEMORIES_OBJECT_MAX_LIFETIME_DAYS = 150;
export const MEMORIES_OBJECT_MAX_LIFETIME_SECONDS =
	MEMORIES_OBJECT_MAX_LIFETIME_DAYS * SECONDS_PER_DAY;

const MEMORIES_AUDIT_RETENTION_DAYS = 365;
export const MEMORIES_AUDIT_RETENTION_SECONDS = MEMORIES_AUDIT_RETENTION_DAYS * SECONDS_PER_DAY;

export const MEMORIES_VALIDATION_RETRY_DELAY_SECONDS = 60;
export const MEMORIES_CLEANUP_BATCH_SIZE = 25;
export const MEMORIES_CLEANUP_LEASE_SECONDS = 15 * 60;
/** The daily cleanup keeps claiming batches until this budget is spent. */
export const MEMORIES_CLEANUP_TIME_BUDGET_MS = 20_000;
/** Share of the cleanup budget for settling stale uploads, so deletion always gets the rest. */
export const MEMORIES_CLEANUP_SETTLE_BUDGET_MS = 8_000;
export const MEMORIES_CATALOG_PAGE_SIZE = 50;

export const MEMORIES_DISPLAY_NAME_MIN_LENGTH = 1;
export const MEMORIES_DISPLAY_NAME_MAX_LENGTH = 60;
export const MEMORIES_MAX_CAPTION_LENGTH = 240;
export const MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH = 60;

/** Organizer ZIP export batches built in the browser. */
export const MEMORIES_ARCHIVE_MAX_FILES = 100;
export const MEMORIES_ARCHIVE_MAX_BYTES = 128 * 1024 * 1024;

/** Sign Worker limiter: signed reservations per session per minute. */
export const MEMORIES_SIGN_RATE_LIMIT = { limit: 6, periodSeconds: 60 } as const;

export const MEMORIES_APP_RATE_LIMITS = {
	/** Anonymous, per IP. */
	session: { maxHits: 60, windowSec: 60 },
	/** Anonymous, per IP. */
	recover: { maxHits: 5, windowSec: 60 },
	register: {
		maxHits: MEMORIES_SIGN_RATE_LIMIT.limit,
		windowSec: MEMORIES_SIGN_RATE_LIMIT.periodSeconds,
	},
	read: { maxHits: 60, windowSec: 60 },
	mutate: { maxHits: 30, windowSec: 60 },
	/** Authenticated host, per user id. Sized for gallery browsing and ZIP batch downloads (up to 100 items). */
	organizer: { maxHits: 300, windowSec: 60 },
} as const;

export type MemoriesRateLimitOperation = keyof typeof MEMORIES_APP_RATE_LIMITS;

export type MemoriesSpaceLimits = {
	maxEventObjects: number;
	maxEventBytes: number;
	maxSessionFiles: number;
	maxSessionVideos: number;
	maxSessionBytes: number;
};

/** Presets for the administrator form. The stored row is the source of truth. */
export const MEMORIES_LIMIT_PROFILES = {
	standard: {
		maxEventObjects: 2_000,
		maxEventBytes: 8_000_000_000,
		maxSessionFiles: 20,
		maxSessionVideos: 5,
		maxSessionBytes: 512 * 1024 * 1024,
	},
	extended: {
		maxEventObjects: 4_000,
		maxEventBytes: 16_000_000_000,
		maxSessionFiles: 40,
		maxSessionVideos: 10,
		maxSessionBytes: 1024 * 1024 * 1024,
	},
} as const satisfies Record<string, MemoriesSpaceLimits>;

export type MemoriesLimitProfile = keyof typeof MEMORIES_LIMIT_PROFILES;

export const MEMORIES_ENTITLEMENTS = ['package', 'addon', 'courtesy'] as const;
export type MemoriesEntitlement = (typeof MEMORIES_ENTITLEMENTS)[number];

/**
 * Cloudflare Free-plan allowances that bound every memory space at once.
 * Account-wide, not per event; the admin console compares live usage against them.
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

/** Share of an allowance at which the console warns, then flags as critical. */
export const CLOUDFLARE_USAGE_WARNING_RATIO = 0.7;
export const CLOUDFLARE_USAGE_CRITICAL_RATIO = 0.9;
