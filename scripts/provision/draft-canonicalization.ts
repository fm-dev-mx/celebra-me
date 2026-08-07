/**
 * Draft canonicalization planner.
 *
 * Converts a persisted hybrid draft (raw published structures stored as a draft
 * baseline before the seeding fix) into the canonical flat `DraftContent`
 * contract. The plan is content-only, generic across invitations, and proves the
 * repair is semantics-preserving before any write is attempted.
 */
import { createHash } from 'node:crypto';

import { ALL_EDITOR_KEYS } from '../../src/lib/intake/constants.ts';
import { getEditorSectionForPublishedPath } from '../../src/lib/intake/invitation-section-registry.ts';
import { InvitationContentDraftContentSchema } from '../../src/lib/intake/schemas/invitation-content-draft.schema.ts';
import {
	canonicalizeDraftContent,
	mapNestedToDraftContent,
} from '../../src/lib/intake/services/draft-content-mapper.ts';
import { computeEffectiveContent } from '../../src/lib/intake/services/merge-content.service.ts';
import { canonicalizePublicationValue } from '../../src/lib/intake/services/publication-canonicalize.ts';
import { canonicalize } from './normalized-invitation-release.ts';
import { deriveRominaReceiptOperationId, deriveStableOperationId } from './romina-shared-helpers.ts';

export const DRAFT_CANONICALIZATION_OPERATION_TYPE = 'draft_canonicalization' as const;

export type DraftCanonicalizationTarget = 'local' | 'preview' | 'production';

type JsonRecord = Record<string, unknown>;

export interface DraftCanonicalizationInput {
	target: DraftCanonicalizationTarget;
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord | null;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
}

export interface PendingSection {
	sectionKey: string;
	sectionLabel: string;
}

export interface DraftCanonicalizationPlan {
	schemaVersion: 'draft-canonicalization-v1';
	target: DraftCanonicalizationTarget;
	slug: string;
	mode: 'dry-run';
	writes: 0;
	alreadyCanonical: boolean;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
	/** Draft document paths rewritten by canonicalization. */
	structuralChangedPaths: string[];
	/** Published-only keys removed from the persisted draft. */
	removedPublishedOnlyKeys: string[];
	/** Intentional draft edits vs published, which the repair must preserve. */
	preservedDraftChanges: string[];
	/**
	 * Editor sections whose effective content differs from the published content
	 * flattened through the canonical read mapper. This is a draft-side view, not
	 * the publish preflight: `effectiveContentUnchanged` is what guarantees the
	 * real preflight is identical before and after the repair.
	 */
	draftDivergenceSections: PendingSection[];
	/** Effective (editor/preview/publish) content must be identical before and after. */
	effectiveContentUnchanged: boolean;
	effectiveChangedPaths: string[];
	hashes: { draftBefore: string; draftAfter: string; published: string };
	afterContent: JsonRecord;
	operationFingerprint: string;
	operationId: string;
	receiptOperationId: string;
}

