import React, { useCallback, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import type { GuestReviewFilter } from '@/components/dashboard/guests/GuestReviewBlock';
import GuestDashboardHeader from '@/components/dashboard/guests/GuestDashboardHeader';
import GuestDeleteConfirmModal from '@/components/dashboard/guests/GuestDeleteConfirmModal';
import GuestFilters, { type GroupFilter } from '@/components/dashboard/guests/GuestFilters';
import { getGuestVisibleTags } from '@/components/dashboard/guests/guest-presenter';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import GuestMobileDock from '@/components/dashboard/guests/GuestMobileDock';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareMessagesModal from '@/components/dashboard/guests/ShareMessagesModal';
import ToolbarActionsMenu from '@/components/dashboard/guests/ToolbarActionsMenu';
import Toast from '@/components/dashboard/guests/Toast';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';
import type { DeliveryFilter } from '@/interfaces/rsvp/domain.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
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
	const [group, setGroup] = useState<GroupFilter>('all');
	const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);
	const [reviewFilter, setReviewFilter] = useState<GuestReviewFilter>('all');
	const [shareMessagesModalOpen, setShareMessagesModalOpen] = useState(false);
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
		setShareTemplates,
		shareTemplates,
		shareDateContext,
		totals,
	} = useGuestDashboardRealtime({
		initialEventId,
		search,
		status,
		delivery,
	});
	const currentEvent = hostEvents.find((e) => e.id === eventId);
	const currentEventTitle = currentEvent?.title ?? '';
	const isBrandingRemovalEligible = currentEvent
		? isEventEligibleForBrandingRemoval(currentEvent.eventType, currentEvent.slug)
		: false;

	const visibleItems = items.filter((item) => {
		if (reviewFilter === 'delivery-pending' && item.deliveryStatus !== 'generated')
			return false;
		if (reviewFilter === 'rsvp-pending' && item.attendanceStatus !== 'pending') return false;
		if (reviewFilter === 'with-message' && item.guestComment.trim().length === 0) return false;
		if (group !== 'all') {
			const itemTags = getGuestVisibleTags(item);
			if (!itemTags.includes(group)) return false;
		}
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

	const handleSaveShareTemplates = useCallback(
		(templates: ShareMessagesConfig) => {
			setShareMessagesModalOpen(false);
			setShareTemplates(templates);
			setNotification({
				message: 'Mensajes guardados correctamente.',
				type: 'success',
			});
		},
		[setShareTemplates, setNotification],
	);

	const modals = (() => {
		if (importModalOpen) {
			return (
				<ImportMagic
					eventId={eventId}
					existingGuests={items}
					onImport={handleImport}
					onUpdate={handleImportUpdate}
					onClose={() => setImportModalOpen(false)}
				/>
			);
		}
		if (deleteConfirmOpen) {
			return (
				<GuestDeleteConfirmModal
					guestToDelete={guestToDelete}
					onClose={closeDeleteConfirm}
					onConfirm={handleDeleteConfirm}
				/>
			);
		}
		if (modalOpen && modalMode === 'send-pending') {
			return (
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
					templates={shareTemplates}
					shareDateContext={shareDateContext}
					eventTitle={currentEventTitle}
				/>
			);
		}
		if (modalOpen && (modalMode === 'create' || modalMode === 'edit')) {
			return (
				<GuestFormModal
					open={modalOpen}
					mode={modalMode}
					initialGuest={editingGuest}
					isInvitationFactory={isNextActionActive}
					onClose={closeModal}
					onPostpone={handlePostpone}
					onSubmit={(payload, stayOpen) => handleSubmit(payload, stayOpen)}
				/>
			);
		}
		if (shareMessagesModalOpen && currentEvent) {
			return (
				<ShareMessagesModal
					eventId={eventId}
					eventTitle={currentEvent.title}
					initialTemplates={shareTemplates}
					shareDateContext={shareDateContext}
					onClose={() => setShareMessagesModalOpen(false)}
					onSave={handleSaveShareTemplates}
				/>
			);
		}
		return null;
	})();

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
					filteredItems={visibleItems}
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
						onShareMessages={() => setShareMessagesModalOpen(true)}
					/>
				</div>

				<GuestFilters
					searchInputRef={searchInputRef}
					search={search}
					status={status}
					delivery={delivery}
					group={group}
					onSearchChange={setSearch}
					onStatusChange={setStatus}
					onDeliveryChange={setDelivery}
					onGroupChange={setGroup}
				/>

				{loading && <p className="dashboard-status">Cargando invitados...</p>}
				{error && <p className="dashboard-error">{error}</p>}

				<GuestTable
					items={visibleItems}
					inviteBaseUrl={inviteBaseUrl}
					eventTitle={currentEventTitle}
					shareTemplates={shareTemplates}
					shareDateContext={shareDateContext}
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

				{modals}
				{notification && (
					<Toast
						message={notification.message}
						type={notification.type}
						onClose={() => setNotification(null)}
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
