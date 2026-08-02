import { createHash } from 'node:crypto';

import { canonicalize } from '../provision/normalized-invitation-release.ts';
import { readObservabilitySourceState } from './source-state.ts';
import type { InvitationSummary, ObservabilityReporting, ObservabilitySignal } from './types.ts';

const DATABASE_TARGETS = {
	local: 'persistent-local',
	preview: 'preview',
	production: 'production',
} as const;

function signalKey(signal: ObservabilitySignal): string {
	return [
		signal.impact,
		signal.environment ?? '',
		signal.slug ?? '',
		signal.reasonCode,
		signal.nextStep,
		signal.comparisonOutcome ?? '',
		signal.semanticPaths.join(','),
	].join('|');
}

export function buildReportingEvidence(input: {
	generatedAt: string;
	probeScope: 'local' | 'all';
	invitations: readonly InvitationSummary[];
	issues: readonly ObservabilitySignal[];
	workItems: readonly ObservabilitySignal[];
}): ObservabilityReporting {
	const source = readObservabilitySourceState();
	const invitationClassifications = input.invitations
		.map(({ slug, lifecycle, operationalStatus, deliveryStatus }) => ({
			slug,
			lifecycle,
			operationalStatus,
			deliveryStatus,
		}))
		.sort((left, right) => left.slug.localeCompare(right.slug));
	const issueKeys = input.issues.map(signalKey).sort();
	const workItemKeys = input.workItems.map(signalKey).sort();
	const fingerprintInput = {
		generatedAt: input.generatedAt,
		probeScope: input.probeScope,
		commitSha: source.commitSha,
		databaseTargets: DATABASE_TARGETS,
		invitationClassifications,
		issueKeys,
		workItemKeys,
	};
	const evidenceFingerprint = createHash('sha256')
		.update(canonicalize(fingerprintInput))
		.digest('hex');

	return {
		schemaVersion: 1,
		snapshotId: `observability-${evidenceFingerprint.slice(0, 24)}`,
		evidenceFingerprint,
		generatedAt: input.generatedAt,
		commitSha: source.commitSha,
		databaseTargets: DATABASE_TARGETS,
		invitationClassifications,
		issueKeys,
		workItemKeys,
	};
}
