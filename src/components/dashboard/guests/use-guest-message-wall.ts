import { useMemo } from 'react';
import {
	buildGuestMessageWall,
	countNewGuestMessages,
	getReviewFilterLabel,
	type GuestReviewFilterValue,
} from '@/components/dashboard/guests/guest-presenter';
import { useGuestMessagesSeen } from '@/components/dashboard/guests/use-guest-messages-seen';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

/**
 * Message wall state for the guest dashboard: the messages, how many are new
 * since the host's last read, and whether "Con mensaje" shows the wall instead
 * of the rows (selection mode keeps the rows).
 */
export function useGuestMessageWall(
	items: DashboardGuestItem[],
	eventId: string | undefined,
	reviewFilter: GuestReviewFilterValue,
	selectionMode: boolean,
) {
	const entries = useMemo(() => buildGuestMessageWall(items), [items]);
	const { seenAt, markSeen } = useGuestMessagesSeen(eventId);
	const messageWall = reviewFilter === 'with-message' && !selectionMode;

	return {
		messageCount: entries.length,
		newMessageCount: countNewGuestMessages(entries, seenAt),
		seenAt,
		markSeen,
		messageWall,
		activeFilterLabel: messageWall ? null : getReviewFilterLabel(reviewFilter),
	};
}
