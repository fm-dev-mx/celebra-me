import { RELEASE_SCHEMA_VERSION } from './normalized-invitation-release.ts';

export type ManagedBaselineClassification =
	| 'verified_current'
	| 'missing_provenance'
	| 'legacy_provenance'
	| 'missing_receipt'
	| 'incompatible_normalization_version'
	| 'partial_previous_operation'
	| 'stale_provenance'
	| 'editor_mutation_after_baseline'
	| 'publication_after_baseline'
	| 'manual_or_unmanaged_drift';

export type ManagedBaselineDiagnosticClassification = ManagedBaselineClassification | 'unknown';
export type ManagedBaselineDiagnosticDisposition = 'verified' | 'adoptable' | 'blocked';

export interface ManagedBaselineDiagnostic {
	classification: ManagedBaselineDiagnosticClassification;
	disposition: ManagedBaselineDiagnosticDisposition;
	adoptionEligible: boolean;
}

export interface ManagedBaselineReceiptEvidence {
	operationId: string;
	status: 'not_applied' | 'applied' | 'partial' | 'replayed';
	commandKind: string;
	origin?: string;
	completedSteps?: string[];
	inputHashes?: Record<string, unknown>;
}

export function isRecoverableManagedPartial(
	receipt: ManagedBaselineReceiptEvidence | null | undefined,
	input: { sourceHash: string; packageHash: string },
): boolean {
	return Boolean(
		receipt?.status === 'partial' &&
		receipt.commandKind === 'managed_invitation_apply' &&
		(receipt.origin === 'managed_cli_local' || receipt.origin === 'managed_cli_hosted') &&
		receipt.inputHashes?.sourceHash === input.sourceHash &&
		receipt.inputHashes?.packageHash === input.packageHash,
	);
}

export interface ManagedMergeBaselineInput {
	managedProjection?: Record<string, unknown> | null;
	/** Allows metadata-only authority checks without reading baseline content. */
	hasManagedProjection?: boolean;
	/** Release schema is the normalization contract that produced managedProjection. */
	releaseSchemaVersion?: string | null;
	appliedDraftUpdatedAt?: string | null;
	appliedOperationId?: string | null;
	appliedPublishedVersion?: number | null;
	appliedPublishedProjectionHash?: string | null;
	currentDraftUpdatedAt?: string | null;
	currentPublishedVersion?: number | null;
	currentPublishedProjectionHash?: string | null;
	appliedReceipt?: ManagedBaselineReceiptEvidence | null;
	latestMutationReceipt?: ManagedBaselineReceiptEvidence | null;
}

export interface ManagedBaselineArtifact {
	managedProjection: Record<string, unknown>;
	normalizationVersion: string;
}

export class ManagedBaselineError extends Error {
	readonly code = 'MANAGED_BASELINE_UNVERIFIED';
	readonly requiresOperatorDecision = true;

	constructor(
		readonly classification: Exclude<ManagedBaselineClassification, 'verified_current'>,
		message: string,
	) {
		super(`${classification}: ${message}`);
		this.name = 'ManagedBaselineError';
	}
}

/**
 * Converts a baseline failure into a stable, non-throwing operator decision.
 * Only missing/legacy evidence can be considered for a metadata-only adoption;
 * every other classification remains fail-closed until an operator reconciles it.
 */
export function diagnoseManagedBaselineError(error: unknown): ManagedBaselineDiagnostic {
	if (!(error instanceof ManagedBaselineError)) {
		return {
			classification: 'unknown',
			disposition: 'blocked',
			adoptionEligible: false,
		};
	}
	const adoptionEligible =
		error.classification === 'missing_provenance' ||
		error.classification === 'legacy_provenance';
	return {
		classification: error.classification,
		disposition: adoptionEligible ? 'adoptable' : 'blocked',
		adoptionEligible,
	};
}

/**
 * Evaluates the durable baseline contract without exposing its implementation exception.
 * This is intentionally pure from the caller's perspective and performs no database I/O.
 */
export function diagnoseManagedBaseline(
	input: ManagedMergeBaselineInput,
	expectedNormalizationVersion: string,
): ManagedBaselineDiagnostic {
	try {
		resolveVerifiedManagedBaseline(input, expectedNormalizationVersion, {
			requireProjection: false,
		});
		// Verification of the stored artifact is not enough for reconciliation:
		// inspect the live revision tokens as well so publication/editor races are
		// surfaced before any adoption decision.
		resolveManagedMergeBaseline(input);
		return {
			classification: 'verified_current',
			disposition: 'verified',
			adoptionEligible: false,
		};
	} catch (error) {
		return diagnoseManagedBaselineError(error);
	}
}

/**
 * A baseline must contain a normalized managed document, not merely a JSON
 * container.  PostgreSQL treats `{}` as present, so truthiness is not a
 * sufficient authority check here.
 */
function isStructurallyEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string') return value.trim().length === 0;
	if (Array.isArray(value)) return value.length === 0 || value.every(isStructurallyEmpty);
	if (typeof value === 'object') {
		const entries = Object.values(value as Record<string, unknown>);
		return entries.length === 0 || entries.every(isStructurallyEmpty);
	}
	return false;
}

function fail(
	classification: Exclude<ManagedBaselineClassification, 'verified_current'>,
	message: string,
): never {
	throw new ManagedBaselineError(classification, message);
}

