import { useCallback, useRef, useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	InvitationEditorContextDTO,
	InvitationEditorSectionSaveResponse,
} from '@/lib/dashboard/dto/intake';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

export type EditorOperation =
	| { type: 'idle' }
	| { type: 'loading' }
	| { type: 'saving-section'; section: InvitationEditorSectionKey | 'metadata' }
	| { type: 'publishing' }
	| { type: 'reconciling' }
	| { type: 'restoring' };

export function useInvitationEditor(initialContext: InvitationEditorContextDTO) {
	const [context, setContext] = useState(initialContext);
	const [operation, setOperation] = useState<EditorOperation>({ type: 'idle' });
	const operationRef = useRef(operation);
	const transition = (next: EditorOperation) => {
		operationRef.current = next;
		setOperation(next);
	};
	const resetOperation = () => transition({ type: 'idle' });

	async function guard<T>(op: EditorOperation, fn: () => Promise<T>): Promise<T> {
		if (operationRef.current.type !== 'idle') throw new Error('Editor is busy');
		transition(op);
		try {
			return await fn();
		} finally {
			resetOperation();
		}
	}

	const reload = useCallback(async () => {
		return guard({ type: 'loading' }, async () => {
			const nextContext = await adminApi.getInvitationEditor(initialContext.invitation.id);
			setContext(nextContext);
			return nextContext;
		});
	}, [initialContext.invitation.id]);

	const saveSection = useCallback(
		async (
			section: InvitationEditorSectionKey,
			value: unknown,
			overrideExpectedUpdatedAt?: string,
		): Promise<InvitationEditorSectionSaveResponse> => {
			return guard({ type: 'saving-section', section }, async () => {
				const expectedUpdatedAt =
					overrideExpectedUpdatedAt ??
					context.draftUpdatedAt ??
					context.invitation.updatedAt;
				const result = await adminApi.updateInvitationEditorSection(
					context.invitation.id,
					section,
					{ expectedUpdatedAt, value },
				);
				setContext((current) => ({
					...current,
					draftUpdatedAt: result.draftUpdatedAt,
					draftStatus: 'draft',
					publication: result.publication,
				}));
				return result;
			});
		},
		[context.draftUpdatedAt, context.invitation.id, context.invitation.updatedAt],
	);

	const saveMetadata = useCallback(
		async (
			value: Parameters<typeof adminApi.updateInvitationEditorMetadata>[1]['value'],
			overrideExpectedUpdatedAt?: string,
		) => {
			return guard({ type: 'saving-section', section: 'metadata' }, async () => {
				const expectedUpdatedAt = overrideExpectedUpdatedAt ?? context.invitation.updatedAt;
				const result = await adminApi.updateInvitationEditorMetadata(
					context.invitation.id,
					{ expectedUpdatedAt, value },
				);
				setContext((current) => ({ ...current, invitation: result.invitation }));
				return result.invitation;
			});
		},
		[context.invitation.id, context.invitation.updatedAt],
	);

	const publish = useCallback(async () => {
		return guard({ type: 'publishing' }, async () => {
			const result = await adminApi.publishInvitationEditor(context.invitation.id);
			setContext(result.context);
			return result.context;
		});
	}, [context.invitation.id]);

	const reconcileRsvp = useCallback(async () => {
		return guard({ type: 'reconciling' }, async () => {
			const rsvpLink = await adminApi.reconcileInvitationEditorRsvp(context.invitation.id);
			setContext((current) => ({ ...current, rsvpLink }));
			return rsvpLink;
		});
	}, [context.invitation.id]);

	const restorePublished = useCallback(async () => {
		return guard({ type: 'restoring' }, async () => {
			const expectedUpdatedAt = context.draftUpdatedAt ?? context.invitation.updatedAt;
			const result = await adminApi.restoreInvitationEditorFromPublished(
				context.invitation.id,
				expectedUpdatedAt,
			);
			setContext(result.context);
			return result.context;
		});
	}, [context.draftUpdatedAt, context.invitation.id, context.invitation.updatedAt]);

	return {
		context,
		operation,
		reload,
		saveMetadata,
		saveSection,
		publish,
		reconcileRsvp,
		restorePublished,
	};
}
