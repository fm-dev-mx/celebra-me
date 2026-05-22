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

export function formatGuestEntrySource(item: DashboardGuestItem) {
	const isPublic =
		item.entrySource === 'generic_public' || (item.tags ?? []).includes('system:public');
	return isPublic ? 'RSVP público' : 'Invitación personalizada';
}

export function getGuestVisibleTags(item: DashboardGuestItem) {
	return (item.tags ?? []).filter((tag) => !tag.startsWith('system:'));
}

/**
 * 5-state primary status for the closed card.
 *
 * Priority order:
 *   1. confirmed / declined  (terminal RSVP)
 *   2. generated             (not yet sent)
 *   3. shared + not viewed   (sent, awaiting open)
 *   4. shared + viewed       (opened, awaiting RSVP)
 */
export function getPrimaryStatusLabel(item: DashboardGuestItem) {
	if (item.attendanceStatus === 'confirmed') return 'Aceptada';
	if (item.attendanceStatus === 'declined') return 'Denegada';
	if (item.deliveryStatus === 'generated') return 'Por enviar';
	if (!item.isViewed) return 'Recibida';
	return 'Enviada';
}

export function getPrimaryStatusClass(item: DashboardGuestItem) {
	if (item.attendanceStatus === 'confirmed') return 'confirmed';
	if (item.attendanceStatus === 'declined') return 'declined';
	if (item.deliveryStatus === 'generated') return 'unshared';
	if (!item.isViewed) return 'sent';
	return 'pending';
}

/** Returns true when the phone number contains at least 8 digits */
export function validatePhone(phone: string): boolean {
	const digits = phone.replace(/\D/g, '');
	return digits.length >= 8;
}

/** Displayable contact: phone > email > "Sin contacto" */
export function getContactDisplay(item: DashboardGuestItem): string {
	if (item.phone?.trim()) return item.phone.trim();
	if (item.email?.trim()) return item.email.trim();
	return 'Sin contacto';
}

export function hasContact(item: DashboardGuestItem): boolean {
	return !!(item.phone || item.email);
}

/** True when the guest left an RSVP comment/message */
export function hasMessage(item: DashboardGuestItem): boolean {
	return item.guestComment.trim().length > 0;
}

/** Expanded-panel detail labels */
export function getDeliveryStateLabel(item: DashboardGuestItem): string {
	return item.deliveryStatus === 'shared' ? 'Enviado' : 'No enviado';
}

export function getRsvpStateLabel(item: DashboardGuestItem): string {
	if (item.attendanceStatus === 'confirmed') return 'Aceptada';
	if (item.attendanceStatus === 'declined') return 'Denegada';
	return 'Pendiente';
}

export function getViewStateLabel(item: DashboardGuestItem): string {
	if (!item.isViewed) return 'Sin ver';
	return `${item.viewPercentage}%`;
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
