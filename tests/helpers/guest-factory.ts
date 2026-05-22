import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

export function makeGuest(overrides: Partial<DashboardGuestItem> = {}): DashboardGuestItem {
	return {
		guestId: 'guest-1',
		inviteId: 'invite-1',
		fullName: 'Guest One',
		phone: '6691234567',
		countryCode: '+52',
		email: null,
		tags: [],
		metadata: {},
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: null,
		waShareUrl: 'https://wa.me/526691234567',
		shareText: 'Share text',
		updatedAt: '2026-03-22T00:00:00.000Z',
		...overrides,
	};
}
