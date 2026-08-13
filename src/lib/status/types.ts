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

/** Owner-apply ledger vs live Production history. Independent of schemaLifecycle. */
export type AuthorizationIntegrity =
	| 'RECORDED'
	| 'MISSING'
	| 'GRANDFATHERED'
	| 'NOT_APPLICABLE'
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

/** Presentation category for operator UI/CLI. Not a classifier. */
export type StatusSemantic = 'verified' | 'unverified' | 'blocked' | 'neutral';

export type NextStepType = 'Diagnose' | 'Verify' | 'Apply' | 'Manual/HITL';

export interface PromotionHandoff {
	dryRunCommand: string | null;
	dryRunStepType: NextStepType;
	applyCommand: string | null;
	applyStepType: NextStepType;
	ownerApplyRequired: boolean;
	/** Optional read-only diagnostic. Never a remediation and never implied to resolve UNKNOWN. */
	optionalDiagnosticCommand: string | null;
	steps: string[];
}

export type DiagnosticCode =
	| 'ENVIRONMENT_IDENTITY_CONFLICT'
	| 'AUTHORITATIVE_COUNT_MISMATCH'
	| 'INVITATION_IDENTITY_CONFLICT'
	| 'DRAFT_INVALID'
	| 'BASELINE_UNAVAILABLE'
	| 'BASELINE_VERSION_INCOMPATIBLE'
	| 'MANAGED_DRIFT'
	| 'DELIVERY_SCOPE_BLOCKED'
	| 'REQUIRED_PUBLISHED_ASSET_MISSING'
	| 'UNPUBLISHED_ASSET_PENDING'
	| 'ASSET_IDENTITY_UNVERIFIED'
	| 'LIFECYCLE_METADATA_STALE'
	| 'DETAIL_BUDGET_EXCEEDED'
	| 'PRODUCTION_AUTHORIZATION_MISSING';

/** The canonical domain whose evidence directly produced a diagnostic. */
export type DiagnosticDomain = 'schema' | 'content';

/** Enrichment only — must never carry promotion/schema/readiness authority. */
export interface CanonicalDiagnostic {
	code: DiagnosticCode;
	domain: DiagnosticDomain;
	evidence: EvidenceState;
	slug?: string;
	environment?: TargetEnv;
	cause: string;
	affectedFieldCount: number;
	affectedSectionCount: number;
	semanticPaths: string[];
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
	identityConflictsCount: number;
	targetClassification: string;
	environmentIdentityOk: boolean;
	schemaOperationReadiness: SchemaOperationReadiness;
	/** Copied from deriveSchemaOperationFields — presentation only, not a second classifier. */
	schemaNextAction: string | null;
	authorizationIntegrity: AuthorizationIntegrity;
	authorizationMissingVersions: string[];
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

export type MigrationPresence = 'APPLIED' | 'NOT_APPLIED' | 'UNVERIFIED';

export interface RecentMigrationRecord {
	version: string;
	name: string | null;
	presence: {
		local: MigrationPresence;
		preview: MigrationPresence;
		production: MigrationPresence;
	};
	/** Verification timestamp of the migration probe per environment — not an apply time. */
	verifiedAt: {
		local: string | null;
		preview: string | null;
		production: string | null;
	};
}

export interface FreshnessMeta {
	status: 'LIVE' | 'CACHED' | 'STALE' | 'REVALIDATING' | 'UNVERIFIED';
	lastVerifiedAt: string;
}

export interface CanonicalStatusView {
	schemaVersion: 1;
	generatedAt: string;
	evidence: EvidenceState;
	freshnessMeta?: FreshnessMeta;
	expectedMigrationHead: string | null;
	expectedMigrationCount: number;
	registryCount: number;
	inSyncCount: number;
	inSyncSlugs: string[];
	environments: Record<TargetEnv, CanonicalEnvSummary>;
	disposableProof: CanonicalDisposableProof;
	promotions: CanonicalPromotionRow[];
	activeRowCounts: Record<TargetEnv, number>;
	identityConflictCounts: Record<TargetEnv, number>;
	recentMigrations?: RecentMigrationRecord[];
	diagnostics: CanonicalDiagnostic[];
	debugCounters?: {
		invocations: number;
		memoHits: number;
		timeoutDegraded: boolean;
	};
}
