/**
 * Browser-safe canonical status view. Classifier tokens only — no promotion rules.
 * decidePromotionAction / classifySchemaLifecycle remain the SSOT for decisions.
 */

export type TargetEnv = 'local' | 'preview' | 'production';

export type EvidenceState = 'LIVE' | 'CACHED' | 'UNVERIFIED';

export type SchemaLifecycleState = 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'UNVERIFIED';

export type SchemaOperationReadiness =
	| 'READY'
	| 'NEEDS_DISPOSABLE_PROOF'
	| 'PENDING_MIGRATIONS'
	| 'SCHEMA_DRIFT'
	| 'UNREACHABLE'
	| 'NOT_CONFIGURED'
	| 'UNVERIFIED';

export type EnvironmentPromotionState =
	| 'match'
	| 'behind'
	| 'absent'
	| 'diverged'
	| 'conflict'
	| 'unknown';

export type PromotionAction =
	| 'PROMOTE_PREVIEW'
	| 'PROMOTE_PRODUCTION'
	| 'BLOCKED'
	| 'UNKNOWN'
	| 'NONE';

export type PromotionReasonCode =
	| 'IN_SYNC'
	| 'EVIDENCE_INCOMPLETE'
	| 'CANONICAL_UNAVAILABLE'
	| 'IDENTITY_CONFLICT'
	| 'MANAGED_DIVERGENCE'
	| 'PRODUCTION_AHEAD_OF_PREVIEW'
	| 'PREVIEW_ALIGNED_PRODUCTION_BEHIND'
	| 'LOCAL_BEHIND_PREVIEW_ALIGNED'
	| 'PREVIEW_BEHIND_CANONICAL';

export type PromotionSource = 'canonical' | 'preview' | 'local';
export type PromotionDestination = 'preview' | 'production' | 'local';

export type DisposableProofStatus = 'valid' | 'missing' | 'stale';

export interface PromotionHandoff {
	dryRunCommand: string | null;
	applyCommand: string | null;
	ownerApplyRequired: boolean;
	steps: string[];
}

export interface CanonicalEnvSummary {
	environment: TargetEnv;
	schemaLifecycle: SchemaLifecycleState;
	appliedCount: number | null;
	expectedCount: number;
	migrationHead: string | null;
	pendingMigrations: string[];
	extraMigrations: string[];
	invitationAttentionCount: number;
	schemaOperationReadiness: SchemaOperationReadiness;
	evidence: EvidenceState;
	probedAt: string | null;
}

export interface CanonicalPromotionRow {
	slug: string;
	title: string;
	eventType: string;
	action: Exclude<PromotionAction, 'NONE'>;
	reasonCode: PromotionReasonCode;
	environments: Record<TargetEnv, EnvironmentPromotionState>;
	source: PromotionSource | null;
	destination: PromotionDestination | null;
	evidence: EvidenceState;
	envEvidence: Record<TargetEnv, EvidenceState>;
	uncertaintyNotes: string[];
	handoff: PromotionHandoff;
}

export interface CanonicalDisposableProof {
	status: DisposableProofStatus;
	reason: string;
	evidence: EvidenceState;
}

export interface CanonicalStatusView {
	schemaVersion: 1;
	generatedAt: string;
	evidence: EvidenceState;
	expectedMigrationHead: string | null;
	expectedMigrationCount: number;
	registryCount: number;
	inSyncCount: number;
	inSyncSlugs: string[];
	environments: Record<TargetEnv, CanonicalEnvSummary>;
	disposableProof: CanonicalDisposableProof;
	promotions: CanonicalPromotionRow[];
	activeRowCounts: Record<TargetEnv, number>;
	debugCounters?: {
		invocations: number;
		memoHits: number;
		timeoutDegraded: boolean;
	};
}
