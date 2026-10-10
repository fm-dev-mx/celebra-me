import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import { isUnconfirmedSharedGuest } from '@/lib/guests/reminder-eligibility';
import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';
import {
	formatMessageTimestamp,
	parseGuestCommentHistory,
	type GuestMessageEntry,
} from '@/lib/rsvp/core/guest-message';

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
	class: GuestStage;
};

const STAGE_LABELS: Record<GuestStage, string> = {
	'to-send': 'Por enviar',
	unopened: 'Enviada, sin abrir',
	opened: 'Abierta, sin responder',
	confirmed: 'Confirmada',
	declined: 'No asiste',
};

/** Status shown on rows, cards and the detail screen; the class doubles as the stage. */
export function getPrimaryStatus(item: DashboardGuestItem): PrimaryStatus {
	const stage = getGuestStage(item);
	return { label: STAGE_LABELS[stage], class: stage };
}

export function formatGuestMessageCount(count: number): string {
	return count === 1 ? '1 mensaje' : `${count} mensajes`;
}

export function getGuestMessageCount(guestComment: string): number {
	return parseGuestCommentHistory(guestComment).length;
}

/**
 * Date for one history entry. The first message carries no timestamp; the answer
 * date only describes it when it is the guest's sole message.
 */
export function getGuestMessageDateLabel(
	entry: GuestMessageEntry,
	totalEntries: number,
	fallbackIso: string | undefined,
): string {
	if (!entry.timestampLabel && totalEntries > 1) return 'Primer mensaje';
	return resolveLabel(entry.timestampLabel, fallbackIso);
}

export function getGuestLatestMessage(guestComment: string): string {
	return parseGuestCommentHistory(guestComment)[0]?.message ?? '';
}

export type GuestMessageWallEntry = {
	item: DashboardGuestItem;
	latest: string;
	timestampLabel: string;
	count: number;
};

