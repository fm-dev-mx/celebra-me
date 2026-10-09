import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import GuestDashboardHeader from '@/components/dashboard/guests/GuestDashboardHeader';
import {
	GuestListFeedback,
	GuestLoadError,
	GuestOverviewSkeleton,
} from '@/components/dashboard/guests/GuestDashboardStates';
import GuestDeleteConfirmModal from '@/components/dashboard/guests/GuestDeleteConfirmModal';
import GuestDetailSheet from '@/components/dashboard/guests/GuestDetailSheet';
import GuestBatchConfirm from '@/components/dashboard/guests/GuestBatchConfirm';
import GuestSelectionBar from '@/components/dashboard/guests/GuestSelectionBar';
import GuestFilters from '@/components/dashboard/guests/GuestFilters';
import GuestStatusOverview from '@/components/dashboard/guests/GuestStatusOverview';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import GuestMobileDock from '@/components/dashboard/guests/GuestMobileDock';
import GuestTable from '@/components/dashboard/guests/GuestTable';
import GuestListControls from '@/components/dashboard/guests/GuestListControls';
import { useGuestListFilters } from '@/components/dashboard/guests/use-guest-list-filters';
import { useGuestListView } from '@/components/dashboard/guests/use-guest-list-view';
import { useGuestChangeNotice } from '@/components/dashboard/guests/use-guest-change-notice';
import { useGuestBatchSelection } from '@/components/dashboard/guests/use-guest-batch-selection';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareMessagesModal from '@/components/dashboard/guests/ShareMessagesModal';
import ToolbarActionsMenu from '@/components/dashboard/guests/ToolbarActionsMenu';
import Toast from '@/components/dashboard/guests/Toast';
import {
	buildGuestGroupScope,
	computeGroupMetrics,
	computeGuestSummary,
	getBatchCandidates,
	getGuestInviteUrl,
} from '@/components/dashboard/guests/guest-presenter';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';
import {
	getReminderEligibleGuests,
	shouldShowReminderCta,
} from '@/components/dashboard/guests/reminder-eligibility';
import type {
	ReminderSettings,
	ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import { useShortcuts } from '@/hooks/use-shortcuts';
import '@/styles/dashboard/_guests.scss';

interface GuestDashboardAppProps {
	initialEventId: string;
}

function s(count: number) {
	return count !== 1 ? 's' : '';
}

/** Days left plus who the reminder reaches, phrased for the configured audience. */
function formatReminderHint(
	dateContext: ShareMessageDateContext,
	audience: ReminderSettings['audience'],
	count: number,
): string | null {
	if (dateContext.rawDaysUntilEvent === null) return null;
	const days = `Faltan ${dateContext.daysUntilEvent} día${s(dateContext.rawDaysUntilEvent)}`;
	return audience === 'unconfirmed'
		? `${days} · ${count} invitado${s(count)} sin confirmar`
		: `${days} · ${count} invitado${s(count)} activo${s(count)} con invitación enviada`;
}

const GuestDashboardApp: React.FC<GuestDashboardAppProps> = ({ initialEventId }) => {
	const [detailGuestId, setDetailGuestId] = useState<string | null>(null);
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
	} = useGuestDashboardRealtime({ initialEventId });
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

	// Always the whole event: search and filters only narrow the list below.
	const summary = useMemo(() => computeGuestSummary(items), [items]);
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

	const reminderHint = showReminderCta
		? formatReminderHint(shareDateContext, reminderSettings.audience, eligibleGuestIds.size)
		: null;

	const {
		search,
		setSearch,
		group,
		setGroup,
		reviewFilter,
		setReviewFilter,
		visibleItems,
		isFiltered,
		clearFilters,
	} = useGuestListFilters(items, eligibleGuestIds);
	const groupMetrics = useMemo(() => computeGroupMetrics(items), [items]);
	// With a group selected, the next step speaks for that group only.
	const groupScope = useMemo(() => {
		const scope = buildGuestGroupScope(items, group, eligibleGuestIds);
		if (!scope) return null;
		return { ...scope, reminderCount: showReminderCta ? scope.reminderCount : 0 };
	}, [items, group, eligibleGuestIds, showReminderCta]);
	const isInitialLoad = loading && items.length === 0 && !error;
	const showOverview = !isInitialLoad && !error;

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
		handleUpdateGroups,
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

				{error && <GuestLoadError message={error} onRetry={loadGuests} />}

				{isInitialLoad && <GuestOverviewSkeleton />}
				{showOverview && (
					<GuestStatusOverview
						summary={summary}
						activeFilter={reviewFilter}
						onFilterChange={setReviewFilter}
						reminderCount={showReminderCta ? eligibleGuestIds.size : 0}
						reminderHint={reminderHint}
						withMessageCount={withMessageCount}
						rsvpDeadline={shareDateContext.rsvpDeadline}
						eventTitle={currentEventTitle}
						nextStepScope={groupScope ?? undefined}
						onRemind={() =>
							batchSelection.requestBatch('reminder', groupScope?.reminderIds ?? null)
						}
						onSendPending={() =>
							batchSelection.requestBatch('invitation', groupScope?.toSendIds ?? null)
						}
					/>
				)}

				<GuestGroupMetrics
					metrics={groupMetrics}
					activeGroup={group}
					onSelectGroup={setGroup}
				/>

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
					group={group}
					groupMetrics={groupMetrics}
					totalInvitations={items.length}
					onSearchChange={setSearch}
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

				<GuestListFeedback
					total={items.length}
					visible={visibleItems.length}
					filtered={isFiltered}
					onClear={clearFilters}
				/>

				<GuestTable
					items={visibleItems}
					inviteBaseUrl={inviteBaseUrl}
					eventTitle={currentEventTitle}
					shareTemplates={shareTemplates}
					shareDateContext={shareDateContext}
					celebratingGuestId={celebratingGuestId}
					selectedGuestId={detailGuestId}
					reminderMode={showReminderCta}
					eligibleGuestIds={eligibleGuestIds}
					onReminderSent={handleReminderSent}
					onMarkShared={handleMarkShared}
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
						onUpdateGroups={handleUpdateGroups}
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
