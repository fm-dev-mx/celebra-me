/**
 * Browser-safe observability types for dashboard islands.
 * Keep free of scripts/ Node imports. Server SSOT: scripts/observability/types.ts
 */

export type OverallStatus = 'HEALTHY' | 'ATTENTION' | 'BLOCKED' | 'UNVERIFIED';

export type EvidenceFreshness = 'PASS' | 'FAIL' | 'STALE' | 'NOT_RUN' | 'INVALID';

export type CanonicalContentState =
	| 'MATCH_CANONICAL'
	| 'BEHIND_CANONICAL'
	| 'DIVERGED'
	| 'NOT_PRESENT'
	| 'UNVERIFIED'
	| 'IDENTITY_CONFLICT';

export type LegacyContentState =
	'MATCH_REFERENCE' | 'DIVERGED_FROM_REFERENCE' | 'NOT_PRESENT' | 'UNVERIFIED';

export type ProbeConnectivityState = 'UNREACHABLE' | 'CREDENTIALS_REQUIRED';

export type InvitationEnvContentState =
	CanonicalContentState | LegacyContentState | ProbeConnectivityState;

export type AssetHealthState = 'OK' | 'PARTIAL' | 'MISSING' | 'REMOTE_REFERENCE' | 'UNVERIFIED';

export type CorpusAssetStrategy =
	'VERSIONED_MANAGED_ASSET' | 'VERSIONED_LOCAL_ASSET' | 'HYBRID_VERSIONED_AND_REMOTE';

export type ReferenceClassification = 'CANONICAL_MANAGED' | 'LOCAL_CORPUS_REFERENCE';

export type SchemaLifecycleState = 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'UNVERIFIED' | 'SOURCE';

export type ValidationEvidenceType = 'regression' | 'screenshots';

export type ValidationRunStatus = 'pass' | 'fail';

export interface ObservabilitySourceState {
	branch: string | null;
	commitSha: string | null;
	workingTreeDirty: boolean | null;
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
	artifactLocation: string;
}

export interface ValidationEvidenceView {
	validationType: ValidationEvidenceType;
	freshness: EvidenceFreshness;
	snapshot: ValidationEvidenceSnapshot | null;
	detail?: string;
}

export interface MigrationEnvHealth {
	environment: 'repository' | 'local' | 'preview' | 'production';
	appliedCount: number | null;
	pending: string[] | '—';
	schemaLifecycle: SchemaLifecycleState;
	reachable: boolean;
	configured: boolean;
	detail?: string;
}

export interface AssetHealthRow {
	slug: string;
	assetStrategy: CorpusAssetStrategy;
	status: AssetHealthState;
	localFileCount: number;
	remoteMediaReferenceCount: number;
	localAssetKeyReferenceCount: number;
	dbAssetCount: number | null;
	detail?: string;
}

export interface InvitationEnvStatusRow {
	environment: 'local' | 'preview' | 'production';
	status: InvitationEnvContentState;
	publishedVersion: number | null;
	assetCount: number;
	detail?: string;
}

export interface InvitationHealthRow {
	slug: string;
	eventType: string;
	referenceClassification: ReferenceClassification;
	themeId: string | null;
	visualProfileId: string | null;
	assetStrategy: CorpusAssetStrategy;
	publicRoute: string;
	environments: Record<'local' | 'preview' | 'production', InvitationEnvStatusRow>;
	recommendedCommand: string | null;
	failureCause: string | null;
}

export interface EnvironmentHealthRow {
	environment: 'local' | 'preview' | 'production';
	connection: 'ok' | 'unreachable' | 'credentials_required' | 'unverified';
	runtimeIdentity: string;
	schemaLifecycle: SchemaLifecycleState;
	activeInvitationRows: number;
	supportedCorpusPresence: string;
	renderEffectiveParity:
		| 'ALL_ALIGNED'
		| 'DRAFT_DIVERGENCE_ONLY'
		| 'PUBLISHED_MISMATCH'
		| 'BEHIND_OR_CONFLICTED'
		| 'PARTIAL_PRESENCE'
		| 'UNVERIFIABLE'
		| 'MISSING';
	detail?: string;
}

export interface RecommendedCommand {
	id: string;
	label: string;
	command: string;
	reason: string;
}

export type CommandCategory = 'DIAGNOSE' | 'VALIDATE' | 'REPAIR' | 'PROMOTE';

export interface CategorizedCommand {
	id: string;
	label: string;
	command: string;
	reason: string;
	category: CommandCategory;
}

export interface ObservabilitySummaryPayload {
	schemaVersion: 1;
	generatedAt: string;
	overallStatus: OverallStatus;
	source: ObservabilitySourceState;
	summary: {
		migrations: {
			hasPending: boolean;
			pendingCount: number;
			localLifecycle: SchemaLifecycleState;
		};
		invitations: {
			totalCount: number;
			alignedCount: number;
			divergedCount: number;
			behindCount: number;
			issueSlugs: string[];
		};
		validation: {
			regressionFreshness: EvidenceFreshness;
			screenshotsFreshness: EvidenceFreshness;
		};
	};
	categorizedCommands: CategorizedCommand[];
	degradedNotes: string[];
}

export interface ObservabilitySnapshot {
	schemaVersion: 1;
	generatedAt: string;
	overallStatus: OverallStatus;
	source: ObservabilitySourceState;
	fingerprints: ObservabilityFingerprints;
	validation: {
		regression: ValidationEvidenceView;
		screenshots: ValidationEvidenceView;
	};
	migrations: MigrationEnvHealth[];
	assets: AssetHealthRow[];
	invitations: InvitationHealthRow[];
	environments: EnvironmentHealthRow[];
	recommendedCommands: RecommendedCommand[];
	degradedNotes: string[];
}
