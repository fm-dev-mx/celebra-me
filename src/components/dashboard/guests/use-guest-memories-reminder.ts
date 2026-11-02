import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import {
	getMemoriesReminderEligibleGuests,
	shouldShowMemoriesReminderCta,
} from '@/components/dashboard/guests/reminder-eligibility';
import { buildMemoriesReminderTemplate } from '@/components/dashboard/guests/memories-reminder-message';
import type {
	DashboardGuestItem,
	DashboardMemoriesReminder,
} from '@/interfaces/dashboard/guest.interface';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface UseGuestMemoriesReminderOptions {
	items: DashboardGuestItem[];
	memoriesReminder: DashboardMemoriesReminder | null;
	shareDateContext: ShareMessageDateContext;
	setItems: Dispatch<SetStateAction<DashboardGuestItem[]>>;
}

/** Post-event photo request: who still needs the link, its message, and optimistic recording. */
export function useGuestMemoriesReminder({
	items,
	memoriesReminder,
	shareDateContext,
	setItems,
}: UseGuestMemoriesReminderOptions) {
	const eligibleGuests = useMemo(() => getMemoriesReminderEligibleGuests(items), [items]);
	const showCta = shouldShowMemoriesReminderCta(
		shareDateContext,
		memoriesReminder,
		eligibleGuests.length,
	);
	const template = useMemo(
		() => (memoriesReminder ? buildMemoriesReminderTemplate(memoriesReminder) : undefined),
		[memoriesReminder],
	);

	const handleSent = useCallback(
		async (guestId: string) => {
			let previousValue: string | null | undefined;
			setItems((prev) => {
				const target = prev.find((g) => g.guestId === guestId);
				previousValue = target?.lastMemoriesReminderSentAt;
				return prev.map((item) =>
					item.guestId === guestId
						? { ...item, lastMemoriesReminderSentAt: new Date().toISOString() }
						: item,
				);
			});
			try {
				await guestsApi.recordMemoriesReminderSent(guestId);
			} catch {
				setItems((prev) =>
					prev.map((item) =>
						item.guestId === guestId
							? { ...item, lastMemoriesReminderSentAt: previousValue }
							: item,
					),
				);
			}
		},
		[setItems],
	);

	return {
		eligibleGuests,
		showCta,
		template,
		url: memoriesReminder?.url ?? '',
		handleSent,
	};
}
