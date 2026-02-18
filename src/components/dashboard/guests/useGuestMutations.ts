import { useState, useCallback } from 'react';
import { dashboardApi } from '@/lib/dashboard/apiClient';
import type { DashboardGuestItem } from './types';

interface UseGuestMutationsOptions {
	eventId: string;
	onSuccess?: (message: string) => void;
	onError?: (message: string) => void;
	onRefresh?: () => Promise<void>;
}

interface UseGuestMutationsReturn {
	loading: boolean;
	createGuest: (payload: CreateGuestPayload) => Promise<DashboardGuestItem | null>;
	updateGuest: (
		guestId: string,
		payload: UpdateGuestPayload,
	) => Promise<DashboardGuestItem | null>;
	deleteGuest: (guestId: string) => Promise<boolean>;
	markShared: (guestId: string) => Promise<boolean>;
}

interface CreateGuestPayload {
	fullName: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	attendeeCount?: number;
	guestMessage?: string;
	tags?: string[];
}

interface UpdateGuestPayload {
	fullName?: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	attendeeCount?: number;
	guestMessage?: string;
	tags?: string[];
}

export function useGuestMutations({
	eventId,
	onSuccess,
	onError,
	onRefresh,
}: UseGuestMutationsOptions): UseGuestMutationsReturn {
	const [loading, setLoading] = useState(false);

	const createGuest = useCallback(
		async (payload: CreateGuestPayload): Promise<DashboardGuestItem | null> => {
			setLoading(true);
			try {
				const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
					'/api/dashboard/guests',
					{ eventId, ...payload },
				);

				if (!result.ok) {
					throw new Error(result.message || `Error ${result.status}`);
				}

				onRefresh?.();
				onSuccess?.(`Invitado ${result.data.item.fullName} guardado correctamente.`);
				return result.data.item;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Error al crear invitado.';
				onError?.(message);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[eventId, onSuccess, onError, onRefresh],
	);

	const updateGuest = useCallback(
		async (
			guestId: string,
			payload: UpdateGuestPayload,
		): Promise<DashboardGuestItem | null> => {
			setLoading(true);
			try {
				const result = await dashboardApi.patch<{ item: DashboardGuestItem }>(
					`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
					payload,
				);

				if (!result.ok) {
					throw new Error(result.message || `Error ${result.status}`);
				}

				onRefresh?.();
				onSuccess?.(`Invitado ${result.data.item.fullName} actualizado correctamente.`);
				return result.data.item;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Error al actualizar invitado.';
				onError?.(message);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[onSuccess, onError, onRefresh],
	);

	const deleteGuest = useCallback(
		async (guestId: string): Promise<boolean> => {
			setLoading(true);
			try {
				const result = await dashboardApi.delete<{ message: string }>(
					`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
				);

				if (!result.ok) {
					throw new Error(result.message || `Error ${result.status}`);
				}

				onRefresh?.();
				onSuccess?.('Invitado eliminado con éxito.');
				return true;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Error al eliminar invitado.';
				onError?.(message);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[onSuccess, onError, onRefresh],
	);

	const markShared = useCallback(
		async (guestId: string): Promise<boolean> => {
			try {
				const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
					`/api/dashboard/guests/${encodeURIComponent(guestId)}/mark-shared`,
				);

				if (!result.ok) {
					throw new Error(result.message || `Error ${result.status}`);
				}

				onRefresh?.();
				onSuccess?.('¡Invitación compartida! 🎉');
				return true;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Error al actualizar estado.';
				onError?.(message);
				return false;
			}
		},
		[onSuccess, onError, onRefresh],
	);

	return {
		loading,
		createGuest,
		updateGuest,
		deleteGuest,
		markShared,
	};
}
