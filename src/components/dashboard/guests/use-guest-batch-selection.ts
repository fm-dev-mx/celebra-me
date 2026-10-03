import { useState } from 'react';
import { getBatchCandidates } from '@/components/dashboard/guests/guest-presenter';
import type { BatchFlowKind } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface BatchRequest {
	kind: BatchFlowKind;
	/** null means every pending guest of that kind, as the dock offers. */
	guestIds: ReadonlySet<string> | null;
}

interface UseGuestBatchSelectionOptions {
	items: DashboardGuestItem[];
	pendingGuests: DashboardGuestItem[];
	reminderEligibleGuests: DashboardGuestItem[];
	openBatchForGuests: (kind: BatchFlowKind, guestIds: Iterable<string>) => void;
	openNextGeneratedGuest: () => void;
	openNextReminderGuest: () => void;
}

/**
 * Selection mode plus the confirmation step every one-by-one batch goes through,
 * whether it starts from the dock (all pending) or from selected guests.
 */
export function useGuestBatchSelection({
	items,
	pendingGuests,
	reminderEligibleGuests,
	openBatchForGuests,
	openNextGeneratedGuest,
	openNextReminderGuest,
}: UseGuestBatchSelectionOptions) {
	const [selectionMode, setSelectionMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [batchRequest, setBatchRequest] = useState<BatchRequest | null>(null);

	const toggleSelected = (guestId: string) =>
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(guestId)) next.delete(guestId);
			else next.add(guestId);
			return next;
		});

	const finishSelection = () => {
		setSelectionMode(false);
		setSelectedIds(new Set());
	};

	let batchGuests: DashboardGuestItem[] = [];
	if (batchRequest?.guestIds) {
		batchGuests = getBatchCandidates(items, batchRequest.kind, batchRequest.guestIds);
	} else if (batchRequest) {
		batchGuests = batchRequest.kind === 'reminder' ? reminderEligibleGuests : pendingGuests;
	}

	const confirmBatch = () => {
		if (!batchRequest) return;
		const { kind, guestIds } = batchRequest;
		setBatchRequest(null);
		if (guestIds) {
			openBatchForGuests(kind, guestIds);
			finishSelection();
		} else if (kind === 'reminder') {
			openNextReminderGuest();
		} else {
			openNextGeneratedGuest();
		}
	};

	return {
		selectionMode,
		selectedIds,
		/** GuestTable selection prop; undefined outside selection mode. */
		tableSelection: selectionMode ? { selectedIds, onToggle: toggleSelected } : undefined,
		startSelection: () => setSelectionMode(true),
		finishSelection,
		toggleSelected,
		selectGuests: (guestIds: Iterable<string>) => setSelectedIds(new Set(guestIds)),
		selectedSendCount: getBatchCandidates(items, 'invitation', selectedIds).length,
		selectedRemindCount: getBatchCandidates(items, 'reminder', selectedIds).length,
		/** Asks for confirmation before a batch; null ids target every pending guest. */
		requestBatch: (kind: BatchFlowKind, guestIds: ReadonlySet<string> | null) =>
			setBatchRequest({ kind, guestIds: guestIds ? new Set(guestIds) : null }),
		batchRequest,
		batchGuests,
		confirmBatch,
		cancelBatch: () => setBatchRequest(null),
	};
}
