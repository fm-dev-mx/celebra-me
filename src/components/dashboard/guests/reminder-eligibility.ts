import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type {
	ReminderAudience,
	ReminderSettings,
} from '@/lib/rsvp/services/shared/share-message-defaults';

export function getReminderEligibleGuests(
	items: DashboardGuestItem[],
	audience: ReminderAudience,
): DashboardGuestItem[] {
	return items.filter((item) => {
		if (item.deliveryStatus !== 'shared') return false;

		if (audience === 'unconfirmed') {
			return item.attendanceStatus !== 'confirmed' && item.attendanceStatus !== 'declined';
		}

		return item.attendanceStatus !== 'declined';
	});
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
