/** Current required-asset evidence, kept separate from snapshot orchestration. */
import {
	resolveCurrentAssetSlots,
	type CurrentSemanticAssetSlot,
} from './current-state-alignment.ts';
import type { InvitationDatabaseProjection } from './database-projection.ts';
import type {
	InvitationLifecycle,
	ObservabilityEnvironment,
	ObservabilitySignal,
} from './types.ts';

export function evaluateAssetSignals(input: {
	canonical: { slug: string; lifecycle: InvitationLifecycle; assets: CurrentSemanticAssetSlot[] };
	environment: ObservabilityEnvironment;
	row: InvitationDatabaseProjection;
}): {
	issues: ObservabilitySignal[];
	workItems: ObservabilitySignal[];
	operationalStatuses: Array<'UNVERIFIED' | 'BLOCKED'>;
	deliveryStatuses: Array<'UNVERIFIED' | 'IN_PROGRESS'>;
} {
	const slots = resolveCurrentAssetSlots(input.canonical.assets, input.row.managedAssets);
	const missing = slots.missingKeys.length;
	const ambiguous = slots.ambiguousKeys.length;
	if (missing === 0 && ambiguous === 0) {
		return { issues: [], workItems: [], operationalStatuses: [], deliveryStatuses: [] };
	}
	const published = input.row.publishedVersion !== null;
	const identityUnverified = ambiguous > 0;
	const signal: ObservabilitySignal = {
		impact: published ? 'OPERATIONAL' : 'DELIVERY',
		reasonCode: identityUnverified
			? 'ASSET_IDENTITY_UNVERIFIED'
			: published
				? 'REQUIRED_PUBLISHED_ASSET_MISSING'
				: 'UNPUBLISHED_ASSET_PENDING',
		nextStep: identityUnverified ? 'VERIFY_ASSET_EVIDENCE' : 'PROVIDE_REQUIRED_ASSET',
		operationalStatus: identityUnverified
			? published
				? 'UNVERIFIED'
				: 'HEALTHY'
			: published
				? 'BLOCKED'
				: 'HEALTHY',
		deliveryStatus: identityUnverified
			? published
				? 'ALIGNED'
				: 'UNVERIFIED'
			: published
				? 'ALIGNED'
				: 'IN_PROGRESS',
		detailStatus: 'AVAILABLE',
		affectedFieldCount: identityUnverified ? missing + ambiguous : missing,
		affectedSectionCount: 1,
		semanticPaths: [],
		environment: input.environment,
		slug: input.canonical.slug,
		lifecycle: input.canonical.lifecycle,
	};
	if (published) {
		return {
			issues: [signal],
			workItems: [],
			operationalStatuses: [identityUnverified ? 'UNVERIFIED' : 'BLOCKED'],
			deliveryStatuses: [],
		};
	}
	return {
		issues: identityUnverified ? [signal] : [],
		workItems: identityUnverified ? [] : [signal],
		operationalStatuses: [],
		deliveryStatuses: [identityUnverified ? 'UNVERIFIED' : 'IN_PROGRESS'],
	};
}
