/**
 * Shared types for Local validation evidence and git source identity.
 * Not a human status vocabulary — HEALTHY/ALIGNED live elsewhere and must not return here.
 */

export type EvidenceFreshness = 'PASS' | 'FAIL' | 'STALE' | 'NOT_RUN' | 'INVALID';

export type ValidationEvidenceType = 'regression' | 'screenshots';

export type ValidationRunStatus = 'pass' | 'fail';

export interface ObservabilitySourceState {
	branch: string | null;
	commitSha: string | null;
	workingTreeDirty: boolean | null;
	/** True when git probes failed; fields above may be null/degraded. */
	degraded: boolean;
	detail?: string;
}

export interface ObservabilityFingerprints {
	corpusFingerprint: string;
	inputFingerprint: string;
}

export interface ValidationFailureRecord {
	slug: string;
	message: string;
}

export interface ValidationEvidenceSnapshot {
	schemaVersion: 1;
	validationType: ValidationEvidenceType;
	command: string;
	startedAt: string;
	completedAt: string;
	status: ValidationRunStatus;
	branch: string | null;
	commitSha: string | null;
	workingTreeDirty: boolean | null;
	inputFingerprint: string;
	corpusFingerprint: string;
	total: number;
	passed: number;
	failed: number;
	failures: ValidationFailureRecord[];
	/** Repo-relative path only, e.g. `.tmp/observability/validation/regression.json`. */
	artifactLocation: string;
}

export interface ValidationEvidenceView {
	validationType: ValidationEvidenceType;
	freshness: EvidenceFreshness;
	snapshot: ValidationEvidenceSnapshot | null;
	detail?: string;
}
