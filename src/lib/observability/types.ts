/**
 * Browser-safe observability types for dashboard islands.
 * Keep free of scripts/ Node imports. Server SSOT: scripts/observability/types.ts
 */

export type OverallStatus = 'HEALTHY' | 'ATTENTION' | 'BLOCKED' | 'UNVERIFIED';

export type EvidenceFreshness = 'PASS' | 'FAIL' | 'STALE' | 'NOT_RUN' | 'INVALID';

export type ValidationEvidenceType = 'regression' | 'screenshots';

export type ObservabilityIssueSeverity = 'blocking' | 'warning' | 'unverified';
export type ObservabilityIssueDomain =
	'environment' | 'invitation' | 'migration' | 'asset' | 'validation' | 'source' | 'data_quality';
export type ObservabilityIssueCode =
	| 'DATA_INTEGRITY'
	| 'SOURCE_UNVERIFIED'
	| 'SOURCE_DIRTY'
	| 'PROBE_DEGRADED'
	| 'ENV_CONNECTION'
	| 'ENV_SCHEMA'
	| 'ENV_PARITY'
	| 'INVITATION_MISSING'
	| 'INVITATION_IDENTITY_CONFLICT'
	| 'INVITATION_BEHIND'
	| 'INVITATION_DIVERGED'
	| 'INVITATION_UNVERIFIED'
	| 'MIGRATION_BEHIND'
	| 'MIGRATION_DRIFT'
	| 'MIGRATION_UNVERIFIED'
	| 'ASSET_MISSING'
	| 'ASSET_PARTIAL'
	| 'ASSET_UNVERIFIED'
	| 'VALIDATION_FAILED'
	| 'VALIDATION_STALE'
	| 'VALIDATION_NOT_RUN'
	| 'VALIDATION_INVALID'
	| 'SNAPSHOT_REFRESH_FAILED';
export type ObservabilityHealthDomain =
	'environments' | 'invitations' | 'migrations' | 'assets' | 'validations';
export interface ObservabilityHealthCounts {
	total: number;
	ok: number;
	warning: number;
	blocking: number;
	unverified: number;
}
export interface ObservabilityIssue {
	id: string;
	code: ObservabilityIssueCode;
	severity: ObservabilityIssueSeverity;
	domain: ObservabilityIssueDomain;
	scope: string;
	title: string;
	description: string;
	environment?: 'local' | 'preview' | 'production';
	slug?: string;
	actionIds: string[];
}
export interface ObservabilityAction {
	id: string;
	label: string;
	command: string;
	reason: string;
}
export interface ValidationEvidenceSummary {
	type: ValidationEvidenceType;
	freshness: EvidenceFreshness;
	completedAt: string | null;
	passed: number | null;
	total: number | null;
}

export interface ObservabilitySnapshot {
	schemaVersion: 2;
	generatedAt: string;
	overallStatus: OverallStatus;
	cache: {
		state: 'fresh' | 'stale-fallback';
		refreshAfter: string;
	};
	source: {
		branch: string | null;
		commitShaShort: string | null;
		workingTreeDirty: boolean | null;
	};
	health: Record<ObservabilityHealthDomain, ObservabilityHealthCounts>;
	issues: ObservabilityIssue[];
	validationEvidence: ValidationEvidenceSummary[];
	recommendedActions: ObservabilityAction[];
}
