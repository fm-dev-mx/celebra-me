/**
 * Canonical draft restore — shared by editor/API and operational CLI.
 *
 * Section restore replaces one editable section from the published revision
 * (Published → flat Draft via `mapNestedToDraftContent`). Full restore replaces
 * the entire draft document the same way and, through the atomic RPC, also
 * resets public title/slug metadata. Published content is never mutated.
 */
import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { restoreInvitationFromPublishedAtomic } from '@/lib/intake/repositories/editor-atomic.repository';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { createMutationOutcome } from '@/lib/intake/mutations/outcome';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import {
	mapNestedToDraftContent,
	normalizeDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import {
	applyDraftMutation,
	DraftRevisionConflictError,
	type ApplyDraftMutationResult,
} from '@/lib/intake/services/draft-mutation.service';
import {
	applySectionToBaseline,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';
import { canonicalizePublicationValue } from '@/lib/intake/services/publication-canonicalize';
import { ApiError } from '@/lib/rsvp/core/errors';
import type { InvitationContentDraft } from '@/lib/intake/types';

export type DraftRestoreScope = { kind: 'section'; section: InvitationEditorSectionKey } | { kind: 'entire' };

export interface DraftRestorePlan {
	scope: DraftRestoreScope;
	beforeContent: DraftContent;
	afterContent: DraftContent;
	/** Draft-relative paths whose values will be discarded by the restore. */
	discardedPaths: string[];
	sectionUnchanged: boolean;
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(canonicalizePublicationValue(left) ?? null) ===
		JSON.stringify(canonicalizePublicationValue(right) ?? null)
	);
}

function changedPaths(before: unknown, after: unknown, path = ''): string[] {
	if (valuesEqual(before, after)) return [];
	const bothArrays = Array.isArray(before) && Array.isArray(after);
	const bothObjects =
		!bothArrays &&
		before !== null &&
		after !== null &&
		typeof before === 'object' &&
		typeof after === 'object';
	if (bothArrays) {
		const length = Math.max(before.length, after.length);
		return Array.from({ length }, (_, index) =>
			changedPaths(before[index], after[index], `${path}[${index}]`),
		).flat();
	}
	if (bothObjects) {
		const left = before as Record<string, unknown>;
		const right = after as Record<string, unknown>;
		return [...new Set([...Object.keys(left), ...Object.keys(right)])]
			.sort()
			.flatMap((key) =>
				changedPaths(left[key], right[key], path ? `${path}.${key}` : key),
			);
	}
	return [path || '$'];
}

/** Published nested → canonical flat Draft used as the restore source of truth. */
export function publishedToCanonicalDraft(
	publishedContent: Record<string, unknown>,
): DraftContent {
	return normalizeDraftContent(mapNestedToDraftContent(publishedContent));
}

/**
 * Pure planner: compute the draft document after restoring one section or the
 * entire document from published content. No I/O.
 */
export function planDraftRestore(input: {
	draftContent: Record<string, unknown> | null | undefined;
	publishedContent: Record<string, unknown>;
	scope: DraftRestoreScope;
}): DraftRestorePlan {
	const publishedFlat = publishedToCanonicalDraft(input.publishedContent);
	const beforeContent = input.draftContent
		? (normalizeDraftContent(input.draftContent) as DraftContent)
		: publishedFlat;

	if (input.scope.kind === 'entire') {
		return {
			scope: input.scope,
			beforeContent,
			afterContent: publishedFlat,
			discardedPaths: changedPaths(beforeContent, publishedFlat).sort(),
			sectionUnchanged: valuesEqual(beforeContent, publishedFlat),
		};
	}

	const afterContent = applySectionToBaseline(
		beforeContent,
		input.scope.section,
		publishedFlat,
	) as DraftContent;
	const beforeSection = getSectionValue(beforeContent, input.scope.section);
	const afterSection = getSectionValue(afterContent, input.scope.section);
	return {
		scope: input.scope,
		beforeContent,
		afterContent,
		discardedPaths: changedPaths(beforeSection, afterSection, input.scope.section).sort(),
		sectionUnchanged: valuesEqual(beforeSection, afterSection),
	};
}

export interface RestoreDraftSectionInput {
	invitationId: string;
	section: InvitationEditorSectionKey;
	expectedDraftUpdatedAt: string | null;
	actor?: 'editor' | 'cli' | 'agent';
}

/**
 * Replace one draft section with the published revision mapped to flat DraftContent.
 * Other draft sections are preserved. Uses optimistic concurrency on the draft row.
 */
export async function restoreDraftSection(
	input: RestoreDraftSectionInput,
): Promise<ApplyDraftMutationResult & { plan: DraftRestorePlan }> {
	const [draft, published] = await Promise.all([
		findDraftByInvitationId(input.invitationId),
		findPublishedByInvitationId(input.invitationId),
	]);
	if (!published) {
		throw new ApiError(404, 'not_found', 'No existe una versión pública para restaurar.');
	}

	const plan = planDraftRestore({
		draftContent: draft?.content as Record<string, unknown> | undefined,
		publishedContent: published.content as Record<string, unknown>,
		scope: { kind: 'section', section: input.section },
	});

	const publishedFlat = plan.afterContent;
	const sectionValue = getSectionValue(publishedFlat, input.section);

	const result = await applyDraftMutation({
		invitationId: input.invitationId,
		expectedDraftUpdatedAt: input.expectedDraftUpdatedAt,
		patch: { kind: 'section', section: input.section, value: sectionValue },
		actor: input.actor ?? 'editor',
	});

	return { ...result, plan };
}

export interface RestoreEntireDraftInput {
	invitationId: string;
	expectedDraftUpdatedAt: string | null;
	expectedInvitationUpdatedAt: string;
	commandContext: InvitationMutationCommandContext;
}

/**
 * Replace the entire draft with the published revision mapped to flat DraftContent
 * and reset public title/slug metadata via the atomic RPC. Discarded edits are
 * every unpublished draft difference. Published content is not written.
 */
export async function restoreEntireDraft(input: RestoreEntireDraftInput): Promise<{
	draft: InvitationContentDraft;
	plan: DraftRestorePlan;
	mutation: ReturnType<typeof createMutationOutcome>;
}> {
	const [invitation, draft, published] = await Promise.all([
		findInvitationById(input.invitationId),
		findDraftByInvitationId(input.invitationId),
		findPublishedByInvitationId(input.invitationId),
	]);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}
	if (!published) {
		throw new ApiError(404, 'not_found', 'No existe una versión pública para restaurar.');
	}
	if (
		invitation.updatedAt !== input.expectedInvitationUpdatedAt ||
		(draft?.updatedAt ?? null) !== input.expectedDraftUpdatedAt
	) {
		throw new DraftRevisionConflictError(
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
			draft?.updatedAt ?? null,
		);
	}

	const plan = planDraftRestore({
		draftContent: draft?.content as Record<string, unknown> | undefined,
		publishedContent: published.content as Record<string, unknown>,
		scope: { kind: 'entire' },
	});

	const atomic = await restoreInvitationFromPublishedAtomic({
		invitationId: input.invitationId,
		expectedInvitationUpdatedAt: input.expectedInvitationUpdatedAt,
		expectedDraftUpdatedAt: input.expectedDraftUpdatedAt,
		expectedPublishedId: published.id,
		expectedPublishedVersion: published.version,
		draftContent: plan.afterContent as Record<string, unknown>,
		context: input.commandContext,
	});

	return {
		draft: {
			...(draft ?? {
				id: atomic.draftId!,
				invitationId: input.invitationId,
				submissionId: null,
				createdAt: atomic.draftUpdatedAt!,
			}),
			id: atomic.draftId!,
			content: plan.afterContent as Record<string, unknown>,
			status: 'draft',
			updatedAt: atomic.draftUpdatedAt!,
		},
		plan,
		mutation: createMutationOutcome({
			operationId: input.commandContext.operationId,
			status: atomic.idempotent ? 'replayed' : 'applied',
			completedSteps: ['invitation_metadata_restored', 'draft_restored'],
			...(atomic.idempotent
				? { replayedFromOperationId: input.commandContext.operationId }
				: {}),
		}),
	};
}
