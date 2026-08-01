import type {
	ObservabilityEnvironment,
	ObservabilitySnapshot,
	ObservabilitySummaryPayload,
} from '@/lib/observability/types';

const ENVIRONMENTS: ObservabilityEnvironment[] = ['local', 'preview', 'production'];

export function buildObservabilitySnapshotFixture(
	overrides: Partial<ObservabilitySnapshot> = {},
): ObservabilitySnapshot {
	return {
		schemaVersion: 3,
		generatedAt: '2026-08-01T12:00:00.000Z',
		freshness: 'FRESH',
		operationalStatus: 'HEALTHY',
		deliveryStatus: 'ALIGNED',
		coverage: ENVIRONMENTS.map((environment) => ({
			environment,
			status: 'AVAILABLE' as const,
		})),
		cache: { refreshAfter: '2026-08-01T12:01:00.000Z' },
		issues: [],
		workItems: [],
		environmentSummaries: ENVIRONMENTS.map((environment) => ({
			environment,
			operationalStatus: 'HEALTHY' as const,
			deliveryStatus: 'ALIGNED' as const,
			coverage: 'AVAILABLE' as const,
			counts: { invitations: 0, issues: 0, workItems: 0 },
		})),
		invitationSummaries: [],
		...overrides,
	};
}

export function buildObservabilitySummaryFixture(
	overrides: Partial<ObservabilitySummaryPayload> = {},
): ObservabilitySummaryPayload {
	const snapshot = buildObservabilitySnapshotFixture();
	return {
		schemaVersion: 3,
		generatedAt: snapshot.generatedAt,
		freshness: snapshot.freshness,
		operationalStatus: snapshot.operationalStatus,
		deliveryStatus: snapshot.deliveryStatus,
		coverage: snapshot.coverage,
		counts: { invitations: 0, issues: 0, workItems: 0 },
		...overrides,
	};
}
