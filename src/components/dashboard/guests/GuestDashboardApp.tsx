import React, { useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import GuestDashboardHeader from '@/components/dashboard/guests/GuestDashboardHeader';
import GuestDeleteConfirmModal from '@/components/dashboard/guests/GuestDeleteConfirmModal';
import GuestFilters from '@/components/dashboard/guests/GuestFilters';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import GuestMobileDock from '@/components/dashboard/guests/GuestMobileDock';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import Toast from '@/components/dashboard/guests/Toast';
import {
	useGuestDashboardActions,
	type GuestFormPayload,
} from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { useShortcuts } from '@/hooks/use-shortcuts';
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
	const {
		error,
		eventId,
		hostEvents,
		inviteBaseUrl,
		items,
		loading,
		loadGuests,
		setEventId,
		setItems,
		totals,
	} = useGuestDashboardRealtime({
		initialEventId,
		search,
		status,
	});
	const {
		celebratingGuestId,
		closeDeleteConfirm,
		closeModal,
		deleteConfirmOpen,
		editFirstGuestShortcut,
		editingGuest,
		guestToDelete,
		handleDeleteConfirm,
		handleExport,
		handleImport,
		handleMarkShared,
		handleToggleDelivery,
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
		setImportModalOpen,
		setNotification,
	} = useGuestDashboardActions({
		eventId,
		items,
		loadGuests,
		setItems,
	});

	useShortcuts(
		{
			'/': () => searchInputRef.current?.focus(),
			n: openCreateModal,
			e: editFirstGuestShortcut,
			escape: () => {
				closeModal();
				closeDeleteConfirm();
				setImportModalOpen(false);
			},
		},
		!modalOpen && !deleteConfirmOpen && !importModalOpen,
	);
	const sortedItems = useMemo(() => {
		return [...items].sort((a, b) => {
			if (a.deliveryStatus === 'generated' && b.deliveryStatus === 'shared') return -1;
			if (a.deliveryStatus === 'shared' && b.deliveryStatus === 'generated') return 1;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});
	}, [items]);

	return (
		<ErrorBoundary>
			<section className="dashboard-guests">
				<GuestDashboardHeader
					eventId={eventId}
					hostEvents={hostEvents}
					totals={totals}
					onEventChange={setEventId}
				/>

				<GuestFilters
					searchInputRef={searchInputRef}
					search={search}
					status={status}
					onSearchChange={setSearch}
					onStatusChange={setStatus}
					onRefreshClick={loadGuests}
					onExportClick={handleExport}
					onImportClick={openImportModal}
				/>

				{loading && <p className="dashboard-status">Cargando invitados...</p>}
				{error && <p className="dashboard-error">{error}</p>}

				<GuestTable
					items={sortedItems}
					inviteBaseUrl={inviteBaseUrl}
					celebratingGuestId={celebratingGuestId}
					highlightedGuestId={highlightedGuestId}
					onEdit={openEditModal}
					onDelete={requestDelete}
					onMarkShared={handleMarkShared}
					onToggleDelivery={handleToggleDelivery}
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
					createDisabled={!eventId}
					onCreate={openCreateModal}
					onOpenNextAction={openNextGeneratedGuest}
					onStatusChange={setStatus}
				/>
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
