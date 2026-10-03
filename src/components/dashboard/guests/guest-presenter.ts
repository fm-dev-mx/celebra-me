import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import { isUnconfirmedSharedGuest } from '@/lib/guests/reminder-eligibility';
import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';
import { formatMessageTimestamp, parseGuestCommentHistory } from '@/lib/rsvp/core/guest-message';

export type { GuestMessageEntry } from '@/lib/rsvp/core/guest-message';
export { parseGuestCommentHistory } from '@/lib/rsvp/core/guest-message';

export function resolveLabel(
	timestampLabel: string | undefined,
	fallbackIso: string | undefined,
): string {
	if (timestampLabel) return timestampLabel;
	if (fallbackIso) {
		const d = new Date(fallbackIso);
		if (!isNaN(d.getTime())) return formatMessageTimestamp(d);
	}
	return '—';
}

export function getGuestMessageFallbackTimestamp(item: DashboardGuestItem): string {
	return item.respondedAt ?? item.updatedAt;
}

export function formatGuestEntrySource(item: DashboardGuestItem) {
	const isPublic = item.entrySource === 'generic_public' || item.tags.includes('system:public');
	return isPublic ? 'RSVP público' : 'Invitación personalizada';
}

export type ShareFlowMode =
	'pending-invitation' | 'single-invitation' | 'pending-reminder' | 'single-reminder';

export type GuestSaveCallback = (
	guestId: string,
	payload: {
		fullName: string;
		maxAllowedAttendees: number;
		phone?: string | null;
		countryCode?: string;
	},
) => Promise<DashboardGuestItem>;

export { formatPhoneDisplay } from '@/lib/phone/format';

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
): string {
	const parts = [`#${String(index).padStart(2, '0')}`];
	parts.push(`${attendeeCount}/${maxAllowedAttendees} asistentes`);
	return parts.join(' · ');
}

export type GuestPrimaryAction = {
	label: string;
	action: 'share' | 'copy-link' | 'send-reminder';
};

export function getGuestPrimaryAction(
	item: DashboardGuestItem,
	reminderMode = false,
	isReminderEligible = false,
): GuestPrimaryAction {
	if (reminderMode && isReminderEligible) {
		return { label: 'Recordar', action: 'send-reminder' };
	}
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

export interface GuestStatusCounts {
	total: number;
	toSend: number;
	waiting: number;
	confirmed: number;
	declined: number;
	confirmedPeople: number;
}

export type GuestStatusBucket = 'to-send' | 'waiting' | 'confirmed' | 'declined';

/** One bucket per guest: RSVP answers win over delivery state. */
export function getGuestStatusBucket(item: DashboardGuestItem): GuestStatusBucket {
	if (item.attendanceStatus === 'confirmed') return 'confirmed';
	if (item.attendanceStatus === 'declined') return 'declined';
	if (item.deliveryStatus === 'generated') return 'to-send';
	return 'waiting';
}

export function computeGuestStatusCounts(items: DashboardGuestItem[]): GuestStatusCounts {
	const counts: GuestStatusCounts = {
		total: items.length,
		toSend: 0,
		waiting: 0,
		confirmed: 0,
		declined: 0,
		confirmedPeople: 0,
	};
	for (const item of items) {
		switch (getGuestStatusBucket(item)) {
			case 'confirmed':
				counts.confirmed++;
				counts.confirmedPeople += item.attendeeCount;
				break;
			case 'declined':
				counts.declined++;
				break;
			case 'to-send':
				counts.toSend++;
				break;
			case 'waiting':
				counts.waiting++;
				break;
		}
	}
	return counts;
}

export interface GuestStatusSection {
	bucket: GuestStatusBucket;
	title: string;
	items: DashboardGuestItem[];
}

const STATUS_SECTION_TITLES: Record<GuestStatusBucket, string> = {
	'to-send': 'Por enviar',
	waiting: 'Esperando respuesta',
	confirmed: 'Confirmados',
	declined: 'No asistirán',
};

const STATUS_SECTION_ORDER: GuestStatusBucket[] = ['to-send', 'waiting', 'confirmed', 'declined'];

/** Non-empty status sections in journey order, guests sorted by name inside each. */
export function groupGuestsByStatus(items: DashboardGuestItem[]): GuestStatusSection[] {
	const buckets = new Map<GuestStatusBucket, DashboardGuestItem[]>();
	for (const item of items) {
		const bucket = getGuestStatusBucket(item);
		const list = buckets.get(bucket) ?? [];
		list.push(item);
		buckets.set(bucket, list);
	}
	return STATUS_SECTION_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
		bucket,
		title: STATUS_SECTION_TITLES[bucket],
		items: [...(buckets.get(bucket) ?? [])].sort((a, b) =>
			a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }),
		),
	}));
}

function formatPeople(count: number): string {
	return `${count} ${count === 1 ? 'persona' : 'personas'}`;
}

