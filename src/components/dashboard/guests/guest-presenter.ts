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

export type PrimaryStatus = {
	label: string;
	class: string;
};

/**
 * 5-state primary status for the closed card.
 *
 * Priority order:
 *   1. confirmed / declined  (terminal RSVP)
 *   2. generated             (not yet sent)
 *   3. shared + not viewed   (sent, awaiting open — Enviada)
 *   4. shared + viewed       (opened, awaiting RSVP — Recibida)
 */
export function getPrimaryStatus(item: DashboardGuestItem): PrimaryStatus {
	if (item.attendanceStatus === 'confirmed') return { label: 'Confirmada', class: 'confirmed' };
	if (item.attendanceStatus === 'declined') return { label: 'No asiste', class: 'declined' };
	if (item.deliveryStatus === 'generated') return { label: 'Por enviar', class: 'unshared' };
	if (!item.isViewed) return { label: 'Enviada', class: 'sent' };
	return { label: 'Recibida', class: 'pending' };
}

/** Displayable contact: phone > email > "Sin teléfono registrado" */
export function getContactDisplay(item: DashboardGuestItem): string {
	if (item.phone?.trim()) return item.phone.trim();
	if (item.email?.trim()) return item.email.trim();
	return 'Sin teléfono registrado';
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
	return item.deliveryStatus === 'shared' ? 'Enviado' : 'Por enviar';
}

export function getRsvpStateLabel(item: DashboardGuestItem): string {
	if (item.attendanceStatus === 'confirmed') return 'Confirmada';
	if (item.attendanceStatus === 'declined') return 'No asiste';
	return 'Sin respuesta';
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
