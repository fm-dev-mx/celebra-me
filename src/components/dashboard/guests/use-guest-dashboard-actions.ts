import { useCallback, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { UpdateGuestDTO } from '@/lib/dashboard/dto/guests';

type ModalMode = 'create' | 'edit' | 'send-pending';

export interface GuestFormPayload {
	fullName: string;
	phone?: string;
	countryCode?: string;
	maxAllowedAttendees: number;
	attendanceStatus?: AttendanceStatus;
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
	const [isNextActionActive, setIsNextActionActive] = useState(false);
	const [celebratingGuestId, setCelebratingGuestId] = useState<string | null>(null);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [guestToDelete, setGuestToDelete] = useState<DashboardGuestItem | null>(null);
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
		setModalMode('send-pending');
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
			apiCall: () => Promise<DashboardGuestItem>,
			successNotification: NotificationPayload,
			errorMessage: string,
		) => {
			let previousItems: DashboardGuestItem[] = [];
			setItems((prev) => {
				previousItems = [...prev];
				return prev.map((entry) =>
					entry.guestId === item.guestId
						? { ...entry, deliveryStatus: newStatus }
						: entry,
				);
			});
			try {
				const updatedItem = await apiCall();
				setItems((prev) =>
					prev.map((entry) =>
						entry.guestId === item.guestId ? { ...entry, ...updatedItem } : entry,
					),
				);
				setNotification(successNotification);
			} catch {
				if (previousItems.length) setItems(previousItems);
				setNotification({ message: errorMessage, type: 'warning' });
			}
		},
		[setItems, setNotification],
	);

	const handleMarkShared = useCallback(
		async (item: DashboardGuestItem) => {
			await optimisticStatusUpdate(
				item,
				'shared',
				() => guestsApi.markShared(item.guestId),
				{ message: 'Entrega registrada correctamente.', type: 'success' },
				'Error al actualizar estado.',
			);
			setCelebratingGuestId(item.guestId);
			setTimeout(() => setCelebratingGuestId(null), 1500);
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

	const handleSaveInvitation = useCallback(
		async (
			guestId: string,
			payload: {
				fullName: string;
				maxAllowedAttendees: number;
				phone?: string;
				countryCode?: string;
			},
		): Promise<DashboardGuestItem> => {
			const phone = payload.phone || undefined;
			const updated = await guestsApi.update(guestId, {
				...payload,
				phone,
				countryCode: phone ? payload.countryCode || undefined : undefined,
			});
			setItems((prev) =>
				prev.map((entry) => (entry.guestId === guestId ? { ...entry, ...updated } : entry)),
			);
			return updated;
		},
		[setItems],
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

				if (isNextActionActive && modalMode === 'edit' && savedItem) {
					const currentIndex = items.findIndex((g) => g.guestId === savedItem!.guestId);
					const nextGuest =
						items
							.slice(currentIndex + 1)
							.find((g) => g.deliveryStatus === 'generated') ||
						items.slice(0, currentIndex).find((g) => g.deliveryStatus === 'generated');

					if (savedItem.waShareUrl) {
						window.open(savedItem.waShareUrl, '_blank', 'noopener,noreferrer');
					}
					const sharedItem = await guestsApi.markShared(savedItem.guestId);

					setItems((prev) =>
						prev.map((entry) =>
							entry.guestId === sharedItem.guestId
								? { ...entry, ...sharedItem }
								: entry,
						),
					);

					if (nextGuest) {
						setEditingGuest(nextGuest);
						setNotification({
							message: `Invitación enviada. Siguiente: ${nextGuest.fullName}`,
							type: 'success',
						});
						return;
					}

					setIsNextActionActive(false);
					closeModal();
					setNotification({
						message: 'No hay más invitados pendientes.',
						type: 'info',
					});
					return;
				} else {
					await loadGuests();
					setNotification({
						message: `Invitado ${savedItem?.fullName || 'guardado'} correctamente.`,
						type: 'success',
					});
				}

				if (!stayOpen) {
					closeModal();
				}
			} catch (err) {
				console.error('Error saving guest:', err);
				throw err;
			}
		},
		[
			closeModal,
			editingGuest,
			eventId,
			isNextActionActive,
			items,
			loadGuests,
			modalMode,
			setItems,
			setEditingGuest,
			setNotification,
		],
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

	const pendingGuests = items.filter((item) => item.deliveryStatus === 'generated');

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
		handleSaveInvitation,
		handleSubmit,
		importModalOpen,
		isNextActionActive,
		modalMode,
		modalOpen,
		notification,
		openCreateModal,
		openEditModal,
		openImportModal: () => setImportModalOpen(true),
		openNextGeneratedGuest,
		pendingGuests,
		requestDelete,
		setImportModalOpen,
		setNotification,
	};
};
