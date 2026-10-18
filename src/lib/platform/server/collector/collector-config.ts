/**
 * Credentials and identifiers the collector reads on the Production Worker.
 * Values stay in memory; only variable names ever reach a snapshot row.
 */

import { PLATFORM_ENV } from '../config';
import { readProfileVar } from '../env-profiles';
import { ACCOUNT_ID_PATTERN } from '../cloudflare-usage';

/** Zone tag of celebra-me.com (not a secret: it appears in every dashboard URL). */
export const CELEBRA_ZONE_TAG = 'b9784fab425804d204aa6b61044df8c9';

export interface CloudflareCollectorConfig {
	accountId: string;
	token: string;
	zoneTag: string;
}

export interface SupabaseCollectorConfig {
	projectRef: string;
	token: string;
}

type Resolved<T> = { config: T; missing: [] } | { config: null; missing: string[] };

export function readCloudflareCollectorConfig(): Resolved<CloudflareCollectorConfig> {
	const account = readProfileVar(PLATFORM_ENV.cloudflareAccountId, 'account', (value) =>
		ACCOUNT_ID_PATTERN.test(value),
	);
	const token = readProfileVar(PLATFORM_ENV.cloudflareAnalyticsToken, 'account');
	if (account.value && token.value) {
		return {
			config: { accountId: account.value, token: token.value, zoneTag: CELEBRA_ZONE_TAG },
			missing: [],
		};
	}
	return { config: null, missing: [account, token].filter((v) => v.missing).map((v) => v.name) };
}

export function readSupabaseCollectorConfig(): Resolved<SupabaseCollectorConfig> {
	const token = readProfileVar(PLATFORM_ENV.supabaseManagementToken, 'production');
	const ref = readProfileVar(PLATFORM_ENV.supabaseProjectRefProduction, 'production');
	if (token.value && ref.value) {
		return { config: { projectRef: ref.value, token: token.value }, missing: [] };
	}
	return { config: null, missing: [token, ref].filter((v) => v.missing).map((v) => v.name) };
}
