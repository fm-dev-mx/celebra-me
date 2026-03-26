import { useCallback, useEffect, useState } from 'react';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { CreateClaimCodeDTO, UpdateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';
import type { EventListItemDTO } from '@/lib/dashboard/dto/events';

export function useClaimCodesAdmin() {
	const [items, setItems] = useState<ClaimCodeDTO[]>([]);
	const [events, setEvents] = useState<EventListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [lastPlainCode, setLastPlainCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [eventsLoading, setEventsLoading] = useState(false);

	const loadClaimCodes = useCallback(async () => {
		setError('');
		setLoading(true);
		try {
			const result = await adminApi.listClaimCodes();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	const loadEvents = useCallback(async () => {
		setEventsLoading(true);
		setError('');
		try {
			const result = await adminApi.listEvents();
			setEvents(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'No se pudieron cargar los eventos.');
		} finally {
			setEventsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadClaimCodes();
		void loadEvents();
	}, [loadClaimCodes, loadEvents]);

	const createClaimCode = useCallback(
		async (payload: CreateClaimCodeDTO) => {
			setError('');
			try {
				const result = await adminApi.createClaimCode(payload);
				setLastPlainCode(result.plainCode);
				await loadClaimCodes();
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'No se pudo crear el código de acceso.',
				);
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
				throw new Error(
					err instanceof Error
						? err.message
						: 'No se pudo actualizar el código de acceso.',
				);
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
				throw new Error(
					err instanceof Error
						? err.message
						: 'No se pudo desactivar el código de acceso.',
				);
			}
		},
		[loadClaimCodes],
	);

	return {
		items,
		events,
		error,
		lastPlainCode,
		loading,
		eventsLoading,
		createClaimCode,
		updateClaimCode,
		disableClaimCode,
		reloadClaimCodes: loadClaimCodes,
		reloadEvents: loadEvents,
	};
}
