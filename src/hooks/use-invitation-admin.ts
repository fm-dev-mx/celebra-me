import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	InvitationDTO,
	InvitationListItemDTO,
	InvitationContentDraftDTO,
	UpdateInvitationDTO,
	RsvpEventDTO,
} from '@/lib/dashboard/dto/intake';

export interface UseInvitationAdminOptions {
	autoLoad?: boolean;
}

export function useInvitationAdmin({ autoLoad = false }: UseInvitationAdminOptions = {}) {
	const [items, setItems] = useState<InvitationListItemDTO[]>([]);
	const [canReviewManually, setCanReviewManually] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [currentInvitation, setCurrentInvitation] = useState<InvitationDTO | null>(null);
	const [currentRsvpEvent, setCurrentRsvpEvent] = useState<RsvpEventDTO | null>(null);
	const [currentDraft, setCurrentDraft] = useState<InvitationContentDraftDTO | null>(null);

	const loadInvitations = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listInvitations();
			setItems(result.items);
			setCanReviewManually(result.canReviewManually);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (autoLoad) {
			void loadInvitations();
		}
	}, [autoLoad, loadInvitations]);

	const updateInvitation = useCallback(
		async (invitationId: string, payload: UpdateInvitationDTO) => {
			try {
				const baseline =
					currentInvitation?.id === invitationId
						? currentInvitation
						: (await adminApi.getInvitation(invitationId)).item;
				const item = await adminApi.updateInvitation(
					invitationId,
					payload,
					baseline.updatedAt,
				);
				setCurrentInvitation(item);
				await loadInvitations();
				return item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al actualizar la invitación.',
					{ cause: err },
				);
			}
		},
		[currentInvitation, loadInvitations],
	);

	const loadInvitationDetail = useCallback(async (invitationId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getInvitation(invitationId);
			setCurrentInvitation(result.item);
			setCurrentRsvpEvent(result.rsvpEvent ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar la invitación.');
		} finally {
			setLoading(false);
		}
	}, []);

	const loadDraft = useCallback(async (invitationId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getDraft(invitationId);
			setCurrentDraft(result.draft);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar el borrador.');
		} finally {
			setLoading(false);
		}
	}, []);

	const updateDraft = useCallback(
		async (invitationId: string, content: Record<string, unknown>) => {
			setSaving(true);
			setError('');
			try {
				const baseline =
					currentDraft?.invitationId === invitationId
						? currentDraft
						: (await adminApi.getDraft(invitationId)).draft;
				if (!baseline) throw new Error('No se encontró un borrador para guardar.');
				const result = await adminApi.updateDraftContent(
					invitationId,
					content,
					baseline.updatedAt,
				);
				setCurrentDraft(result.draft);
				return result.draft;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al guardar el borrador.',
					{
						cause: err,
					},
				);
			} finally {
				setSaving(false);
			}
		},
		[currentDraft],
	);

	const publishDraftAction = useCallback(async (invitationId: string) => {
		setSaving(true);
		setError('');
		try {
			const result = await adminApi.publishDraft(invitationId);
			setCurrentDraft(result.draft);
			return result;
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al publicar el borrador.', {
				cause: err,
			});
		} finally {
			setSaving(false);
		}
	}, []);

	const createDraftRevision = useCallback(async (invitationId: string) => {
		setSaving(true);
		setError('');
		try {
			const result = await adminApi.createDraftRevision(invitationId);
			setCurrentDraft(result.draft);
			return result.draft;
		} catch (err) {
			throw new Error(
				err instanceof Error ? err.message : 'Error al crear la nueva revisión.',
				{ cause: err },
			);
		} finally {
			setSaving(false);
		}
	}, []);

	const archiveInvitation = useCallback(
		async (invitationId: string) => {
			await adminApi.archiveInvitation(invitationId);
			await loadInvitations();
		},
		[loadInvitations],
	);

	const restoreInvitation = useCallback(
		async (invitationId: string) => {
			await adminApi.restoreInvitation(invitationId);
			await loadInvitations();
		},
		[loadInvitations],
	);

	const permanentlyDeleteInvitation = useCallback(
		async (invitationId: string) => {
			await adminApi.permanentlyDeleteInvitation(invitationId);
			await loadInvitations();
		},
		[loadInvitations],
	);

	return {
		items,
		canReviewManually,
		error,
		loading,
		saving,
		currentInvitation,
		currentRsvpEvent,
		currentDraft,
		updateInvitation,
		loadInvitationDetail,
		loadDraft,
		updateDraft,
		publishDraft: publishDraftAction,
		createDraftRevision,
		reloadInvitations: loadInvitations,
		archiveInvitation,
		restoreInvitation,
		permanentlyDeleteInvitation,
	};
}
