/**
 * Assembles the platform usage report into panel sections: one per visible
 * environment (Local shows both) plus the shared account/project quotas.
 * Providers are queried independently: one failing provider only blanks its
 * own card, never the page. No provider payload is forwarded, only the
 * normalized report with configuration gaps as variable names.
 */

import type {
	PlatformEnvironmentId,
	PlatformProviderCard,
	PlatformProviderUsage,
	PlatformScope,
	PlatformSection,
	PlatformUsageReport,
} from '@/lib/platform/contract/types';
import { getCloudflarePlatformUsage, type CloudflareUsageSnapshot } from './cloudflare-usage';
import { getCloudinaryPlatformUsage } from './cloudinary-usage';
import { getSupabasePlatformUsage } from './supabase-usage';
import { getVercelPlatformUsage } from './vercel-usage';
import { resolvePanelEnvironments } from './env-profiles';

async function safe(read: () => Promise<PlatformProviderUsage>): Promise<PlatformProviderUsage> {
	try {
		return await read();
	} catch {
		return { kind: 'unavailable' };
	}
}

function cloudflareCard(
	snapshot: CloudflareUsageSnapshot,
	section: PlatformEnvironmentId | 'shared',
	now: Date,
): PlatformProviderCard {
	const scope: PlatformScope = section === 'shared' ? 'account' : section;
	const missing = snapshot.missing.filter((entry) => entry.scope === scope);
	if (snapshot.kind === 'unconfigured') {
		return { provider: 'cloudflare', usage: { kind: 'unconfigured', missing } };
	}
	if (snapshot.kind === 'unavailable') {
		return { provider: 'cloudflare', usage: { kind: 'unavailable' } };
	}
	return {
		provider: 'cloudflare',
		usage: {
			kind: 'ok',
			fetchedAt: snapshot.fetchedAt ?? now.toISOString(),
			metrics: snapshot.metrics.filter((metric) => metric.scope === scope),
			spendUsd: null,
			missing,
		},
	};
}

export async function getPlatformUsageReport(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformUsageReport> {
	const environments = resolvePanelEnvironments();
	const [cloudflare, supabase, vercel, cloudinary] = await Promise.all([
		getCloudflarePlatformUsage(now, fetchImpl).catch((): CloudflareUsageSnapshot => ({
			kind: 'unavailable',
			fetchedAt: null,
			missing: [],
			metrics: [],
		})),
		Promise.all(
			environments.map((environment) =>
				safe(() => getSupabasePlatformUsage(environment, now, fetchImpl)),
			),
		),
		safe(() => getVercelPlatformUsage(now, fetchImpl)),
		safe(() => getCloudinaryPlatformUsage(now, fetchImpl)),
	]);
	const sections: PlatformSection[] = environments.map((environment, index) => ({
		id: environment,
		cards: [
			cloudflareCard(cloudflare, environment, now),
			{ provider: 'supabase', usage: supabase[index] },
		],
	}));
	sections.push({
		id: 'shared',
		cards: [
			cloudflareCard(cloudflare, 'shared', now),
			{ provider: 'vercel', usage: vercel },
			{ provider: 'cloudinary', usage: cloudinary },
		],
	});
	return sections;
}
