import { useCallback, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type { DashboardGuestItem } from './types';

type ModalMode = 'create' | 'edit';

export interface GuestFormPayload {
	fullName: string;
	phone?: string;
	maxAllowedAttendees: number;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	attendeeCount?: number;
	guestMessage?: string;
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
	const [confettiActive, setConfettiActive] = useState(false);
	const [celebratingGuestId, setCelebratingGuestId] = useState<string | null>(null);
	const [highlightedGuestId, setHighlightedGuestId] = useState<string | null>(null);
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
		} catch {
			setNotification({
				message: 'Error al eliminar invitado.',
				type: 'warning',
			});
		} finally {
			closeDeleteConfirm();
		}
	}, [closeDeleteConfirm, guestToDelete, loadGuests]);

	const handleMarkShared = useCallback(
		async (item: DashboardGuestItem) => {
			const previousItems = [...items];
			setItems((prev) =>
				prev.map((entry) =>
					entry.guestId === item.guestId ? { ...entry, deliveryStatus: 'shared' } : entry,
				),
			);
			try {
				await guestsApi.markShared(item.guestId);
				setShareSessionCount((prev) => prev + 1);
				setConfettiActive(true);
				setNotification({
					message: '¡Invitación compartida! 🎉',
					type: 'success',
				});
				setCelebratingGuestId(item.guestId);
				setTimeout(() => setCelebratingGuestId(null), 1500);
				await loadGuests();
				const currentIndex = items.findIndex((entry) => entry.guestId === item.guestId);
				if (currentIndex !== -1 && currentIndex < items.length - 1) {
					const nextGuest = items[currentIndex + 1];
					setTimeout(() => {
						setHighlightedGuestId(nextGuest.guestId);
						setTimeout(() => setHighlightedGuestId(null), 2000);
					}, 800);
				}
			} catch (err) {
				console.error('[GuestDashboard] Mark shared error:', err);
				setItems(previousItems);
				setNotification({
					message: 'Error al actualizar estado.',
					type: 'warning',
				});
			}
		},
		[items, loadGuests, setItems],
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
					const guestId = savedItem.guestId;
					setTimeout(() => {
						const shareButton = document.querySelector(
							`[data-guest-id="${guestId}"] .dashboard-guests__share-button`,
						) as HTMLElement | null;
						if (shareButton) {
							shareButton.click();
							const card = document.querySelector(`[data-guest-id="${guestId}"]`);
							card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}
						setIsNextActionActive(false);
					}, 400);
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
			await guestsApi.bulkImport({
				eventId,
				guests: guests.map((guest) => ({
					full_name: guest.fullName || '',
					phone_: guest.phone,
					email: guest.email,
					tags: guest.tags,
				})),
			});
			await loadGuests();
		},
		[eventId, loadGuests],
	);

	const handleExport = useCallback(async () => {
		try {
			await guestsApi.exportCsv(eventId);
		} catch (err) {
			console.error('[GuestDashboard] Export error:', err);
			setNotification({
				message: 'Error al exportar invitados.',
				type: 'warning',
			});
		}
	}, [eventId]);

	return {
		celebratingGuestId,
		closeDeleteConfirm,
		closeModal,
		confettiActive,
		deleteConfirmOpen,
		editFirstGuestShortcut: () => {
			if (items.length > 0) openEditModal(items[0]);
		},
		editingGuest,
		guestToDelete,
		handleDeleteConfirm,
		handleExport,
		handleImport,
		handleMarkShared,
		handlePostpone,
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
		requestDelete,
		setConfettiActive,
		setImportModalOpen,
		setNotification,
		shareSessionCount,
	};
};
