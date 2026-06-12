import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import { isUnconfirmedSharedGuest } from '@/components/dashboard/guests/reminder-eligibility';
import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';
import { parseGuestCommentHistory } from '@/lib/rsvp/core/guest-message';

export type { GuestMessageEntry } from '@/lib/rsvp/core/guest-message';
export { parseGuestCommentHistory } from '@/lib/rsvp/core/guest-message';

export function formatGuestEntrySource(item: DashboardGuestItem) {
	const isPublic = item.entrySource === 'generic_public' || item.tags.includes('system:public');
	return isPublic ? 'RSVP público' : 'Invitación personalizada';
}

export type ShareFlowMode =
	| 'pending-invitation'
	| 'single-invitation'
	| 'pending-reminder'
	| 'single-reminder';

export type GuestSaveCallback = (
	guestId: string,
	payload: {
		fullName: string;
		maxAllowedAttendees: number;
		phone?: string | null;
		countryCode?: string;
	},
) => Promise<DashboardGuestItem>;

export function formatGuestDateShort(value: string | null): string {
	if (!value) return '-';
	const date = new Date(value);
	if (isNaN(date.getTime())) return value;
	return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type PrimaryStatus = {
	label: string;
	class: string;
};

export function getPrimaryStatus(item: DashboardGuestItem): PrimaryStatus {
	if (item.attendanceStatus === 'confirmed') return { label: 'Confirmada', class: 'confirmed' };
	if (item.attendanceStatus === 'declined') return { label: 'No asiste', class: 'declined' };
	if (item.deliveryStatus === 'generated') return { label: 'Por enviar', class: 'unshared' };
	if (isUnconfirmedSharedGuest(item))
		return { label: 'Por confirmar', class: 'pending-confirmation' };
	return { label: 'Enviada', class: 'sent' };
}

export function formatGuestMessageCount(count: number): string {
	return count === 1 ? '1 mensaje' : `${count} mensajes`;
}

export function getGuestMessageCount(guestComment: string): number {
	return parseGuestCommentHistory(guestComment).length;
}

export function formatGuestMetadataRow(
	index: number,
	attendeeCount: number,
	maxAllowedAttendees: number,
	messageCount: number,
): string {
	const parts = [`#${String(index).padStart(2, '0')}`];
	parts.push(`${attendeeCount}/${maxAllowedAttendees} asistentes`);
	if (messageCount > 0) {
		parts.push(formatGuestMessageCount(messageCount));
	}
	return parts.join(' · ');
}

export type GuestPrimaryAction = {
	label: string;
	action: 'share' | 'copy-link';
};

export function getGuestPrimaryAction(item: DashboardGuestItem): GuestPrimaryAction {
	if (item.attendanceStatus === 'confirmed' || item.attendanceStatus === 'declined') {
		return { label: 'Copiar enlace', action: 'copy-link' };
	}
	if (item.deliveryStatus === 'generated') {
		return { label: 'Compartir invitación', action: 'share' };
	}
	return { label: 'Enviar recordatorio', action: 'share' };
}

/** Expanded-panel detail labels */
export function getDeliveryStateLabel(item: DashboardGuestItem): string {
	return item.deliveryStatus === 'shared' ? 'Enviado' : 'Por enviar';
}

export function normalizeViewPercentage(value: number): number {
	return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

export function getCompactGroupChips(
	item: DashboardGuestItem,
	max = 2,
): { chips: string[]; overflow: number } {
	const visible = getVisibleTags(item.tags);
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
		const visible = getVisibleTags(item.tags);
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
	priority: 'primary' | 'secondary';
}

export function hasBeenShared(item: DashboardGuestItem): boolean {
	if (item.deliveryStatus === 'generated') return false;
	if (item.deliveryStatus === 'shared') return true;
	return Boolean(item.firstSharedAt);
}

export function getShareCtaLabel(item: DashboardGuestItem): ShareCtaResult {
	const shared = hasBeenShared(item);

	const priority: ShareCtaResult['priority'] =
		!shared || item.attendanceStatus === 'pending' ? 'primary' : 'secondary';

	return {
		label: shared ? 'Enviar recordatorio' : 'Compartir invitación',
		defaultMessageType: shared ? 'reminder' : 'invitation',
		priority,
	};
}

export function resolveShareFlowMode(guest: DashboardGuestItem): ShareFlowMode {
	return hasBeenShared(guest) ? 'single-reminder' : 'single-invitation';
}
