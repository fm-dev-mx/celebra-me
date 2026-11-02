import type {
	DashboardGuestItem,
	DashboardMemoriesReminder,
} from '@/interfaces/dashboard/guest.interface';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type {
	ReminderAudience,
	ReminderSettings,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { isUnconfirmedSharedGuest } from '@/lib/guests/reminder-eligibility';

export function getReminderEligibleGuests(
	items: DashboardGuestItem[],
	audience: ReminderAudience,
): DashboardGuestItem[] {
	return items.filter((item) => {
		if (item.deliveryStatus !== 'shared') return false;
		if (item.lastReminderSentAt) return false;

		if (audience === 'unconfirmed') {
			return isUnconfirmedSharedGuest(item);
		}

		return item.attendanceStatus !== 'declined';
	});
}

/** Guests who got the invitation and did not decline can be asked for their photos once. */
export function getMemoriesReminderEligibleGuests(
	items: DashboardGuestItem[],
): DashboardGuestItem[] {
	return items.filter(
		(item) =>
			item.deliveryStatus === 'shared' &&
			item.attendanceStatus !== 'declined' &&
			!item.lastMemoriesReminderSentAt,
	);
}

/** Shown from the event day on, while the photo space accepts uploads (memoriesReminder set). */
export function shouldShowMemoriesReminderCta(
	shareDateContext: ShareMessageDateContext,
	memoriesReminder: DashboardMemoriesReminder | null | undefined,
	eligibleCount: number,
): boolean {
	if (!memoriesReminder || eligibleCount === 0) return false;
	const rawDays = shareDateContext.rawDaysUntilEvent;
	return rawDays === null || rawDays <= 0;
}

export function shouldShowReminderCta(
	shareDateContext: ShareMessageDateContext,
	settings: ReminderSettings,
	eligibleCount: number,
): boolean {
	if (!settings.enabled) return false;

	const rawDays = shareDateContext.rawDaysUntilEvent;
	if (rawDays === null || rawDays < 0) return false;

	return rawDays <= settings.showWhenDaysBeforeEvent && eligibleCount > 0;
}
