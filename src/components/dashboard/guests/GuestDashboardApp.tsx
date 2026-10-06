import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import GuestDashboardHeader from '@/components/dashboard/guests/GuestDashboardHeader';
import GuestDeleteConfirmModal from '@/components/dashboard/guests/GuestDeleteConfirmModal';
import GuestDetailSheet from '@/components/dashboard/guests/GuestDetailSheet';
import GuestBatchConfirm from '@/components/dashboard/guests/GuestBatchConfirm';
import GuestSelectionBar from '@/components/dashboard/guests/GuestSelectionBar';
import GuestFilters, { type GroupFilter } from '@/components/dashboard/guests/GuestFilters';
import GuestStatusOverview from '@/components/dashboard/guests/GuestStatusOverview';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import GuestMobileDock from '@/components/dashboard/guests/GuestMobileDock';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import GuestListControls from '@/components/dashboard/guests/GuestListControls';
import { useGuestListView } from '@/components/dashboard/guests/use-guest-list-view';
import { useGuestChangeNotice } from '@/components/dashboard/guests/use-guest-change-notice';
import { useGuestBatchSelection } from '@/components/dashboard/guests/use-guest-batch-selection';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareMessagesModal from '@/components/dashboard/guests/ShareMessagesModal';
import ToolbarActionsMenu from '@/components/dashboard/guests/ToolbarActionsMenu';
import Toast from '@/components/dashboard/guests/Toast';
import {
	computeGuestStatusCounts,
	filterGuestsForReview,
	getBatchCandidates,
	getGuestInviteUrl,
	type GuestReviewFilterValue,
} from '@/components/dashboard/guests/guest-presenter';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';
import {
	getReminderEligibleGuests,
	shouldShowReminderCta,
} from '@/components/dashboard/guests/reminder-eligibility';
import type { DeliveryFilter } from '@/interfaces/rsvp/domain.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import { useShortcuts } from '@/hooks/use-shortcuts';
import '@/styles/dashboard/_guests.scss';

interface GuestDashboardAppProps {
	initialEventId: string;
}

function s(count: number) {
	return count !== 1 ? 's' : '';
}

