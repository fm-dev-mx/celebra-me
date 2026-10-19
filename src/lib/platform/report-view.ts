/**
 * Pure view model for the platform console: regroups the API report (one
 * section per environment plus the shared quotas) by provider, and scores the
 * overall status the summary banner shows. The API shape stays unchanged.
 */

import { platformUsageLevel, platformUsageRatio } from './contract/meters';
import type {
	PlatformEnvironmentId,
	PlatformMissingVar,
	PlatformProviderId,
	PlatformProviderUsage,
	PlatformUsageReport,
} from './contract/types';
import type { PlatformDeployment, PlatformOverallLevel } from './dashboard-copy';

interface PlatformEnvironmentUsage {
	environment: PlatformEnvironmentId;
	usage: PlatformProviderUsage;
}

export interface PlatformProviderView {
	provider: PlatformProviderId;
	/** Account- or project-wide quotas; null when the provider has none. */
	shared: PlatformProviderUsage | null;
	environments: PlatformEnvironmentUsage[];
}

export interface PlatformSummary {
	level: PlatformOverallLevel;
	critical: number;
	warning: number;
	healthy: number;
	missing: number;
	unavailable: number;
	/** Most recent provider read across the report; null when none succeeded. */
	updatedAt: string | null;
}

const PROVIDER_ORDER: PlatformProviderId[] = ['cloudflare', 'supabase'];
/** Production first: it is the environment the event depends on. */
const ENVIRONMENT_ORDER: PlatformEnvironmentId[] = ['production', 'preview'];

export function platformDeployment(report: PlatformUsageReport): PlatformDeployment {
	const environments = report
		.map((section) => section.id)
		.filter((id): id is PlatformEnvironmentId => id !== 'shared');
	return environments.length === 1 ? environments[0] : 'local';
}

export function groupPlatformReport(report: PlatformUsageReport): PlatformProviderView[] {
	const views = new Map<PlatformProviderId, PlatformProviderView>(
		PROVIDER_ORDER.map((provider) => [provider, { provider, shared: null, environments: [] }]),
	);
	for (const section of report) {
		for (const card of section.cards) {
			const view = views.get(card.provider);
			if (!view) continue;
			if (section.id === 'shared') view.shared = card.usage;
			else view.environments.push({ environment: section.id, usage: card.usage });
		}
	}
	for (const view of views.values()) {
		view.environments.sort(
			(a, b) =>
				ENVIRONMENT_ORDER.indexOf(a.environment) - ENVIRONMENT_ORDER.indexOf(b.environment),
		);
	}
	return [...views.values()].filter((view) => view.shared || view.environments.length > 0);
}

function missingOf(usage: PlatformProviderUsage): PlatformMissingVar[] {
	return usage.kind === 'unavailable' ? [] : usage.missing;
}

export function summarizePlatformReport(report: PlatformUsageReport): PlatformSummary {
	const summary: PlatformSummary = {
		level: 'ok',
		critical: 0,
		warning: 0,
		healthy: 0,
		missing: 0,
		unavailable: 0,
		updatedAt: null,
	};
	const missingNames = new Set<string>();
	for (const section of report) {
		for (const { usage } of section.cards) {
			for (const entry of missingOf(usage)) missingNames.add(`${entry.name}:${entry.scope}`);
			if (usage.kind === 'unavailable') summary.unavailable += 1;
			if (usage.kind !== 'ok') continue;
			if (!summary.updatedAt || usage.fetchedAt > summary.updatedAt) {
				summary.updatedAt = usage.fetchedAt;
			}
			for (const metric of usage.metrics) {
				const { used, limit } = metric.meter;
				if (used === null || limit === null) continue;
				const level = platformUsageLevel(platformUsageRatio(used, limit));
				if (level === 'critical') summary.critical += 1;
				else if (level === 'warning') summary.warning += 1;
				else summary.healthy += 1;
			}
		}
	}
	summary.missing = missingNames.size;
	if (summary.critical > 0) summary.level = 'critical';
	else if (summary.warning > 0) summary.level = 'warning';
	else if (summary.missing > 0 || summary.unavailable > 0) summary.level = 'attention';
	return summary;
}
