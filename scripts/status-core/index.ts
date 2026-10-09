/**
 * status-core — server-only read layer for reusable status evidence.
 * Importable only by server-side scripts. No React, hooks, caches, or mutation auth.
 */

export { createLiveFreshness, redactProbeError, type FreshnessMeta } from './evidence.ts';

export {
	StatusProbeSession,
	mapPool,
	runPsqlAsync,
	redactProbeIo,
	type StatusProbeSessionOptions,
	type StatusProbeDebugCounters,
} from './probe-runner.ts';

export {
	listExpectedMigrationVersions,
	readMigrationLifecycleForUrl,
	readMigrationLifecycleForUrlSync,
	type MigrationLifecycleResult,
} from './migration-probe.ts';

export {
	buildGroupedPromotionalEvidenceSql,
	readGroupedPromotionalEvidence,
	type GroupedPromotionalEvidence,
	type LiveInvitationEvidenceRow,
	type PromotionalEvidenceFailure,
	type PromotionalEvidenceOptions,
} from './promotional-evidence.ts';