function hash(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function changedPaths(before: unknown, after: unknown, path = ''): string[] {
	if (canonicalize(before) === canonicalize(after)) return [];
	const bothArrays = Array.isArray(before) && Array.isArray(after);
	const bothObjects =
		!bothArrays &&
		before !== null &&
		after !== null &&
		typeof before === 'object' &&
		typeof after === 'object' &&
		!Array.isArray(before) &&
		!Array.isArray(after);

	if (bothArrays) {
		const length = Math.max(before.length, after.length);
		return Array.from({ length }, (_, index) =>
			changedPaths(before[index], after[index], `${path}[${index}]`),
		).flat();
	}
	if (bothObjects) {
		const keys = new Set([
			...Object.keys(before as JsonRecord),
			...Object.keys(after as JsonRecord),
		]);
		return [...keys]
			.sort()
			.flatMap((key) =>
				changedPaths(
					(before as JsonRecord)[key],
					(after as JsonRecord)[key],
					path ? `${path}.${key}` : key,
				),
			);
	}
	return [path || '$'];
}

/**
 * Editor sections whose effective content differs from the published baseline.
 * Needs no publish context, so it is usable from an operator script.
 */
function collectDivergentSections(
	draftContent: JsonRecord,
	publishedContent: JsonRecord,
): PendingSection[] {
	const effective = computeEffectiveContent(draftContent, publishedContent) as JsonRecord;
	const publishedFlat = mapNestedToDraftContent(publishedContent) as JsonRecord;
	const seen = new Map<string, PendingSection>();

	for (const key of ALL_EDITOR_KEYS) {
		const left = canonicalizePublicationValue(effective[key]);
		const right = canonicalizePublicationValue(publishedFlat[key]);
		if (JSON.stringify(left ?? null) === JSON.stringify(right ?? null)) continue;
		const section = getEditorSectionForPublishedPath(key);
		const sectionKey = section?.id ?? key;
		if (seen.has(sectionKey)) continue;
		seen.set(sectionKey, { sectionKey, sectionLabel: section?.label ?? key });
	}
	return [...seen.values()].sort((left, right) => left.sectionKey.localeCompare(right.sectionKey));
}

export function buildDraftCanonicalizationPlan(
	input: DraftCanonicalizationInput,
): DraftCanonicalizationPlan {
	if (!input.publishedContent) {
		throw new Error(
			'DRAFT_CANONICALIZATION_PUBLISHED_MISSING: a published revision is required to verify the repair.',
		);
	}
	const published = input.publishedContent;
	const before = input.draftContent;

	const canonical = canonicalizeDraftContent(before);
	if (canonical.issues.length > 0) {
		const detail = canonical.issues
			.map((issue) => `${issue.path} (${issue.reason}: ${issue.detail})`)
			.join('; ');
		throw new Error(`DRAFT_CANONICALIZATION_UNSUPPORTED_DATA: ${detail}`);
	}
	const after = canonical.content as JsonRecord;

	const parsed = InvitationContentDraftContentSchema.safeParse(after);
	if (!parsed.success) {
		throw new Error(`DRAFT_CANONICALIZATION_RESULT_INVALID: ${parsed.error.message}`);
	}

	// The canonical repair rewrites the persisted document only. Everything the
	// editor, preview and publish consume is derived from the effective content,
	// so it must be byte-identical: that is the proof of "no unrelated changes".
	const effectiveBefore = computeEffectiveContent(before, published);
	const effectiveAfter = computeEffectiveContent(after, published);
	const effectiveChangedPaths = changedPaths(effectiveBefore, effectiveAfter);
	if (effectiveChangedPaths.length > 0) {
		throw new Error(
			`DRAFT_CANONICALIZATION_SEMANTIC_DRIFT: ${effectiveChangedPaths.join(', ')}`,
		);
	}

	// Idempotency is a precondition of the write, not an assumption.
	const secondPass = canonicalizeDraftContent(after);
	if (canonicalize(secondPass.content) !== canonicalize(after)) {
		throw new Error('DRAFT_CANONICALIZATION_NOT_IDEMPOTENT: second pass changed the document.');
	}

	const publishedHash = hash(published);
	const afterHash = hash(after);
	const operationFingerprint = hash({
		schemaVersion: 'draft-canonicalization-v1',
		target: input.target,
		slug: input.slug,
		afterHash,
		publishedHash,
		publishedVersion: input.publishedVersion,
	});
	const operationId = deriveStableOperationId({
		operationType: DRAFT_CANONICALIZATION_OPERATION_TYPE,
		targetEnv: input.target,
		scope: input.slug,
		manifestFingerprint: operationFingerprint,
	});

	return {
		schemaVersion: 'draft-canonicalization-v1',
		target: input.target,
		slug: input.slug,
		mode: 'dry-run',
		writes: 0,
		alreadyCanonical: !canonical.changed,
		draftStatus: input.draftStatus,
		draftUpdatedAt: input.draftUpdatedAt,
		publishedVersion: input.publishedVersion,
		structuralChangedPaths: changedPaths(before, after).sort(),
		removedPublishedOnlyKeys: canonical.removedPublishedOnlyKeys,
		preservedDraftChanges: changedPaths(
			mapNestedToDraftContent(published),
			effectiveAfter,
		).sort(),
		draftDivergenceSections: collectDivergentSections(after, published),
		effectiveContentUnchanged: true,
		effectiveChangedPaths,
		hashes: { draftBefore: hash(before), draftAfter: afterHash, published: publishedHash },
		afterContent: after,
		operationFingerprint,
		operationId,
		receiptOperationId: deriveRominaReceiptOperationId(operationId),
	};
}

/** Read-only post-apply verification against the freshly re-read database state. */
export function verifyDraftCanonicalizationOutcome(
	plan: DraftCanonicalizationPlan,
	draftContent: JsonRecord,
	publishedContent: JsonRecord,
): void {
	if (hash(publishedContent) !== plan.hashes.published) {
		throw new Error(
			'DRAFT_CANONICALIZATION_PUBLISHED_CHANGED: published content changed during the repair.',
		);
	}
	if (hash(draftContent) !== plan.hashes.draftAfter) {
		throw new Error(
			'DRAFT_CANONICALIZATION_RESULT_MISMATCH: stored draft differs from the approved canonical document.',
		);
	}
	const recheck = canonicalizeDraftContent(draftContent);
	if (recheck.issues.length > 0 || recheck.changed) {
		throw new Error(
			'DRAFT_CANONICALIZATION_RESULT_NOT_CANONICAL: stored draft is still not canonical.',
		);
	}
}
