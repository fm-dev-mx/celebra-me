import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

export function isUnconfirmedSharedGuest(item: DashboardGuestItem): boolean {
	return (
		item.deliveryStatus === 'shared' &&
		item.attendanceStatus !== 'confirmed' &&
		item.attendanceStatus !== 'declined'
	);
}