function formatDaysAgo(iso: string | null | undefined, now: Date): string | null {
	if (!iso) return null;
	const sent = new Date(iso);
	if (isNaN(sent.getTime())) return null;
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((startOfDay(now) - startOfDay(sent)) / 86_400_000);
	if (days <= 0) return 'hoy';
	if (days === 1) return 'ayer';
	return `hace ${days} días`;
}

/** Second line of a compact guest row, phrased for the guest's current status. */
export function getGuestListSubtitle(item: DashboardGuestItem, now: Date = new Date()): string {
	switch (getGuestStatusBucket(item)) {
		case 'confirmed':
			return `${item.attendeeCount === 1 ? 'Viene' : 'Vienen'} ${item.attendeeCount} de ${item.maxAllowedAttendees}`;
		case 'declined':
			return 'Avisó que no podrá ir';
		case 'to-send':
			return `${formatPeople(item.maxAllowedAttendees)} · Sin enviar`;
		case 'waiting': {
			if (item.isViewed) return `${formatPeople(item.maxAllowedAttendees)} · Ya la abrió`;
			const sentAgo = formatDaysAgo(item.firstSharedAt, now);
			return `${formatPeople(item.maxAllowedAttendees)} · ${sentAgo ? `Enviada ${sentAgo}` : 'Enviada'}`;
		}
	}
}

export type GuestSummaryTone = 'empty' | 'pending' | 'waiting' | 'done';

export interface GuestSummaryMessage {
	/** Large leading number; null when the sentence carries no count. */
	count: number | null;
	title: string;
	detail: string;
	tone: GuestSummaryTone;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return count === 1 ? singular : pluralForm;
}

/** Plain-language status line for the host, written for non-technical readers. */
export function getGuestSummaryMessage(counts: GuestStatusCounts): GuestSummaryMessage {
	if (counts.total === 0) {
		return {
			count: null,
			title: 'Todavía no tiene invitados',
			detail: 'Agregue su primer invitado para empezar.',
			tone: 'empty',
		};
	}
	if (counts.toSend > 0) {
		let detail = 'Todavía nadie ha respondido.';
		if (counts.confirmed > 0) {
			detail = `${counts.confirmed} ya ${plural(counts.confirmed, 'confirmó', 'confirmaron')}.`;
		} else if (counts.waiting > 0) {
			detail = `${counts.waiting} ${plural(counts.waiting, 'espera', 'esperan')} respuesta.`;
		}
		return {
			count: counts.toSend,
			title: plural(counts.toSend, 'invitación por enviar', 'invitaciones por enviar'),
			detail,
			tone: 'pending',
		};
	}
	if (counts.waiting > 0) {
		return {
			count: counts.waiting,
			title: plural(
				counts.waiting,
				'invitado no ha respondido',
				'invitados no han respondido',
			),
			detail: 'Puede enviarles un recordatorio.',
			tone: 'waiting',
		};
	}
	return {
		count: null,
		title: 'Todos sus invitados ya respondieron',
		detail:
			counts.confirmedPeople === 1
				? 'Viene 1 persona.'
				: `Vienen ${counts.confirmedPeople} personas.`,
		tone: 'done',
	};
}

export type GuestProgressState = 'done' | 'current' | 'upcoming';

export interface GuestProgressStep {
	label: string;
	state: GuestProgressState;
	note?: string;
}

/** Three-step invitation journey shown in the guest detail screen. */
export function getGuestProgressSteps(item: DashboardGuestItem): GuestProgressStep[] {
	const bucket = getGuestStatusBucket(item);
	const answered = bucket === 'confirmed' || bucket === 'declined';
	const sent = hasBeenShared(item) || answered;
	let answer: string | undefined;
	if (bucket === 'confirmed') {
		answer = `${item.attendeeCount === 1 ? 'Viene' : 'Vienen'} ${item.attendeeCount} de ${item.maxAllowedAttendees}`;
	} else if (bucket === 'declined') {
		answer = 'No podrán ir';
	}
	return [
		{ label: 'Enviar la invitación', state: sent ? 'done' : 'current' },
		{
			label: 'Esperar su respuesta',
			state: answered ? 'done' : sent ? 'current' : 'upcoming',
			note: !answered && item.isViewed ? 'Ya la abrió' : undefined,
		},
		{ label: 'Saber si vienen y cuántos', state: answered ? 'done' : 'upcoming', note: answer },
	];
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

export function hasBeenShared(item: DashboardGuestItem): boolean {
	if (item.deliveryStatus === 'generated') return false;
	if (item.deliveryStatus === 'shared') return true;
	return Boolean(item.firstSharedAt);
}

export function getShareCtaLabel(item: DashboardGuestItem): {
	label: string;
	defaultMessageType: ShareMessageType;
} {
	const shared = hasBeenShared(item);
	return {
		label: shared ? 'Enviar recordatorio' : 'Compartir invitación',
		defaultMessageType: shared ? 'reminder' : 'invitation',
	};
}

export function resolveShareFlowMode(guest: DashboardGuestItem): ShareFlowMode {
	return hasBeenShared(guest) ? 'single-reminder' : 'single-invitation';
}
