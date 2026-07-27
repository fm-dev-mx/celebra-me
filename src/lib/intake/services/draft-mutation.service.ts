/**
 * Shared server-only draft mutation path for editor and managed CLI.
 * Every write declares an expected draft revision and applies a semantic patch.
 */

import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	InvitationEditorSectionSchemas,
	type InvitationEditorSectionKey,
} from '@/lib/intake/schemas/invitation-editor.schema';
import { InvitationContentDraftContentSchema } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { applySectionValue } from '@/lib/intake/services/section-content-mapper';
import type { InvitationContentDraft } from '@/lib/intake/types';
import { ApiError } from '@/lib/rsvp/core/errors';

export type DraftMutationActor = 'editor' | 'cli' | 'agent';

export class DraftRevisionConflictError extends Error {
	readonly code = 'draft_revision_conflict';

	constructor(
		message: string,
		readonly currentDraftUpdatedAt: string | null,
	) {
		super(message);
		this.name = 'DraftRevisionConflictError';
	}
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
	const tokens: Array<string | number> = [];
	const regex = /([^.[\]]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) tokens.push(match[1]);
		else if (match[2] !== undefined) tokens.push(Number(match[2]));
	}
	if (tokens.length === 0) return;

	let current: Record<string | number, unknown> = target;
	for (let i = 0; i < tokens.length - 1; i++) {
		const token = tokens[i]!;
		const nextToken = tokens[i + 1]!;
		if (current[token] === undefined || current[token] === null) {
			current[token] = typeof nextToken === 'number' ? [] : {};
		}
		current = current[token] as Record<string | number, unknown>;
	}
	current[tokens[tokens.length - 1]!] = value;
}

function cloneContent(content: Record<string, unknown>): Record<string, unknown> {
	return JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
}

function validateResultingContent(content: Record<string, unknown>): Record<string, unknown> {
	const draftParsed = InvitationContentDraftContentSchema.safeParse(content);
	if (!draftParsed.success) {
		throw new ApiError(422, 'bad_request', 'El contenido del borrador no es válido.', {
			issues: draftParsed.error.issues,
		});
	}

	return content;
}

export type DraftMutationPatch =
	| { kind: 'section'; section: InvitationEditorSectionKey; value: unknown }
	| { kind: 'fields'; fields: Array<{ path: string; value: unknown }> }
	| { kind: 'document'; content: Record<string, unknown> };

export interface ApplyDraftMutationInput {
	invitationId: string;
	expectedDraftUpdatedAt: string | null;
	patch: DraftMutationPatch;
	actor: DraftMutationActor;
	/** When true, skip draft-schema soft failures already handled by section Zod. */
	skipDocumentSchema?: boolean;
}

export interface ApplyDraftMutationResult {
	draft: InvitationContentDraft;
	draftUpdatedAt: string;
	actor: DraftMutationActor;
}

/**
 * Apply a semantic draft mutation with optimistic concurrency on updated_at.
 */
export async function applyDraftMutation(
	input: ApplyDraftMutationInput,
): Promise<ApplyDraftMutationResult> {
	const [draft, published] = await Promise.all([
		findDraftByInvitationId(input.invitationId),
		findPublishedByInvitationId(input.invitationId),
	]);

	const currentUpdatedAt = draft?.updatedAt ?? null;
	if (draft) {
		if (!input.expectedDraftUpdatedAt) {
			throw new DraftRevisionConflictError(
				'Se requiere la revisión del borrador esperada.',
				currentUpdatedAt,
			);
		}
		if (draft.updatedAt !== input.expectedDraftUpdatedAt) {
			throw new DraftRevisionConflictError(
				'El borrador cambió desde la revisión esperada. Recarga y vuelve a intentar.',
				currentUpdatedAt,
			);
		}
	}
	// When no draft exists, create via upsert; client-supplied expected revision is ignored.

	const baseline = cloneContent(
		(draft?.content as Record<string, unknown> | undefined) ??
			(published?.content as Record<string, unknown> | undefined) ??
			{},
	);

	let nextContent: Record<string, unknown>;

	if (input.patch.kind === 'section') {
		const valueResult = InvitationEditorSectionSchemas[input.patch.section].safeParse(
			input.patch.value,
		);
		if (!valueResult.success) {
			throw new ApiError(422, 'bad_request', 'Revisa los campos marcados antes de guardar.', {
				issues: valueResult.error.issues,
			});
		}
		nextContent = applySectionValue(baseline, input.patch.section, valueResult.data);
	} else if (input.patch.kind === 'fields') {
		nextContent = cloneContent(baseline);
		for (const field of input.patch.fields) {
			setPathValue(nextContent, field.path, field.value);
		}
	} else {
		nextContent = cloneContent(input.patch.content);
	}

	if (!input.skipDocumentSchema) {
		validateResultingContent(nextContent);
	}

	const savedDraft = draft
		? await updateDraftContentConditionally(draft.id, input.expectedDraftUpdatedAt!, {
				content: nextContent,
				status: 'draft',
			})
		: await upsertDraft({
				invitationId: input.invitationId,
				submissionId: null,
				content: nextContent,
			});

	if (!savedDraft) {
		const latest = await findDraftByInvitationId(input.invitationId);
		throw new DraftRevisionConflictError(
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
			latest?.updatedAt ?? null,
		);
	}

	return {
		draft: savedDraft,
		draftUpdatedAt: savedDraft.updatedAt,
		actor: input.actor,
	};
}
