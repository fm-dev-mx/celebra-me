/**
 * Aggregates every provider's usage for the super-admin platform console.
 * Providers are queried independently: one failing provider only blanks its
 * own card, never the page. No provider payload is forwarded, only the
 * normalized report.
 */

import type {
	PlatformProviderId,
	PlatformProviderUsage,
	PlatformUsageReport,
} from '@/lib/platform/contract/types';
import { getCloudflarePlatformUsage } from './cloudflare-usage';
import { getCloudinaryPlatformUsage } from './cloudinary-usage';
import { getSupabasePlatformUsage } from './supabase-usage';
import { getVercelPlatformUsage } from './vercel-usage';

type ProviderReader = (now?: Date, fetchImpl?: typeof fetch) => Promise<PlatformProviderUsage>;

const PROVIDER_READERS: Record<PlatformProviderId, ProviderReader> = {
	cloudflare: getCloudflarePlatformUsage,
	supabase: getSupabasePlatformUsage,
	vercel: getVercelPlatformUsage,
	cloudinary: getCloudinaryPlatformUsage,
};

export async function getPlatformUsageReport(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformUsageReport> {
	const entries = await Promise.all(
		(Object.keys(PROVIDER_READERS) as PlatformProviderId[]).map(async (id) => {
			try {
				return [id, await PROVIDER_READERS[id](now, fetchImpl)] as const;
			} catch {
				return [id, { kind: 'unavailable' } as PlatformProviderUsage] as const;
			}
		}),
	);
	return Object.fromEntries(entries) as PlatformUsageReport;
}
