import { useCallback, useEffect, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { UpdateGuestDTO } from '@/lib/dashboard/dto/guests';

type ModalMode = 'create' | 'edit';

export interface GuestFormPayload {
	fullName: string;
	phone?: string;
	countryCode?: string;
	maxAllowedAttendees: number;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	attendeeCount?: number;
	guestComment?: string;
	tags?: string[];
}

interface NotificationPayload {
	message: string;
	type: 'info' | 'success' | 'warning';
}

interface UseGuestDashboardActionsOptions {
	eventId: string;
	items: DashboardGuestItem[];
	loadGuests: () => Promise<void>;
	setItems: React.Dispatch<React.SetStateAction<DashboardGuestItem[]>>;
}

export const useGuestDashboardActions = ({
	eventId,
	items,
	loadGuests,
	setItems,
}: UseGuestDashboardActionsOptions) => {
	const [modalOpen, setModalOpen] = useState(false);
	const [importModalOpen, setImportModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<ModalMode>('create');
	const [editingGuest, setEditingGuest] = useState<DashboardGuestItem | null>(null);
	const [notification, setNotification] = useState<NotificationPayload | null>(null);
	const [shareSessionCount, setShareSessionCount] = useState(0);
	const [isNextActionActive, setIsNextActionActive] = useState(false);
	const [celebratingGuestId, setCelebratingGuestId] = useState<string | null>(null);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [guestToDelete, setGuestToDelete] = useState<DashboardGuestItem | null>(null);
	const [pendingAutoShareGuestId, setPendingAutoShareGuestId] = useState<string | null>(null);
	const [highlightedGuestId, setHighlightedGuestId] = useState<string | null>(null);

	useEffect(() => {
		if (!pendingAutoShareGuestId) return;

		const timer1 = setTimeout(() => {
			setHighlightedGuestId(pendingAutoShareGuestId);
			const timer2 = setTimeout(() => {
				setHighlightedGuestId(null);
				setPendingAutoShareGuestId(null);
			}, 2000);
			return () => clearTimeout(timer2);
		}, 800);

		return () => clearTimeout(timer1);
	}, [pendingAutoShareGuestId]);

	const openCreateModal = useCallback(() => {
		setModalMode('create');
		setEditingGuest(null);
		setModalOpen(true);
	}, []);

	const openEditModal = useCallback((guest: DashboardGuestItem) => {
		setModalMode('edit');
		setEditingGuest(guest);
		setModalOpen(true);
	}, []);

	const openNextGeneratedGuest = useCallback(() => {
		const next = items.find((item) => item.deliveryStatus === 'generated');
		if (!next) return;
		setModalMode('edit');
		setEditingGuest(next);
		setIsNextActionActive(true);
		setModalOpen(true);
	}, [items]);

	const closeModal = useCallback(() => {
		setModalOpen(false);
		setIsNextActionActive(false);
	}, []);

	const requestDelete = useCallback(async (guest: DashboardGuestItem) => {
		setGuestToDelete(guest);
		setDeleteConfirmOpen(true);
	}, []);

	const closeDeleteConfirm = useCallback(() => {
		setDeleteConfirmOpen(false);
		setGuestToDelete(null);
	}, []);

	const handleDeleteConfirm = useCallback(async () => {
		if (!guestToDelete) return;
		try {
			await guestsApi.delete(guestToDelete.guestId);
			await loadGuests();
			setNotification({
				message: `Invitado ${guestToDelete.fullName} eliminado con éxito.`,
				type: 'success',
			});
		} catch (error) {
			const shouldShowDebugMessage =
				typeof window !== 'undefined' &&
				new URLSearchParams(window.location.search).get('debug') === '1' &&
				error instanceof Error &&
				error.message;
			setNotification({
				message: shouldShowDebugMessage ? error.message : 'Error al eliminar invitado.',
				type: 'warning',
			});
		} finally {
			closeDeleteConfirm();
		}
	}, [closeDeleteConfirm, guestToDelete, loadGuests]);

	const optimisticStatusUpdate = useCallback(
		async (
			item: DashboardGuestItem,
			newStatus: DashboardGuestItem['deliveryStatus'],
			apiCall: () => Promise<unknown>,
			successNotification: NotificationPayload,
			errorMessage: string,
			onBeforeUpdate?: (currentItems: DashboardGuestItem[]) => void,
		) => {
			let previousItems: DashboardGuestItem[] = [];
			setItems((prev) => {
				previousItems = [...prev];
				onBeforeUpdate?.(prev);
				return prev.map((entry) =>
					entry.guestId === item.guestId
						? { ...entry, deliveryStatus: newStatus }
						: entry,
				);
			});
			try {
				await apiCall();
				setNotification(successNotification);
				await loadGuests();
			} catch {
				if (previousItems.length) setItems(previousItems);
				setNotification({ message: errorMessage, type: 'warning' });
			}
		},
		[loadGuests, setItems, setNotification],
	);

	const handleMarkShared = useCallback(
		async (item: DashboardGuestItem) => {
			let nextGuestId: string | null = null;
			await optimisticStatusUpdate(
				item,
				'shared',
				() => guestsApi.markShared(item.guestId),
				{ message: 'Entrega registrada correctamente.', type: 'success' },
				'Error al actualizar estado.',
				(prev) => {
					const currentIndex = prev.findIndex((entry) => entry.guestId === item.guestId);
					if (currentIndex !== -1 && currentIndex < prev.length - 1) {
						nextGuestId = prev[currentIndex + 1].guestId;
					}
				},
			);
			setShareSessionCount((prev) => prev + 1);
			setCelebratingGuestId(item.guestId);
			setTimeout(() => setCelebratingGuestId(null), 1500);
			if (nextGuestId) setPendingAutoShareGuestId(nextGuestId);
		},
		[optimisticStatusUpdate],
	);

	const handleRevertShared = useCallback(
		async (item: DashboardGuestItem) => {
			await optimisticStatusUpdate(
				item,
				'generated',
				() => guestsApi.revertShared(item.guestId),
				{ message: 'Envío revertido correctamente.', type: 'info' },
				'Error al revertir envío.',
			);
		},
		[optimisticStatusUpdate],
	);

	const handlePostpone = useCallback(() => {
		if (!editingGuest) return;

		setItems((prev) => {
			const index = prev.findIndex((item) => item.guestId === editingGuest.guestId);
			if (index === -1) return prev;

			const nextItems = [...prev];
			const [postponedItem] = nextItems.splice(index, 1);
			nextItems.push(postponedItem);
			return nextItems;
		});

		const remainingPending = items.filter(
			(item) => item.deliveryStatus === 'generated' && item.guestId !== editingGuest.guestId,
		);

		if (remainingPending.length > 0) {
			setEditingGuest(remainingPending[0]);
			setNotification({
				message: `Invitado pospuesto. Siguiente: ${remainingPending[0].fullName}`,
				type: 'info',
			});
		} else {
			setModalOpen(false);
			setIsNextActionActive(false);
			setNotification({
				message: 'No hay más invitados pendientes en la cola.',
				type: 'info',
			});
		}
	}, [editingGuest, items, setItems]);

	const handleSubmit = useCallback(
		async (payload: GuestFormPayload, stayOpen?: boolean) => {
			if (!eventId && modalMode === 'create') {
				console.error('[GuestDashboard] Cannot create guest: eventId is missing.');
				setNotification({
					message: 'Error: No se ha seleccionado un evento válido.',
					type: 'warning',
				});
				return;
			}

			let savedItem: DashboardGuestItem | null = null;
			try {
				if (modalMode === 'create') {
					savedItem = await guestsApi.create({
						eventId,
						...payload,
					});
				} else if (editingGuest) {
					savedItem = await guestsApi.update(editingGuest.guestId, payload);
				}

				await loadGuests();
				setNotification({
					message: `Invitado ${savedItem?.fullName || 'guardado'} correctamente.`,
					type: 'success',
				});

				if (isNextActionActive && modalMode === 'edit' && savedItem) {
					setPendingAutoShareGuestId(savedItem.guestId);
					setIsNextActionActive(false);
				}

				if (!stayOpen) {
					closeModal();
				}
			} catch (err) {
				console.error('Error saving guest:', err);
				throw err;
			}
		},
		[closeModal, editingGuest, eventId, isNextActionActive, loadGuests, modalMode],
	);

	const handleImport = useCallback(
		async (guests: Partial<DashboardGuestItem>[]) => {
			if (!eventId) {
				setNotification({
					message: 'Error: No se ha seleccionado un evento válido.',
					type: 'warning',
				});
				return { created: 0, updated: 0, status: 'skipped' };
			}
			const result = await guestsApi.bulkImport({
				eventId,
				guests: guests.map((guest) => ({
					full_name: guest.fullName || '',
					phone: guest.phone,
					email: guest.email,
					tags: guest.tags,
				})),
			});
			await loadGuests();
			return result;
		},
		[eventId, loadGuests, setNotification],
	);

	const handleImportUpdate = useCallback(
		async (guestId: string, payload: UpdateGuestDTO) => {
			const result = await guestsApi.update(guestId, payload);
			await loadGuests();
			return result;
		},
		[loadGuests],
	);

	const handleExport = useCallback(async () => {
		if (!eventId) {
			setNotification({
				message: 'Error: No se ha seleccionado un evento válido.',
				type: 'warning',
			});
			return;
		}
		try {
			await guestsApi.exportCsv(eventId);
		} catch (err) {
			console.error('[GuestDashboard] Export error:', err);
			setNotification({
				message: 'Error al exportar invitados.',
				type: 'warning',
			});
		}
	}, [eventId, setNotification]);

	return {
		celebratingGuestId,
		closeDeleteConfirm,
		closeModal,
		deleteConfirmOpen,
		editFirstGuestShortcut: () => {
			if (items.length > 0) openEditModal(items[0]);
		},
		editingGuest,
		guestToDelete,
		handleDeleteConfirm,
		handleExport,
		handleImport,
		handleImportUpdate,
		handleMarkShared,
		handlePostpone,
		handleRevertShared,
		handleSubmit,
		highlightedGuestId,
		importModalOpen,
		isNextActionActive,
		modalMode,
		modalOpen,
		notification,
		openCreateModal,
		openEditModal,
		openImportModal: () => setImportModalOpen(true),
		openNextGeneratedGuest,
		pendingAutoShareGuestId,
		requestDelete,
		setImportModalOpen,
		setNotification,
		shareSessionCount,
	};
};
