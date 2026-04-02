import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';

export function formatGuestDate(value: string | null): string {
	if (!value) return '-';
	try {
		return new Date(value).toLocaleString('es-MX');
	} catch {
		return value;
	}
}

export function formatGuestEntrySource(entrySource?: DashboardGuestItem['entrySource']) {
	return entrySource === 'generic_public' ? 'RSVP público' : 'Invitación personalizada';
}

export function getGuestAttendanceLabel(status: DashboardGuestItem['attendanceStatus']) {
	if (status === 'pending') return 'Pendiente';
	if (status === 'confirmed') return 'Confirmado';
	return 'Declinó';
}

export function getGuestInviteUrl(item: DashboardGuestItem, inviteBaseUrl: string) {
	const baseUrl = inviteBaseUrl.replace(/\/+$/, '');
	if (!item.eventType || !item.eventSlug) {
		return `${baseUrl}/invitacion/${encodeURIComponent(item.inviteId)}`;
	}

	return generateInvitationLink({
		origin: baseUrl,
		eventType: item.eventType,
		eventSlug: item.eventSlug,
		inviteId: item.inviteId,
		shortId: item.shortId,
	});
}