/** Guests with a message, newest answer first, each with its latest message in full. */
export function buildGuestMessageWall(items: DashboardGuestItem[]): GuestMessageWallEntry[] {
	const entries: (GuestMessageWallEntry & { sortKey: number })[] = [];
	for (const item of items) {
		const history = parseGuestCommentHistory(item.guestComment);
		if (history.length === 0) continue;
		const fallbackIso = getGuestMessageFallbackTimestamp(item);
		const sortKey = Date.parse(fallbackIso);
		entries.push({
			item,
			latest: history[0].message,
			timestampLabel: getGuestMessageDateLabel(history[0], history.length, fallbackIso),
			count: history.length,
			sortKey: Number.isNaN(sortKey) ? 0 : sortKey,
		});
	}
	return entries
		.sort((a, b) => b.sortKey - a.sortKey)
		.map(({ sortKey: _sortKey, ...entry }) => entry);
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

export type GuestStatusBucket = 'to-send' | 'waiting' | 'confirmed' | 'declined';

/** One bucket per guest: RSVP answers win over delivery state. */
export function getGuestStatusBucket(item: DashboardGuestItem): GuestStatusBucket {
	if (item.attendanceStatus === 'confirmed') return 'confirmed';
	if (item.attendanceStatus === 'declined') return 'declined';
	if (item.deliveryStatus === 'generated') return 'to-send';
	return 'waiting';
}

/** Invitation journey stage: "waiting" split by whether the guest opened the invitation. */
export type GuestStage = 'to-send' | 'unopened' | 'opened' | 'confirmed' | 'declined';

export function getGuestStage(item: DashboardGuestItem): GuestStage {
	const bucket = getGuestStatusBucket(item);
	if (bucket !== 'waiting') return bucket;
	return item.isViewed || item.firstViewedAt ? 'opened' : 'unopened';
}

/** Unsent and unanswered: the only guests the "send invitations" queue should offer. */
export function isGuestToSend(item: DashboardGuestItem): boolean {
	return getGuestStage(item) === 'to-send';
}

function passesOf(item: DashboardGuestItem): number {
	return Math.max(0, item.maxAllowedAttendees || 0);
}

/** Confirmed attendees, clamped to the passes the invitation actually has. */
function attendingOf(item: DashboardGuestItem): number {
	return Math.min(passesOf(item), Math.max(0, item.attendeeCount || 0));
}

export interface GuestStageCount {
	invitations: number;
	passes: number;
}

/**
 * Event-wide overview. `people` splits every assigned pass into exactly one
 * slice; `stages` splits every invitation into exactly one journey stage.
 */
export interface GuestSummary {
	invitations: number;
	people: {
		assigned: number;
		confirmed: number;
		declined: number;
		unused: number;
		noAnswer: number;
	};
	stages: Record<GuestStage, GuestStageCount>;
	/** Sent and still unanswered (unopened + opened). */
	awaitingAnswer: GuestStageCount;
	/** Invitations without any pass; counted as invitations only. */
	withoutPasses: number;
}

export function computeGuestSummary(items: DashboardGuestItem[]): GuestSummary {
	const emptyStage = (): GuestStageCount => ({ invitations: 0, passes: 0 });
	const summary: GuestSummary = {
		invitations: items.length,
		people: { assigned: 0, confirmed: 0, declined: 0, unused: 0, noAnswer: 0 },
		stages: {
			'to-send': emptyStage(),
			unopened: emptyStage(),
			opened: emptyStage(),
			confirmed: emptyStage(),
			declined: emptyStage(),
		},
		awaitingAnswer: emptyStage(),
		withoutPasses: 0,
	};
	for (const item of items) {
		const passes = passesOf(item);
		const stage = getGuestStage(item);
		summary.people.assigned += passes;
		summary.stages[stage].invitations++;
		summary.stages[stage].passes += passes;
		if (passes === 0) summary.withoutPasses++;
		switch (stage) {
			case 'confirmed': {
				const attending = attendingOf(item);
				summary.people.confirmed += attending;
				summary.people.unused += passes - attending;
				break;
			}
			case 'declined':
				summary.people.declined += passes;
				break;
			default:
				summary.people.noAnswer += passes;
				if (stage !== 'to-send') {
					summary.awaitingAnswer.invitations++;
					summary.awaitingAnswer.passes += passes;
				}
		}
	}
	return summary;
}

function normalizeSearchText(value: string): string {
	return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Name (accent- and case-insensitive) or phone digits, like the server-side search did. */
export function matchesGuestSearch(item: DashboardGuestItem, query: string): boolean {
	const term = normalizeSearchText(query);
	if (!term) return true;
	if (normalizeSearchText(item.fullName).includes(term)) return true;
	const digits = query.replace(/\D/g, '');
	if (!digits) return false;
	const phoneTerm = digits.length > 10 ? digits.slice(-10) : digits;
	return (item.phone ?? '').replace(/\D/g, '').includes(phoneTerm);
}

export interface GuestPeopleLabel {
	primary: string;
	secondary?: string;
}

function formatPasses(count: number): string {
	return `${count} ${count === 1 ? 'pase' : 'pases'}`;
}

/** "Personas" cell: what the invitation means in people for its current stage. */
export function getGuestPeopleLabel(item: DashboardGuestItem): GuestPeopleLabel {
	const passes = passesOf(item);
	if (passes === 0) return { primary: 'Sin pases asignados' };
	switch (getGuestStage(item)) {
		case 'confirmed': {
			const attending = attendingOf(item);
			const unused = passes - attending;
			return {
				primary: `${attending === 1 ? 'Viene' : 'Vienen'} ${attending} de ${passes}`,
				secondary:
					unused > 0
						? `${unused} ${unused === 1 ? 'lugar no usado' : 'lugares no usados'}`
						: undefined,
			};
		}
		case 'declined':
			return {
				primary: 'No asistirán',
				secondary: `${passes} ${passes === 1 ? 'pase liberado' : 'pases liberados'}`,
			};
		default:
			return { primary: formatPasses(passes) };
	}
}

/** Plain-text summary the host can paste into WhatsApp. */
export function buildGuestSummaryShareText(
	summary: GuestSummary,
	eventTitle: string,
	rsvpDeadline: string,
): string {
	const { people, stages, awaitingAnswer } = summary;
	const lines = [
		eventTitle ? `${eventTitle}: resumen de invitados` : 'Resumen de invitados',
		`${people.confirmed} ${people.confirmed === 1 ? 'persona confirmada' : 'personas confirmadas'} de ${formatPasses(people.assigned)}.`,
		`No asistirán: ${people.declined}. Sin respuesta: ${people.noAnswer}.`,
	];
	if (awaitingAnswer.invitations > 0) {
		lines.push(
			`${awaitingAnswer.invitations} ${awaitingAnswer.invitations === 1 ? 'invitación enviada sigue' : 'invitaciones enviadas siguen'} sin respuesta.`,
		);
	}
	if (stages['to-send'].invitations > 0) {
		lines.push(`${stages['to-send'].invitations} por enviar.`);
	}
	if (rsvpDeadline) lines.push(`Fecha límite para confirmar: ${rsvpDeadline}.`);
	return lines.join('\n');
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

/** Second line of a compact guest row, phrased in passes and people for the current stage. */
export function getGuestListSubtitle(item: DashboardGuestItem, now: Date = new Date()): string {
	const stage = getGuestStage(item);
	if (stage === 'declined') return 'Avisó que no podrá ir';
	if (stage === 'confirmed') {
		const people = getGuestPeopleLabel(item);
		return people.secondary ? `${people.primary} · ${people.secondary}` : people.primary;
	}
	const passes = formatPasses(passesOf(item));
	if (stage === 'to-send') {
		return `${passes} · ${item.phone ? 'Sin enviar' : 'Sin teléfono'}`;
	}
	if (stage === 'opened') return `${passes} · Ya la abrió`;
	const sentAgo = formatDaysAgo(item.firstSharedAt, now);
	return `${passes} · ${sentAgo ? `Enviada ${sentAgo}` : 'Enviada'}`;
}

export type GuestProgressState = 'done' | 'current' | 'upcoming';

export interface GuestProgressStep {
	label: string;
	state: GuestProgressState;
	note?: string;
}

function formatStepDate(iso: string | null | undefined): string | undefined {
	if (!iso) return undefined;
	const date = new Date(iso);
	if (isNaN(date.getTime())) return undefined;
	return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/**
 * Sent → opened → answered, derived from the guest stage so the detail screen
 * never contradicts the list. An answer implies the invitation was sent and opened.
 */
export function getGuestProgressSteps(item: DashboardGuestItem): GuestProgressStep[] {
	const stage = getGuestStage(item);
	const answered = stage === 'confirmed' || stage === 'declined';
	const sent = stage !== 'to-send';
	const opened = answered || stage === 'opened';
	let answer = 'Pendiente';
	if (stage === 'confirmed') answer = getGuestPeopleLabel(item).primary;
	else if (stage === 'declined') answer = 'No asistirán';
	return [
		{
			label: 'Enviada',
			state: sent ? 'done' : 'current',
			note: sent ? formatStepDate(item.firstSharedAt) : 'Pendiente',
		},
		{
			label: 'Abierta',
			state: opened ? 'done' : sent ? 'current' : 'upcoming',
			note: opened ? formatStepDate(item.firstViewedAt) : undefined,
		},
		{
			label: 'Respuesta',
			state: answered ? 'done' : opened ? 'current' : 'upcoming',
			note: answer,
		},
	];
}

/** One plain sentence under the status pill: where the invitation stands right now. */
export function getGuestStatusSentence(item: DashboardGuestItem, now: Date = new Date()): string {
	switch (getGuestStage(item)) {
		case 'to-send':
			return item.phone
				? 'Todavía no la envía.'
				: 'Todavía no la envía. No tiene teléfono: copie el enlace para enviarlo.';
		case 'unopened': {
			const ago = formatDaysAgo(item.firstSharedAt, now);
			return ago ? `La envió ${ago}; aún no la abre.` : 'La envió; aún no la abre.';
		}
		case 'opened': {
			const ago = formatDaysAgo(item.firstViewedAt, now);
			return ago ? `La abrió ${ago} y aún no responde.` : 'La abrió y aún no responde.';
		}
		case 'confirmed': {
			const people = getGuestPeopleLabel(item);
			return people.secondary
				? `${people.primary} · ${people.secondary}.`
				: `${people.primary}.`;
		}
		case 'declined':
			return 'Avisó que no podrá ir.';
	}
}

/** Guests a host-chosen batch can act on: unsent for invitations, sent and unanswered for reminders. */
export function getBatchCandidates(
	items: DashboardGuestItem[],
	batchFlowKind: 'invitation' | 'reminder',
	guestIds: ReadonlySet<string>,
): DashboardGuestItem[] {
	const bucket: GuestStatusBucket = batchFlowKind === 'reminder' ? 'waiting' : 'to-send';
	return items.filter(
		(item) => guestIds.has(item.guestId) && getGuestStatusBucket(item) === bucket,
	);
}

export type GuestReviewFilterValue =
	| 'all'
	| 'reminder-pending'
	| 'delivery-pending'
	| 'unopened'
	| 'opened'
	| 'answered'
	| 'confirmation-pending'
	| 'confirmed'
	| 'declined'
	| 'with-message';

/**
 * Client-side review, group and search filtering of the full event list. The
 * overview always counts the unfiltered list, so filters never change totals.
 */
export function filterGuestsForReview(
	items: DashboardGuestItem[],
	{
		reviewFilter,
		group,
		reminderEligibleIds,
		search = '',
	}: {
		reviewFilter: GuestReviewFilterValue;
		group: string;
		reminderEligibleIds: ReadonlySet<string>;
		search?: string;
	},
): DashboardGuestItem[] {
	const matchesReview = (item: DashboardGuestItem): boolean => {
		switch (reviewFilter) {
			case 'reminder-pending':
				return reminderEligibleIds.has(item.guestId);
			case 'delivery-pending':
				// Mirrors the overview count: an answered guest is never "por enviar".
				return getGuestStage(item) === 'to-send';
			case 'unopened':
				return getGuestStage(item) === 'unopened';
			case 'opened':
				return getGuestStage(item) === 'opened';
			case 'answered':
				return (
					item.attendanceStatus === 'confirmed' || item.attendanceStatus === 'declined'
				);
			case 'confirmation-pending':
				return isUnconfirmedSharedGuest(item);
			case 'confirmed':
				return item.attendanceStatus === 'confirmed';
			case 'declined':
				return item.attendanceStatus === 'declined';
			case 'with-message':
				return (item.guestComment ?? '').trim().length > 0;
			default:
				return true;
		}
	};
	return items.filter(
		(item) =>
			matchesReview(item) &&
			matchesGuestGroup(item, group) &&
			matchesGuestSearch(item, search),
	);
}

/** Filter value for invitations without any visible group. */
export const NO_GROUP_FILTER = '__no-group__';
export const NO_GROUP_LABEL = 'Sin grupo';

export function getGuestGroups(item: DashboardGuestItem): string[] {
	return getVisibleTags(item.tags);
}

export function matchesGuestGroup(item: DashboardGuestItem, group: string): boolean {
	if (group === 'all') return true;
	const groups = getGuestGroups(item);
	return group === NO_GROUP_FILTER ? groups.length === 0 : groups.includes(group);
}

export interface GroupMetric {
	/** Filter value: the tag itself, or NO_GROUP_FILTER. */
	value: string;
	label: string;
	invitations: number;
	passes: number;
	confirmed: number;
	declined: number;
	noAnswer: number;
	/** Sent and unanswered invitations: the ones a group reminder reaches. */
	awaiting: number;
}

/**
 * Per-group people totals. An invitation in several groups counts in each, so
 * group rows are not meant to add up to the event total.
 */
export function computeGroupMetrics(items: DashboardGuestItem[]): GroupMetric[] {
	const metrics = new Map<string, GroupMetric>();
	for (const item of items) {
		const groups = getGuestGroups(item);
		const keys = groups.length > 0 ? groups : [NO_GROUP_FILTER];
		const summary = computeGuestSummary([item]);
		for (const key of keys) {
			const entry = metrics.get(key) ?? {
				value: key,
				label: key === NO_GROUP_FILTER ? NO_GROUP_LABEL : key,
				invitations: 0,
				passes: 0,
				confirmed: 0,
				declined: 0,
				noAnswer: 0,
				awaiting: 0,
			};
			entry.invitations++;
			entry.passes += summary.people.assigned;
			entry.confirmed += summary.people.confirmed;
			entry.declined += summary.people.declined;
			entry.noAnswer += summary.people.noAnswer;
			entry.awaiting += summary.awaitingAnswer.invitations;
			metrics.set(key, entry);
		}
	}
	// Groups by size, "Sin grupo" always last.
	return Array.from(metrics.values()).sort((a, b) => {
		if (a.value === NO_GROUP_FILTER) return 1;
		if (b.value === NO_GROUP_FILTER) return -1;
		return b.invitations - a.invitations;
	});
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

export interface GuestGroupScope {
	label: string;
	summary: GuestSummary;
	reminderCount: number;
	reminderIds: ReadonlySet<string>;
	toSendIds: ReadonlySet<string>;
}

/** Next-step data for the active group filter; null when no group is selected. */
export function buildGuestGroupScope(
	items: DashboardGuestItem[],
	group: string,
	reminderEligibleIds: ReadonlySet<string>,
): GuestGroupScope | null {
	if (group === 'all') return null;
	const groupItems = items.filter((item) => matchesGuestGroup(item, group));
	const reminderIds = new Set(
		groupItems.filter((item) => reminderEligibleIds.has(item.guestId)).map((i) => i.guestId),
	);
	return {
		label: group === NO_GROUP_FILTER ? NO_GROUP_LABEL : group,
		summary: computeGuestSummary(groupItems),
		reminderCount: reminderIds.size,
		reminderIds,
		toSendIds: new Set(groupItems.filter(isGuestToSend).map((item) => item.guestId)),
	};
}