function hasCompleteProvenanceIdentity(input: ManagedMergeBaselineInput): boolean {
	return Boolean(
		input.appliedDraftUpdatedAt &&
		input.appliedOperationId &&
		input.appliedPublishedVersion &&
		input.appliedPublishedProjectionHash,
	);
}

function receiptProvesManagedApply(receipt: ManagedBaselineReceiptEvidence): boolean {
	const finalStatus = receipt.status === 'applied' || receipt.status === 'replayed';
	return (
		(receipt.commandKind === 'managed_invitation_apply' ||
			receipt.commandKind === 'managed_baseline_reconstruction' ||
			receipt.commandKind === 'managed_baseline_adoption') &&
		finalStatus &&
		Boolean(receipt.completedSteps?.includes('provenance_recorded'))
	);
}

function publicationMatches(input: ManagedMergeBaselineInput): boolean {
	return (
		input.currentPublishedVersion === input.appliedPublishedVersion &&
		input.currentPublishedProjectionHash === input.appliedPublishedProjectionHash
	);
}

function resolveManagedBaselineCore(
	input: ManagedMergeBaselineInput,
	expectedNormalizationVersion?: string,
): Record<string, unknown> {
	const hasManagedProjection =
		input.hasManagedProjection ?? !isStructurallyEmpty(input.managedProjection);
	if (
		!hasManagedProjection ||
		(input.managedProjection !== null &&
			input.managedProjection !== undefined &&
			isStructurallyEmpty(input.managedProjection))
	) {
		return fail(
			'missing_provenance',
			'No non-empty managed projection exists; use adoption or operator reconciliation.',
		);
	}
	if (!hasCompleteProvenanceIdentity(input)) {
		return fail('legacy_provenance', 'Managed provenance lacks Phase 2 identity evidence.');
	}
	if (
		expectedNormalizationVersion &&
		input.releaseSchemaVersion !== expectedNormalizationVersion
	) {
		return fail(
			'incompatible_normalization_version',
			'The managed projection was produced by an incompatible normalization contract.',
		);
	}
	if (!input.appliedReceipt || input.appliedReceipt.operationId !== input.appliedOperationId) {
		return fail('missing_receipt', 'The provenance operation has no matching durable receipt.');
	}
	if (!receiptProvesManagedApply(input.appliedReceipt)) {
		return fail(
			'stale_provenance',
			'The matching receipt does not prove a complete managed apply.',
		);
	}
	return input.managedProjection ?? {};
}

/**
 * The sole baseline authority path.  Metadata-only callers may omit the
 * projection content, but any supplied projection must be a real normalized
 * document.  Content callers receive the same verified artifact.
 */
export function resolveVerifiedManagedBaseline(
	input: ManagedMergeBaselineInput,
	expectedNormalizationVersion: string,
	options: { requireProjection: boolean },
): ManagedBaselineArtifact | { normalizationVersion: string } {
	const managedProjection = resolveManagedBaselineCore(input, expectedNormalizationVersion);
	if (!options.requireProjection) {
		return { normalizationVersion: input.releaseSchemaVersion! };
	}
	if (!input.managedProjection || isStructurallyEmpty(input.managedProjection)) {
		return fail(
			'missing_provenance',
			'Managed projection content was not loaded for reconciliation.',
		);
	}
	return {
		managedProjection,
		normalizationVersion: input.releaseSchemaVersion!,
	};
}

/**
 * Establish the managed common ancestor from durable identity and revision evidence only.
 * Timestamps are compared as opaque optimistic-concurrency tokens, never ordered as freshness.
 */
export function resolveManagedMergeBaseline(
	input: ManagedMergeBaselineInput,
): Record<string, unknown> {
	const managedProjection = resolveManagedBaselineCore(input);
	if (input.latestMutationReceipt?.status === 'partial') {
		return fail('partial_previous_operation', 'A prior mutation remains partially applied.');
	}
	if (input.currentDraftUpdatedAt !== input.appliedDraftUpdatedAt) {
		const editorOrigin = input.latestMutationReceipt?.origin;
		return fail(
			editorOrigin === 'editor' || editorOrigin === 'legacy_dashboard'
				? 'editor_mutation_after_baseline'
				: 'manual_or_unmanaged_drift',
			'Draft revision differs from the revision produced by the managed operation.',
		);
	}
	if (!publicationMatches(input)) {
		return fail(
			'publication_after_baseline',
			'Published version or projection differs from the managed operation evidence.',
		);
	}
	if (
		input.latestMutationReceipt?.commandKind === 'managed_invitation_apply' &&
		input.latestMutationReceipt.operationId !== input.appliedOperationId &&
		input.latestMutationReceipt.status !== 'not_applied'
	) {
		return fail(
			'stale_provenance',
			'A newer managed operation is not represented by provenance.',
		);
	}

	return managedProjection;
}

/**
 * Pure evaluator checking whether a given baseline input satisfies the strict
 * Phase 2 release provenance contract (correct schema version, complete identity,
 * matching durable receipt, and provenance_recorded completed step).
 */
export function isVerifiedManagedReleaseProvenance(
	input: ManagedMergeBaselineInput,
	expectedNormalizationVersion: string = RELEASE_SCHEMA_VERSION,
): boolean {
	try {
		resolveVerifiedManagedBaseline(input, expectedNormalizationVersion, {
			requireProjection: false,
		});
		return true;
	} catch {
		return false;
	}
}
