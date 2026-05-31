import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	InvitationDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	InvitationContentDraftDTO,
	CreateInvitationDTO,
	UpdateInvitationDTO,
	CreateIntakeRequestDTO,
} from '@/lib/dashboard/dto/intake';

export function useInvitationAdmin() {
	const [items, setItems] = useState<InvitationDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [currentInvitation, setCurrentInvitation] = useState<InvitationDTO | null>(null);
	const [currentRequest, setCurrentRequest] = useState<IntakeRequestDTO | null>(null);
	const [currentSubmission, setCurrentSubmission] = useState<IntakeSubmissionDTO | null>(null);
	const [currentRsvpEvent, setCurrentRsvpEvent] = useState<
		import('@/lib/dashboard/dto/intake').RsvpEventDTO | null
	>(null);
	const [currentDraft, setCurrentDraft] = useState<InvitationContentDraftDTO | null>(null);
	const [rawToken, setRawToken] = useState<string | null>(null);

	const loadInvitations = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listInvitations();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadInvitations();
	}, [loadInvitations]);

	const createInvitation = useCallback(
		async (payload: CreateInvitationDTO) => {
			try {
				const item = await adminApi.createInvitation(payload);
				await loadInvitations();
				return item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al crear el invitación.',
					{ cause: err },
				);
			}
		},
		[loadInvitations],
	);

	const updateInvitation = useCallback(
		async (invitationId: string, payload: UpdateInvitationDTO) => {
			try {
				const item = await adminApi.updateInvitation(invitationId, payload);
				setCurrentInvitation(item);
				await loadInvitations();
				return item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al actualizar el invitación.',
					{ cause: err },
				);
			}
		},
		[loadInvitations],
	);

	const duplicateInvitationFromDemo = useCallback(
		async (
			invitationId: string,
			payload: Pick<
				CreateInvitationDTO,
				'title' | 'clientName' | 'clientEmail' | 'clientWhatsapp'
			>,
		) => {
			const item = await adminApi.duplicateInvitationFromDemo(invitationId, payload);
			await loadInvitations();
			return item;
		},
		[loadInvitations],
	);

	const loadInvitationDetail = useCallback(async (invitationId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getInvitation(invitationId);
			setCurrentInvitation(result.item);
			setCurrentRequest(result.request);
			setCurrentSubmission(result.submission);
			setCurrentRsvpEvent(result.rsvpEvent ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar el invitación.');
		} finally {
			setLoading(false);
		}
	}, []);

	const createIntakeRequest = useCallback(
		async (invitationId: string, payload: CreateIntakeRequestDTO) => {
			try {
				const result = await adminApi.createIntakeRequest(invitationId, payload);
				setCurrentRequest(result.request);
				setRawToken(result.rawToken);
				await loadInvitationDetail(invitationId);
				return result;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al crear la solicitud de intake.',
					{ cause: err },
				);
			}
		},
		[loadInvitationDetail],
	);

	const regenerateToken = useCallback(async (invitationId: string) => {
		try {
			const result = await adminApi.regenerateIntakeToken(invitationId);
			setCurrentRequest(result.request);
			setRawToken(result.rawToken);
			return result;
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al regenerar el token.', {
				cause: err,
			});
		}
	}, []);

	const revokeToken = useCallback(async (invitationId: string) => {
		try {
			const result = await adminApi.revokeIntakeToken(invitationId);
			setCurrentRequest(result.request);
			setRawToken(null);
			return result;
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al revocar el enlace.', {
				cause: err,
			});
		}
	}, []);

	const loadSubmissionForReview = useCallback(async (invitationId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getSubmissionForReview(invitationId);
			setCurrentInvitation(result.item);
			setCurrentRequest(result.request);
			setCurrentSubmission(result.submission);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar la captura.');
		} finally {
			setLoading(false);
		}
	}, []);

	const reviewSubmission = useCallback(
		async (
			invitationId: string,
			action: 'approve' | 'request_changes',
			reviewNotes?: string,
		) => {
			try {
				await adminApi.reviewSubmission(invitationId, { action, reviewNotes });
				await loadSubmissionForReview(invitationId);
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al revisar la captura.',
					{ cause: err },
				);
			}
		},
		[loadSubmissionForReview],
	);

	const saveSubmissionCorrections = useCallback(
		async (
			invitationId: string,
			payload: { blockData: Record<string, unknown>; clientComments: string },
		) => {
			try {
				const result = await adminApi.updateSubmissionCorrections(invitationId, payload);
				setCurrentSubmission(result.item);
				return result.item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al guardar las correcciones.',
					{ cause: err },
				);
			}
		},
		[],
	);

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

	const generateDraftAction = useCallback(async (invitationId: string) => {
		try {
			const result = await adminApi.generateDraft(invitationId);
			setCurrentDraft(result.draft);
			return result.draft;
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al generar el borrador.', {
				cause: err,
			});
		}
	}, []);

	const updateDraft = useCallback(
		async (invitationId: string, content: Record<string, unknown>) => {
			setSaving(true);
			setError('');
			try {
				const result = await adminApi.updateDraftContent(invitationId, content);
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
		[],
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
		error,
		loading,
		saving,
		currentInvitation,
		currentRequest,
		currentSubmission,
		currentRsvpEvent,
		currentDraft,
		rawToken,
		setRawToken,
		createInvitation,
		updateInvitation,
		duplicateInvitationFromDemo,
		loadInvitationDetail,
		createIntakeRequest,
		regenerateToken,
		revokeToken,
		loadSubmissionForReview,
		reviewSubmission,
		saveSubmissionCorrections,
		loadDraft,
		generateDraft: generateDraftAction,
		updateDraft,
		publishDraft: publishDraftAction,
		createDraftRevision,
		reloadInvitations: loadInvitations,
		archiveInvitation,
		restoreInvitation,
		permanentlyDeleteInvitation,
	};
}
