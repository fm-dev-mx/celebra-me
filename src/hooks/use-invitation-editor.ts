import { useCallback, useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	InvitationEditorContextDTO,
	InvitationEditorSectionSaveResponse,
} from '@/lib/dashboard/dto/intake';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

export function useInvitationEditor(initialContext: InvitationEditorContextDTO) {
	const [context, setContext] = useState(initialContext);
	const [savingSection, setSavingSection] = useState<
		InvitationEditorSectionKey | 'metadata' | null
	>(null);
	const [publishing, setPublishing] = useState(false);
	const [reconciling, setReconciling] = useState(false);
	const [restoring, setRestoring] = useState(false);

	const reload = useCallback(async () => {
		const nextContext = await adminApi.getInvitationEditor(initialContext.invitation.id);
		setContext(nextContext);
		return nextContext;
	}, [initialContext.invitation.id]);

	const saveSection = useCallback(
		async (
			section: InvitationEditorSectionKey,
			value: unknown,
			overrideExpectedUpdatedAt?: string,
		): Promise<InvitationEditorSectionSaveResponse> => {
			setSavingSection(section);
			try {
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
			} finally {
				setSavingSection(null);
			}
		},
		[context.draftUpdatedAt, context.invitation.id, context.invitation.updatedAt],
	);

	const saveMetadata = useCallback(
		async (
			value: Parameters<typeof adminApi.updateInvitationEditorMetadata>[1]['value'],
			overrideExpectedUpdatedAt?: string,
		) => {
			setSavingSection('metadata');
			try {
				const expectedUpdatedAt = overrideExpectedUpdatedAt ?? context.invitation.updatedAt;
				const result = await adminApi.updateInvitationEditorMetadata(
					context.invitation.id,
					{ expectedUpdatedAt, value },
				);
				setContext((current) => ({ ...current, invitation: result.invitation }));
				return result.invitation;
			} finally {
				setSavingSection(null);
			}
		},
		[context.invitation.id, context.invitation.updatedAt],
	);

	const publish = useCallback(async () => {
		setPublishing(true);
		try {
			const result = await adminApi.publishInvitationEditor(context.invitation.id);
			setContext(result.context);
			return result.context;
		} finally {
			setPublishing(false);
		}
	}, [context.invitation.id]);

	const reconcileRsvp = useCallback(async () => {
		setReconciling(true);
		try {
			const rsvpLink = await adminApi.reconcileInvitationEditorRsvp(context.invitation.id);
			setContext((current) => ({ ...current, rsvpLink }));
			return rsvpLink;
		} finally {
			setReconciling(false);
		}
	}, [context.invitation.id]);

	const restorePublished = useCallback(async () => {
		setRestoring(true);
		try {
			const expectedUpdatedAt = context.draftUpdatedAt ?? context.invitation.updatedAt;
			const result = await adminApi.restoreInvitationEditorFromPublished(
				context.invitation.id,
				expectedUpdatedAt,
			);
			setContext(result.context);
			return result.context;
		} finally {
			setRestoring(false);
		}
	}, [context.draftUpdatedAt, context.invitation.id, context.invitation.updatedAt]);

	return {
		context,
		publishing,
		reconciling,
		restoring,
		reload,
		saveMetadata,
		saveSection,
		savingSection,
		publish,
		reconcileRsvp,
		restorePublished,
	};
}
