/** Final browser-safe projection. No content values, UUIDs, URLs, commands, or raw errors. */
import { isManagedInvitationPath } from '../../src/lib/intake/mutations/ownership.ts';
import type {
	EnvironmentSummary,
	InvitationSummary,
	ObservabilitySignal,
	ObservabilitySnapshot,
} from './types.ts';

const ENVIRONMENT_ORDER = { local: 0, preview: 1, production: 2 } as const;

function safeSemanticPaths(paths: readonly string[]): string[] {
	return [...new Set(paths.filter(isManagedInvitationPath))].sort();
}

function signalKey(signal: ObservabilitySignal): string {
	return [
		signal.impact,
		signal.environment ? String(ENVIRONMENT_ORDER[signal.environment]) : '9',
		signal.slug ?? '',
		signal.reasonCode,
		signal.comparisonOutcome ?? '',
		signal.semanticPaths.join('|'),
	].join(':');
}

function sortSignals(signals: readonly ObservabilitySignal[]): ObservabilitySignal[] {
	return [...signals]
		.map((signal) => ({
			...signal,
			semanticPaths: safeSemanticPaths(signal.semanticPaths),
		}))
		.sort((left, right) => signalKey(left).localeCompare(signalKey(right)));
}

export function finalizeObservabilitySnapshot(
	input: Omit<
		ObservabilitySnapshot,
		'schemaVersion' | 'issues' | 'workItems' | 'environmentSummaries' | 'invitationSummaries'
	> & {
		issues: readonly ObservabilitySignal[];
		workItems: readonly ObservabilitySignal[];
		environmentSummaries: readonly EnvironmentSummary[];
		invitationSummaries: readonly InvitationSummary[];
	},
): ObservabilitySnapshot {
	return {
		...input,
		schemaVersion: 3,
		issues: sortSignals(input.issues),
		workItems: sortSignals(input.workItems),
		environmentSummaries: [...input.environmentSummaries].sort(
			(left, right) =>
				ENVIRONMENT_ORDER[left.environment] - ENVIRONMENT_ORDER[right.environment],
		),
		invitationSummaries: [...input.invitationSummaries]
			.map((summary) => ({
				...summary,
				comparisons: [...summary.comparisons]
					.sort(
						(left, right) =>
							ENVIRONMENT_ORDER[left.environment] -
							ENVIRONMENT_ORDER[right.environment],
					)
					.map((comparison) => ({
						...comparison,
						semanticPaths: safeSemanticPaths(comparison.semanticPaths),
					})),
			}))
			.sort((left, right) => left.slug.localeCompare(right.slug)),
	};
}
