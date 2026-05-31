import { useCallback, useEffect, useState } from 'react';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { CreateClaimCodeDTO, UpdateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

interface ProjectOption {
	id: string;
	title: string;
	eventType: string;
	rsvpEventId: string | null;
}

function toProjectOption(invitation: InvitationDTO): ProjectOption {
	return {
		id: invitation.id,
		title: invitation.title,
		eventType: invitation.eventType,
		rsvpEventId: invitation.rsvpEventId,
	};
}

export function useClaimCodesAdmin() {
	const [items, setItems] = useState<ClaimCodeDTO[]>([]);
	const [invitations, setProjects] = useState<ProjectOption[]>([]);
	const [error, setError] = useState('');
	const [lastPlainCode, setLastPlainCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [invitationsLoading, setInvitationsLoading] = useState(false);

	const loadClaimCodes = useCallback(async () => {
		setError('');
		setLoading(true);
		try {
			const result = await adminApi.listClaimCodes();
			setItems(result.items);
		} catch (err) {
			setError(toErrorMessage(err, 'Error inesperado.'));
		} finally {
			setLoading(false);
		}
	}, []);

	const loadInvitations = useCallback(async () => {
		setInvitationsLoading(true);
		setError('');
		try {
			const result = await adminApi.listInvitations();
			setProjects(result.items.map(toProjectOption));
		} catch (err) {
			setError(toErrorMessage(err, 'No se pudieron cargar las invitaciones.'));
		} finally {
			setInvitationsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadClaimCodes();
		void loadInvitations();
	}, [loadClaimCodes, loadInvitations]);

	const createClaimCode = useCallback(
		async (payload: CreateClaimCodeDTO) => {
			setError('');
			try {
				const result = await adminApi.createClaimCode(payload);
				setLastPlainCode(result.plainCode);
				await loadClaimCodes();
			} catch (err) {
				throw new Error(toErrorMessage(err, 'No se pudo crear el código de acceso.'), {
					cause: err,
				});
			}
		},
		[loadClaimCodes],
	);

	const updateClaimCode = useCallback(
		async (claimCodeId: string, payload: UpdateClaimCodeDTO) => {
			setError('');
			try {
				await adminApi.updateClaimCode(claimCodeId, payload);
				await loadClaimCodes();
			} catch (err) {
				throw new Error(toErrorMessage(err, 'No se pudo actualizar el código de acceso.'), {
					cause: err,
				});
			}
		},
		[loadClaimCodes],
	);

	const disableClaimCode = useCallback(
		async (claimCodeId: string) => {
			setError('');
			try {
				await adminApi.disableClaimCode(claimCodeId);
				await loadClaimCodes();
			} catch (err) {
				throw new Error(toErrorMessage(err, 'No se pudo desactivar el código de acceso.'), {
					cause: err,
				});
			}
		},
		[loadClaimCodes],
	);

	return {
		items,
		invitations,
		error,
		lastPlainCode,
		loading,
		invitationsLoading,
		createClaimCode,
		updateClaimCode,
		disableClaimCode,
		reloadClaimCodes: loadClaimCodes,
		reloadInvitations: loadInvitations,
	};
}
