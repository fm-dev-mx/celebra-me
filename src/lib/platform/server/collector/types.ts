/**
 * Rows the platform usage collector writes to `platform_usage_snapshots`: one
 * row per provider dataset per run. Payloads hold aggregates only; a failed
 * dataset stores a typed failure code, never a provider body or a secret.
 */

import type { ProviderFailure } from '../provider-request';

/** Mirrors the `platform_usage_snapshots_provider_valid` check constraint. */
export type PlatformSnapshotProvider =
	| 'cloudflare_workers'
	| 'cloudflare_durable_objects'
	| 'cloudflare_r2'
	| 'cloudflare_zone'
	| 'supabase_disk';

/** Why a dataset is missing from a run. `unconfigured` lists variable names only. */
export interface PlatformSnapshotFailure {
	failure: ProviderFailure | 'unconfigured';
	/** Request inside the dataset that failed (e.g. `graphql`, `namespaces`). */
	stage?: string;
	/** Sanitized provider error code, when the provider sent one. */
	code?: string;
	/** Token permission to add when the provider denied access. */
	missingPermission?: string;
	missing?: string[];
}

export interface PlatformSnapshotRow {
	collected_at: string;
	provider: PlatformSnapshotProvider;
	ok: boolean;
	payload: Record<string, unknown>;
}

export type DatasetResult =
	| { ok: true; payload: Record<string, unknown> }
	| { ok: false; payload: PlatformSnapshotFailure };
