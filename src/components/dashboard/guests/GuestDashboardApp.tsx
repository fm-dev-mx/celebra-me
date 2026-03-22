import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { Confetti } from '@/components/ui/Confetti';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { guestsApi } from '@/lib/dashboard/guests-api';
import GuestDashboardHeader from './GuestDashboardHeader';
import GuestDeleteConfirmModal from './GuestDeleteConfirmModal';
import GuestFilters from './GuestFilters';
import GuestFormModal from './GuestFormModal';
import GuestMobileDock from './GuestMobileDock';
import GuestTable from './GuestTable';
import ImportMagic from './ImportMagic';
import Toast from './Toast';
import type { DashboardGuestItem } from './types';
import { useGuestDashboardActions, type GuestFormPayload } from './use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from './use-guest-dashboard-realtime';
import '@/styles/dashboard/_guests.scss';

interface GuestDashboardAppProps {
	initialEventId: string;
}

const GuestDashboardApp: React.FC<GuestDashboardAppProps> = ({ initialEventId }) => {
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'declined' | 'viewed'>(
		'all',
	);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [notificationSeed, setNotificationSeed] = useState<{
		message: string;
		type: 'info' | 'success' | 'warning';
	} | null>(null);
	const {
		error,
		eventId,
		hostEvents,
		inviteBaseUrl,
		items,
		loading,
		loadGuests,
		realtimeState,
		setEventId,
		setItems,
		totals,
		updatedAt,
	} = useGuestDashboardRealtime({
		initialEventId,
		search,
		status,
		onNotification: setNotificationSeed,
	});
	const {
		celebratingGuestId,
		closeDeleteConfirm,
		closeModal,
		confettiActive,
		deleteConfirmOpen,
		editFirstGuestShortcut,
		editingGuest,
		guestToDelete,
		handleDeleteConfirm,
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
		openImportModal,
		openNextGeneratedGuest,
		requestDelete,
		setConfettiActive,
		setImportModalOpen,
		setNotification,
		shareSessionCount,
	} = useGuestDashboardActions({
		eventId,
		items,
		loadGuests,
		setItems,
	});

	useEffect(() => {
		if (notificationSeed) {
			setNotification(notificationSeed);
		}
	}, [notificationSeed, setNotification]);

	useShortcuts(
		{
			'/': () => searchInputRef.current?.focus(),
			n: openCreateModal,
			e: editFirstGuestShortcut,
			escape: closeModal,
		},
		!modalOpen,
	);

	useEffect(() => {
		const isAnyModalOpen = modalOpen || deleteConfirmOpen || importModalOpen;

		if (isAnyModalOpen) {
			document.body.classList.add('modal-open');
		} else {
			document.body.classList.remove('modal-open');
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.top = '';
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && isAnyModalOpen) {
				closeModal();
				closeDeleteConfirm();
				setImportModalOpen(false);
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [
		closeDeleteConfirm,
		closeModal,
		deleteConfirmOpen,
		importModalOpen,
		modalOpen,
		setImportModalOpen,
	]);

	const sortedItems = useMemo(() => {
		return [...items].sort((a, b) => {
			if (a.deliveryStatus === 'generated' && b.deliveryStatus === 'shared') return -1;
			if (a.deliveryStatus === 'shared' && b.deliveryStatus === 'generated') return 1;
			return 0;
		});
	}, [items]);

	return (
		<ErrorBoundary>
			<section className="dashboard-guests">
				<Confetti active={confettiActive} onComplete={() => setConfettiActive(false)} />

				<GuestDashboardHeader
					eventId={eventId}
					hostEvents={hostEvents}
					items={items}
					loading={loading}
					realtimeState={realtimeState}
					shareSessionCount={shareSessionCount}
					totals={totals}
					updatedAt={updatedAt}
					onEventChange={setEventId}
					onOpenNextAction={openNextGeneratedGuest}
				/>

				<GuestFilters
					searchInputRef={searchInputRef}
					search={search}
					status={status}
					onSearchChange={setSearch}
					onStatusChange={setStatus}
					onRefreshClick={loadGuests}
					onCreateClick={openCreateModal}
					onExportClick={async () => {
						try {
							await guestsApi.exportCsv(eventId);
						} catch (err) {
							console.error('[GuestDashboard] Export error:', err);
							setNotification({
								message: 'Error al exportar invitados.',
								type: 'warning',
							});
						}
					}}
					onImportClick={openImportModal}
				/>

				{loading && <p className="dashboard-status">Procesando...</p>}
				{error && <p className="dashboard-error">{error}</p>}

				<GuestTable
					items={sortedItems}
					inviteBaseUrl={inviteBaseUrl}
					celebratingGuestId={celebratingGuestId}
					highlightedGuestId={highlightedGuestId}
					onEdit={openEditModal}
					onDelete={async (item: DashboardGuestItem) => requestDelete(item)}
					onMarkShared={handleMarkShared}
				/>

				{deleteConfirmOpen && (
					<GuestDeleteConfirmModal
						guestToDelete={guestToDelete}
						onClose={closeDeleteConfirm}
						onConfirm={handleDeleteConfirm}
					/>
				)}

				{modalOpen && (
					<GuestFormModal
						open={modalOpen}
						mode={modalMode}
						initialGuest={editingGuest}
						isInvitationFactory={isNextActionActive}
						onClose={closeModal}
						onPostpone={handlePostpone}
						onSubmit={(payload, stayOpen) =>
							handleSubmit(payload as GuestFormPayload, stayOpen)
						}
					/>
				)}

				{notification && (
					<Toast
						message={notification.message}
						type={notification.type}
						onClose={() => setNotification(null)}
						action={{
							label: 'Actualizar',
							onClick: () => {
								void loadGuests();
								setNotification(null);
							},
						}}
					/>
				)}

				{importModalOpen && (
					<ImportMagic
						onClose={() => setImportModalOpen(false)}
						onImport={handleImport}
					/>
				)}

				<GuestMobileDock
					loading={loading}
					hasPendingGenerated={items.some((item) => item.deliveryStatus === 'generated')}
					status={status}
					onCreate={openCreateModal}
					onOpenNextAction={openNextGeneratedGuest}
					onStatusChange={setStatus}
				/>
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
