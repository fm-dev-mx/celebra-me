/**
 * status-core — server-only read layer for reusable status evidence.
 * Importable only by server-side scripts. No React, hooks, caches, or mutation auth.
 */

export { createLiveFreshness, redactProbeError, type FreshnessMeta } from './evidence.ts';

export { StatusProbeSession, mapPool, type StatusProbeDebugCounters } from './probe-runner.ts';

export {
	listExpectedMigrationVersions,
	readMigrationLifecycleForUrl,
	readMigrationLifecycleForUrlSync,
} from './migration-probe.ts';

export {
	readGroupedPromotionalEvidence,
	type LiveInvitationEvidenceRow,
} from './promotional-evidence.ts';
