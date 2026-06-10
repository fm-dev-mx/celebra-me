import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';

export type ShareFlowMode = 'pending-invitation' | 'single-invitation' | 'single-reminder';

export type GuestSaveCallback = (
	guestId: string,
	payload: {
		fullName: string;
		maxAllowedAttendees: number;
		phone?: string | null;
		countryCode?: string;
	},
) => Promise<DashboardGuestItem>;

export function formatGuestDate(value: string | null): string {
	if (!value) return '-';
	const date = new Date(value);
	if (isNaN(date.getTime())) return value;
	return date.toLocaleString('es-MX');
}

export function formatGuestEntrySource(item: DashboardGuestItem) {
	const isPublic =
		item.entrySource === 'generic_public' || (item.tags ?? []).includes('system:public');
	return isPublic ? 'RSVP público' : 'Invitación personalizada';
}

export function getGuestVisibleTags(item: DashboardGuestItem) {
	return getVisibleTags(item.tags ?? []);
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
	return (item.guestComment ?? '').trim().length > 0;
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

export function normalizeViewPercentage(value: number): number {
	return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

export function getViewStateLabel(item: DashboardGuestItem): string {
	if (!item.isViewed) return 'Sin ver';
	return `${normalizeViewPercentage(item.viewPercentage)}%`;
}

export function getCompactGroupChips(
	item: DashboardGuestItem,
	max = 2,
): { chips: string[]; overflow: number } {
	const visible = getGuestVisibleTags(item);
	const chips = visible.slice(0, max);
	const overflow = Math.max(0, visible.length - max);
	return { chips, overflow };
}

export interface GroupMetric {
	tag: string;
	total: number;
	pending: number;
}

export function computeGroupMetrics(items: DashboardGuestItem[]): GroupMetric[] {
	const tagCounts = new Map<string, { total: number; pending: number }>();

	for (const item of items) {
		const visible = getGuestVisibleTags(item);
		const tags = visible.length > 0 ? visible : ['Sin grupo'];
		for (const tag of tags) {
			const entry = tagCounts.get(tag) ?? { total: 0, pending: 0 };
			entry.total++;
			if (item.attendanceStatus === 'pending') {
				entry.pending++;
			}
			tagCounts.set(tag, entry);
		}
	}

	return Array.from(tagCounts.entries())
		.map(([tag, counts]) => ({ tag, ...counts }))
		.sort((a, b) => b.total - a.total);
}

export function getGuestInviteUrl(item: DashboardGuestItem, inviteBaseUrl: string) {
	const baseUrl = inviteBaseUrl.replace(/\/+$/, '');
	if (!item.eventType || !item.eventSlug) {
		return `${baseUrl}/invitacion/${encodeURIComponent(item.inviteId)}`;
	}

	return generateInvitationLink({
		origin: inviteBaseUrl,
		eventType: item.eventType,
		eventSlug: item.eventSlug,
		inviteId: item.inviteId,
		shortId: item.shortId,
	});
}

export interface ShareCtaResult {
	label: string;
	defaultMessageType: ShareMessageType;
}

/** Defensive: considers a guest shared if firstSharedAt is set OR deliveryStatus is 'shared'. */
export function hasBeenShared(item: DashboardGuestItem): boolean {
	return Boolean(item.firstSharedAt) || item.deliveryStatus === 'shared';
}

export function getShareCtaLabel(item: DashboardGuestItem): ShareCtaResult {
	const shared = hasBeenShared(item);
	return {
		label: shared ? 'Enviar recordatorio' : 'Compartir invitación',
		defaultMessageType: shared ? 'reminder' : 'invitation',
	};
}

/** Determines the share flow mode based on guest history, not UI labels. */
export function resolveShareFlowMode(guest: DashboardGuestItem): ShareFlowMode {
	return hasBeenShared(guest) ? 'single-reminder' : 'single-invitation';
}
