import React, { useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import type { GuestReviewFilter } from '@/components/dashboard/guests/GuestReviewBlock';
import GuestDashboardHeader from '@/components/dashboard/guests/GuestDashboardHeader';
import GuestDeleteConfirmModal from '@/components/dashboard/guests/GuestDeleteConfirmModal';
import GuestFilters from '@/components/dashboard/guests/GuestFilters';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import GuestMobileDock from '@/components/dashboard/guests/GuestMobileDock';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ToolbarActionsMenu from '@/components/dashboard/guests/ToolbarActionsMenu';
import Toast from '@/components/dashboard/guests/Toast';
import {
	useGuestDashboardActions,
	type GuestFormPayload,
} from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';
import type { DeliveryFilter } from '@/interfaces/rsvp/domain.interface';
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
	const [delivery, setDelivery] = useState<DeliveryFilter>('all');
	const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);
	const [reviewFilter, setReviewFilter] = useState<GuestReviewFilter>('all');
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
		delivery,
	});
	const currentEvent = hostEvents.find((e) => e.id === eventId);
	const isBrandingRemovalEligible = currentEvent
		? isEventEligibleForBrandingRemoval(currentEvent.eventType, currentEvent.slug)
		: false;
	const visibleItems = items.filter((item) => {
		if (reviewFilter === 'delivery-pending') return item.deliveryStatus === 'generated';
		if (reviewFilter === 'rsvp-pending') return item.attendanceStatus === 'pending';
		if (reviewFilter === 'with-message') return item.guestComment.trim().length > 0;
		return true;
	});

	const {
		celebratingGuestId,
		closeDeleteConfirm,
		closeModal,
		deleteConfirmOpen,
		editFirstGuestShortcut,
		editingGuest,
		guestToDelete,
		handleAdvanceFromGuest,
		handleDeleteConfirm,
		handleExport,
		handleImport,
		handleImportUpdate,
		handleMarkShared,
		handlePostpone,
		handleRevertShared,
		handleSaveInvitation,
		handleSubmit,
		handleToggleBrandingRemoval,
		importModalOpen,
		isNextActionActive,
		modalMode,
		modalOpen,
		notification,
		openCreateModal,
		openEditModal,
		openImportModal,
		openNextGeneratedGuest,
		pendingGuests,
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
	return (
		<ErrorBoundary>
			<section className="dashboard-guests">
				<GuestDashboardHeader
					eventId={eventId}
					hostEvents={hostEvents}
					items={items}
					activeReviewFilter={reviewFilter}
					totals={totals}
					onEventChange={setEventId}
					onReviewFilterChange={setReviewFilter}
				/>

				<div className="dashboard-guests__toolbar">
					<button
						type="button"
						onClick={openCreateModal}
						className="btn-primary btn--compact"
					>
						Agregar invitado
					</button>
					<ToolbarActionsMenu
						onExport={handleExport}
						onImport={openImportModal}
						onRefresh={loadGuests}
					/>
				</div>

				<GuestFilters
					searchInputRef={searchInputRef}
					search={search}
					status={status}
					delivery={delivery}
					onSearchChange={setSearch}
					onStatusChange={setStatus}
					onDeliveryChange={setDelivery}
				/>

				{loading && <p className="dashboard-status">Cargando invitados...</p>}
				{error && <p className="dashboard-error">{error}</p>}

				<GuestTable
					items={visibleItems}
					inviteBaseUrl={inviteBaseUrl}
					celebratingGuestId={celebratingGuestId}
					expandedGuestId={expandedGuestId}
					onToggleExpanded={(id) =>
						setExpandedGuestId((prev) => (prev === id ? null : id))
					}
					onEdit={openEditModal}
					onDelete={requestDelete}
					onMarkShared={handleMarkShared}
					onRevertShared={handleRevertShared}
					isBrandingRemovalEligible={isBrandingRemovalEligible}
					onToggleBrandingRemoval={handleToggleBrandingRemoval}
				/>

				{deleteConfirmOpen && (
					<GuestDeleteConfirmModal
						guestToDelete={guestToDelete}
						onClose={closeDeleteConfirm}
						onConfirm={handleDeleteConfirm}
					/>
				)}

				{modalOpen && modalMode === 'send-pending' && (
					<SendInvitationModal
						key={editingGuest?.guestId ?? 'empty'}
						guest={editingGuest}
						pendingGuests={pendingGuests}
						inviteBaseUrl={inviteBaseUrl}
						onClose={closeModal}
						onSave={handleSaveInvitation}
						onMarkShared={handleMarkShared}
						onAdvanceFromGuest={handleAdvanceFromGuest}
						onPostponeGuest={handlePostpone}
					/>
				)}

				{modalOpen && modalMode !== 'send-pending' && (
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
						onUpdate={handleImportUpdate}
						eventId={eventId}
						existingGuests={items}
					/>
				)}

				<GuestMobileDock
					loading={loading}
					hasPendingGenerated={items.some((item) => item.deliveryStatus === 'generated')}
					createDisabled={!eventId}
					onCreate={openCreateModal}
					onOpenNextAction={openNextGeneratedGuest}
				/>
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