const GuestDashboardApp: React.FC<GuestDashboardAppProps> = ({ initialEventId }) => {
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'declined' | 'viewed'>(
		'all',
	);
	const [delivery, setDelivery] = useState<DeliveryFilter>('all');
	const [group, setGroup] = useState<GroupFilter>('all');
	const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);
	const [detailGuestId, setDetailGuestId] = useState<string | null>(null);
	const [reviewFilter, setReviewFilter] = useState<GuestReviewFilterValue>('all');
	const [shareMessagesModalOpen, setShareMessagesModalOpen] = useState(false);
	const [listView, setListView] = useGuestListView();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const {
		error,
		eventId,
		hostEvents,
		inviteBaseUrl,
		items,
		loading,
		loadGuests,
		reminderSettings,
		setEventId,
		setItems,
		setReminderSettings,
		setShareTemplates,
		shareTemplates,
		shareDateContext,
	} = useGuestDashboardRealtime({
		initialEventId,
		search,
		status,
		delivery,
	});
	const currentEvent = hostEvents.find((e) => e.id === eventId);
	const currentEventTitle = currentEvent?.title ?? '';
	const isBrandingRemovalEligible =
		currentEvent &&
		isEventEligibleForBrandingRemoval(currentEvent.eventType, currentEvent.slug);
	const { notice: changeNotice, dismissNotice } = useGuestChangeNotice(eventId, items);

	const reminderEligibleGuests = useMemo(
		() => getReminderEligibleGuests(items, reminderSettings.audience),
		[items, reminderSettings.audience],
	);

	const eligibleGuestIds = useMemo(
		() => new Set(reminderEligibleGuests.map((g) => g.guestId)),
		[reminderEligibleGuests],
	);

	const handleReminderSent = useCallback(
		async (guestId: string) => {
			let previousValue: string | null | undefined;
			setItems((prev) => {
				const target = prev.find((g) => g.guestId === guestId);
				previousValue = target?.lastReminderSentAt;
				return prev.map((item) =>
					item.guestId === guestId
						? { ...item, lastReminderSentAt: new Date().toISOString() }
						: item,
				);
			});
			try {
				await guestsApi.recordReminderSent(guestId);
			} catch {
				setItems((prev) =>
					prev.map((item) =>
						item.guestId === guestId
							? { ...item, lastReminderSentAt: previousValue }
							: item,
					),
				);
			}
		},
		[setItems],
	);

	const statusCounts = useMemo(() => computeGuestStatusCounts(items), [items]);
	const withMessageCount = useMemo(
		() => items.filter((item) => (item.guestComment ?? '').trim().length > 0).length,
		[items],
	);
	// Resolved from live items so the sheet follows edits and closes when the guest is removed.
	const detailGuest = items.find((item) => item.guestId === detailGuestId);

	const showReminderCta = useMemo(
		() => shouldShowReminderCta(shareDateContext, reminderSettings, eligibleGuestIds.size),
		[shareDateContext, reminderSettings, eligibleGuestIds.size],
	);

	const reminderHint =
		showReminderCta && shareDateContext.rawDaysUntilEvent !== null
			? reminderSettings.audience === 'unconfirmed'
				? `Faltan ${shareDateContext.daysUntilEvent} día${s(shareDateContext.rawDaysUntilEvent)} · ${eligibleGuestIds.size} invitado${s(eligibleGuestIds.size)} sin confirmar`
				: `Faltan ${shareDateContext.daysUntilEvent} día${s(shareDateContext.rawDaysUntilEvent)} · ${eligibleGuestIds.size} invitado${s(eligibleGuestIds.size)} activo${s(eligibleGuestIds.size)} con invitación enviada`
			: null;

	const visibleItems = filterGuestsForReview(items, {
		reviewFilter,
		group,
		reminderEligibleIds: eligibleGuestIds,
	});

	const {
		batchFlowKind,
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
		openNextReminderGuest,
		openBatchForGuests,
		pendingGuests,
		queueGuestIds,
		requestDelete,
		setImportModalOpen,
		setNotification,
	} = useGuestDashboardActions({
		eventId,
		items,
		loadGuests,
		setItems,
		reminderSettings,
	});

	const handleSaveShareTemplates = (result: {
		shareTemplates: ShareMessagesConfig;
		reminderSettings: typeof reminderSettings;
	}) => {
		setShareMessagesModalOpen(false);
		setShareTemplates(result.shareTemplates);
		setReminderSettings(result.reminderSettings);
		setNotification({
			message: 'Mensajes guardados correctamente.',
			type: 'success',
		});
	};

	function renderModals() {
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
			const editingInviteUrl = editingGuest
				? getGuestInviteUrl(editingGuest, inviteBaseUrl)
				: '';
			const flowMode =
				batchFlowKind === 'reminder' ? 'pending-reminder' : 'pending-invitation';
			const queuedGuests = queueGuestIds
				? getBatchCandidates(items, batchFlowKind, queueGuestIds)
				: null;
			return (
				<SendInvitationModal
					key={editingGuest?.guestId ?? 'empty'}
					guest={editingGuest}
					pendingGuests={
						queuedGuests ??
						(batchFlowKind === 'reminder' ? reminderEligibleGuests : pendingGuests)
					}
					inviteUrl={editingInviteUrl}
					onClose={closeModal}
					onSave={handleSaveInvitation}
					onMarkShared={handleMarkShared}
					onReminderSent={handleReminderSent}
					onAdvanceFromGuest={handleAdvanceFromGuest}
					onPostponeGuest={handlePostpone}
					templates={shareTemplates}
					shareDateContext={shareDateContext}
					eventTitle={currentEventTitle}
					mode={flowMode}
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
					eventType={currentEvent.eventType}
					initialTemplates={shareTemplates}
					initialReminderSettings={reminderSettings}
					shareDateContext={shareDateContext}
					onClose={() => setShareMessagesModalOpen(false)}
					onSave={handleSaveShareTemplates}
				/>
			);
		}
		return null;
	}
	const modals = renderModals();

	const batchSelection = useGuestBatchSelection({
		items,
		pendingGuests,
		reminderEligibleGuests,
		openBatchForGuests,
		openNextGeneratedGuest,
		openNextReminderGuest: () => openNextReminderGuest(reminderSettings.audience),
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
					onEventChange={setEventId}
				/>

				<GuestStatusOverview
					counts={statusCounts}
					activeFilter={reviewFilter}
					onFilterChange={setReviewFilter}
					reminderCount={showReminderCta ? eligibleGuestIds.size : 0}
					withMessageCount={withMessageCount}
					reminderHint={reminderHint}
				/>

				{/* Desktop-only secondary block; hidden below lg in _dashboard-guests-stats.scss */}
				<GuestGroupMetrics items={visibleItems} />

				<div className="dashboard-guests__toolbar">
					<button
						type="button"
						onClick={openCreateModal}
						className="btn-primary btn--compact dashboard-guests__toolbar-create"
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

				<GuestListControls
					hasGuests={items.length > 0}
					selectionMode={batchSelection.selectionMode}
					view={listView}
					onViewChange={setListView}
					onStartSelection={batchSelection.startSelection}
					changeNotice={changeNotice}
					onDismissNotice={dismissNotice}
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
					reminderMode={showReminderCta}
					eligibleGuestIds={eligibleGuestIds}
					onReminderSent={handleReminderSent}
					onToggleExpanded={(id) =>
						setExpandedGuestId((prev) => (prev === id ? null : id))
					}
					onEdit={openEditModal}
					onDelete={requestDelete}
					onMarkShared={handleMarkShared}
					onRevertShared={handleRevertShared}
					isBrandingRemovalEligible={isBrandingRemovalEligible}
					onToggleBrandingRemoval={handleToggleBrandingRemoval}
					onSaveGuest={handleSaveInvitation}
					view={listView}
					onOpenDetails={(item) => setDetailGuestId(item.guestId)}
					selection={batchSelection.tableSelection}
				/>

				{detailGuest && (
					<GuestDetailSheet
						item={detailGuest}
						inviteUrl={getGuestInviteUrl(detailGuest, inviteBaseUrl)}
						eventTitle={currentEventTitle}
						shareTemplates={shareTemplates}
						shareDateContext={shareDateContext}
						reminderMode={showReminderCta}
						isReminderEligible={eligibleGuestIds.has(detailGuest.guestId)}
						onReminderSent={handleReminderSent}
						onClose={() => setDetailGuestId(null)}
						onEdit={openEditModal}
						onDelete={requestDelete}
						onMarkShared={handleMarkShared}
						onRevertShared={handleRevertShared}
						isBrandingRemovalEligible={isBrandingRemovalEligible}
						onToggleBrandingRemoval={handleToggleBrandingRemoval}
						onSaveGuest={handleSaveInvitation}
					/>
				)}

				{modals}
				{batchSelection.batchRequest && batchSelection.batchGuests.length > 0 && (
					<GuestBatchConfirm
						kind={batchSelection.batchRequest.kind}
						guests={batchSelection.batchGuests}
						onConfirm={batchSelection.confirmBatch}
						onClose={batchSelection.cancelBatch}
					/>
				)}
				{notification && (
					<Toast
						message={notification.message}
						type={notification.type}
						onClose={() => setNotification(null)}
					/>
				)}

				{batchSelection.selectionMode ? (
					<GuestSelectionBar
						selectedCount={batchSelection.selectedIds.size}
						totalCount={visibleItems.length}
						sendCount={batchSelection.selectedSendCount}
						remindCount={batchSelection.selectedRemindCount}
						onSelectAll={() =>
							batchSelection.selectGuests(visibleItems.map((item) => item.guestId))
						}
						onClearSelection={() => batchSelection.selectGuests([])}
						onSend={() =>
							batchSelection.requestBatch('invitation', batchSelection.selectedIds)
						}
						onRemind={() =>
							batchSelection.requestBatch('reminder', batchSelection.selectedIds)
						}
						onFinish={batchSelection.finishSelection}
					/>
				) : (
					<GuestMobileDock
						loading={loading}
						hasPendingGenerated={pendingGuests.length > 0}
						pendingCount={pendingGuests.length}
						hasReminderCta={showReminderCta}
						reminderCount={eligibleGuestIds.size}
						createDisabled={!eventId}
						onCreate={openCreateModal}
						onOpenNextAction={() => batchSelection.requestBatch('invitation', null)}
						onOpenReminder={() => batchSelection.requestBatch('reminder', null)}
					/>
				)}
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
