import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationDefinition,
} from '../provision/invitations/invitation-definition.ts';
import { listLocalRenderCorpus } from '../provision/local-render-corpus/registry.ts';
import { buildNormalizedInvitationRelease } from '../provision/normalized-invitation-release.ts';
import { serializeInvitationPackage } from '../provision/invitation-package.ts';
import {
	ObservabilityInvocationBudget,
	readEnvironmentDatabaseProjection,
	readMigrationProjection,
	unprobedEnvironmentProjection,
	unprobedMigrationProjection,
	type EnvironmentDatabaseProjection,
	type MigrationProjection,
} from './database-projection.ts';
import type {
	CanonicalObservation,
	ObservabilityProbeScope,
	SnapshotEvidence,
} from './snapshot.ts';
import type { InvitationLifecycle } from './types.ts';
import type { ObservabilityEnvironment } from './types.ts';

const ENVIRONMENTS: readonly ObservabilityEnvironment[] = ['local', 'preview', 'production'];
const PROBE_TIMEOUT_MS = 4_000;

async function buildCanonicalObservations(): Promise<{
	canonical: CanonicalObservation[];
	failures: Array<{ slug: string; lifecycle: InvitationLifecycle }>;
}> {
	const canonical: CanonicalObservation[] = [];
	const failures: Array<{ slug: string; lifecycle: InvitationLifecycle }> = [];
	await Promise.all(
		listInvitationDefinitions().map(async (definition: InvitationDefinition) => {
			try {
				const release = await buildNormalizedInvitationRelease({
					slug: definition.slug,
					sourceDir: getInvitationAssetSourceDir(definition),
				});
				canonical.push({
					slug: definition.slug,
					lifecycle: definition.lifecycle,
					deliveryScope: definition.deliveryScope,
					packageHash: serializeInvitationPackage(release).packageHash,
					managedContent: release.draftContent,
					metadata: {
						eventType: release.metadata.eventType,
						kind: 'client',
						baseDemoId: release.metadata.baseDemoId,
						themeId: release.metadata.themeId,
						snapshot: release.metadata.snapshot,
						clientName: release.metadata.clientName,
					},
					assets: release.assets.map((asset) => ({
						key: asset.key,
						displayName: asset.displayName,
						mimeType: asset.mimeType,
						width: asset.width,
						height: asset.height,
						fileSize: asset.fileSize,
					})),
				});
			} catch {
				failures.push({ slug: definition.slug, lifecycle: definition.lifecycle });
			}
		}),
	);
	canonical.sort((left, right) => left.slug.localeCompare(right.slug));
	failures.sort((left, right) => left.slug.localeCompare(right.slug));
	return { canonical, failures };
}

export async function collectSnapshotEvidence(
	probeScope: ObservabilityProbeScope,
): Promise<SnapshotEvidence> {
	const generatedAt = new Date().toISOString();
	const built = await buildCanonicalObservations();
	const legacy = listLocalRenderCorpus()
		.filter((entry) => entry.classification === 'legacy')
		.map((entry) => ({ slug: entry.slug, remoteParity: entry.remoteParity }));
	const slugs = [
		...new Set([
			...built.canonical.map((item) => item.slug),
			...legacy.map((item) => item.slug),
		]),
	];
	const budget = new ObservabilityInvocationBudget();
	const projections = {} as Record<ObservabilityEnvironment, EnvironmentDatabaseProjection>;
	const migrations = {} as Record<ObservabilityEnvironment, MigrationProjection>;
	for (const environment of ENVIRONMENTS) {
		if (probeScope === 'local' && environment !== 'local') {
			projections[environment] = unprobedEnvironmentProjection(environment);
			migrations[environment] = unprobedMigrationProjection(environment);
			continue;
		}
		projections[environment] = readEnvironmentDatabaseProjection({
			environment,
			slugs,
			timeoutMs: PROBE_TIMEOUT_MS,
			budget,
		});
		migrations[environment] = readMigrationProjection({
			environment,
			timeoutMs: PROBE_TIMEOUT_MS,
			budget,
		});
	}
	return {
		generatedAt,
		probeScope,
		canonical: built.canonical,
		canonicalFailures: built.failures,
		legacy,
		projections,
		migrations,
	};
}
