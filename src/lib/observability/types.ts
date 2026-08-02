/** Browser-safe observability snapshot v3 contract. */
export type ObservabilityEnvironment = 'local' | 'preview' | 'production';
export type OperationalStatus = 'HEALTHY' | 'ATTENTION' | 'BLOCKED' | 'UNVERIFIED';
export type DeliveryStatus = 'ALIGNED' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'UNVERIFIED';
export type SnapshotFreshness = 'FRESH' | 'STALE' | 'PARTIAL';
export type CoverageStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_PROBED';
export type InvitationLifecycle = 'in_progress' | 'published';
export type ComparisonOutcome =
	'APPLY' | 'ALREADY_APPLIED' | 'DRIFT' | 'DELIVERY_SCOPE_BLOCKED' | 'UNVERIFIED';
export type SemanticDetailStatus = 'AVAILABLE' | 'DETAIL_UNAVAILABLE';
export type ObservabilityImpact = 'OPERATIONAL' | 'DELIVERY';

export type ObservabilityReasonCode =
	| 'ENVIRONMENT_UNAVAILABLE'
	| 'ENVIRONMENT_IDENTITY_CONFLICT'
	| 'SCHEMA_BEHIND'
	| 'SCHEMA_DRIFT'
	| 'SCHEMA_UNAVAILABLE'
	| 'AUTHORITATIVE_COUNT_MISMATCH'
	| 'INVITATION_IDENTITY_CONFLICT'
	| 'INVITATION_MISSING'
	| 'CANONICAL_INVALID'
	| 'DRAFT_INVALID'
	| 'BASELINE_UNAVAILABLE'
	| 'BASELINE_VERSION_INCOMPATIBLE'
	| 'MANAGED_DRIFT'
	| 'DELIVERY_SCOPE_BLOCKED'
	| 'LIFECYCLE_SEQUENCE_INVALID'
	| 'LIFECYCLE_METADATA_STALE'
	| 'REQUIRED_PUBLISHED_ASSET_MISSING'
	| 'UNPUBLISHED_ASSET_PENDING'
	| 'ASSET_IDENTITY_UNVERIFIED'
	| 'CANONICAL_CHANGE_PENDING'
	| 'VALID_DRAFT_PENDING'
	| 'PARTIAL_PROMOTION'
	| 'PREVIEW_VERIFICATION_REQUIRED'
	| 'DETAIL_BUDGET_EXCEEDED'
	| 'SNAPSHOT_REFRESH_FAILED';

export type ObservabilityNextStep =
	| 'NONE'
	| 'RETRY_PROBE'
	| 'AUDIT_SCHEMA'
	| 'RESOLVE_IDENTITY'
	| 'VERIFY_BASELINE'
	| 'RECONCILE_MANAGED_CONTENT'
	| 'APPLY_LOCAL'
	| 'PROMOTE_PREVIEW'
	| 'PROMOTE_PRODUCTION'
	| 'VERIFY_PREVIEW'
	| 'FIX_CANONICAL_DEFINITION'
	| 'UPDATE_LIFECYCLE_METADATA'
	| 'PROVIDE_REQUIRED_ASSET'
	| 'VERIFY_ASSET_EVIDENCE';

export interface EnvironmentCoverage {
	environment: ObservabilityEnvironment;
	status: CoverageStatus;
	reasonCode?: ObservabilityReasonCode;
}

export interface ComparisonSummary {
	environment: ObservabilityEnvironment;
	outcome: ComparisonOutcome;
	detailStatus: SemanticDetailStatus;
	affectedFieldCount: number;
	affectedSectionCount: number;
	semanticPaths: string[];
}

export interface InvitationSummary {
	slug: string;
	lifecycle: InvitationLifecycle;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	comparisons: ComparisonSummary[];
}

export interface ObservabilitySignal {
	impact: ObservabilityImpact;
	reasonCode: ObservabilityReasonCode;
	nextStep: ObservabilityNextStep;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	detailStatus: SemanticDetailStatus;
	affectedFieldCount: number;
	affectedSectionCount: number;
	semanticPaths: string[];
	environment?: ObservabilityEnvironment;
	slug?: string;
	lifecycle?: InvitationLifecycle;
	comparisonOutcome?: ComparisonOutcome;
}

export interface EnvironmentSummary {
	environment: ObservabilityEnvironment;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	coverage: CoverageStatus;
	counts: {
		invitations: number;
		issues: number;
		workItems: number;
	};
}

export interface ObservabilityReporting {
	schemaVersion: 1;
	snapshotId: string;
	evidenceFingerprint: string;
	generatedAt: string;
	commitSha: string | null;
	databaseTargets: {
		local: 'persistent-local';
		preview: 'preview';
		production: 'production';
	};
	invitationClassifications: Array<{
		slug: string;
		lifecycle: InvitationLifecycle;
		operationalStatus: OperationalStatus;
		deliveryStatus: DeliveryStatus;
	}>;
	issueKeys: string[];
	workItemKeys: string[];
}

export interface ObservabilitySnapshot {
	schemaVersion: 3;
	generatedAt: string;
	freshness: SnapshotFreshness;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	reporting: ObservabilityReporting;
	coverage: EnvironmentCoverage[];
	cache: { refreshAfter: string };
	issues: ObservabilitySignal[];
	workItems: ObservabilitySignal[];
	environmentSummaries: EnvironmentSummary[];
	invitationSummaries: InvitationSummary[];
}

export interface ObservabilitySummaryPayload {
	schemaVersion: 3;
	generatedAt: string;
	freshness: SnapshotFreshness;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	reporting: ObservabilityReporting;
	coverage: EnvironmentCoverage[];
	counts: {
		invitations: number;
		issues: number;
		workItems: number;
	};
}
