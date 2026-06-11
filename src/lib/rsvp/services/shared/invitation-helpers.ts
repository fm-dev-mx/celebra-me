import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { buildWhatsAppNumber } from '@/lib/phone/validation';
import { getRoutableEventEntry } from '@/lib/content/events';
import { resolveSiteOrigin } from '@/lib/shared/origin';
import { generateInvitationLink } from '@utils/invitation-link';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	resolveReminderSettings,
	type ShareMessagesConfig,
	type ReminderSettings,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { buildShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

export type ShareMessageType = 'invitation' | 'reminder';

export interface BuildShareMessageInput {
	origin: string;
	inviteId: string;
	phone: string;
	countryCode?: string;
	fullName: string;
	shortId?: string;
	eventTitle?: string;
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	shareMessages?: ShareMessagesConfig | null;
	messageType?: ShareMessageType;
	includeLink?: boolean;
	eventDate?: string | null;
	rsvpDeadline?: string | null;
}

export function resolveOrigin(providedOrigin?: string): string {
	if (providedOrigin) {
		try {
			new URL(providedOrigin);
			return providedOrigin.replace(/\/+$/, '');
		} catch {
			// fall through to configured origin
		}
	}

	return resolveSiteOrigin();
}

export function buildInviteUrl(
	origin: string,
	id: string,
	isShortId?: boolean,
	eventType?: EventRecord['eventType'],
	eventSlug?: string,
): string {
	const resolvedOrigin = resolveOrigin(origin);
	if (!eventType || !eventSlug) {
		return `${resolvedOrigin}/invitacion/${encodeURIComponent(id)}`;
	}

	return generateInvitationLink({
		origin: resolvedOrigin,
		eventType,
		eventSlug,
		inviteId: isShortId ? '' : id,
		shortId: isShortId ? id : undefined,
	});
}

function resolveTemplate(input: BuildShareMessageInput): string {
	const messageType = input.messageType ?? 'invitation';

	if (input.shareMessages) {
		return messageType === 'reminder'
			? input.shareMessages.reminder || DEFAULT_REMINDER_MESSAGE
			: input.shareMessages.invitation || DEFAULT_INVITATION_MESSAGE;
	}

	return messageType === 'reminder' ? DEFAULT_REMINDER_MESSAGE : DEFAULT_INVITATION_MESSAGE;
}

export function buildShareMessage(input: BuildShareMessageInput): string {
	const resolvedOrigin = resolveOrigin(input.origin);
	const inviteUrl = buildInviteUrl(
		resolvedOrigin,
		input.shortId || input.inviteId,
		!!input.shortId,
		input.eventType,
		input.eventSlug,
	);

	let template = resolveTemplate(input);

	if (input.includeLink) {
		if (!template.includes('{inviteUrl}') && !template.includes(resolvedOrigin)) {
			template = template.trim() + '\n\n{inviteUrl}';
		}
	} else {
		template = template.replaceAll('{inviteUrl}', '').replace(/\s+$/, '');
	}

	const today = new Date();
	const dateContext = buildShareMessageDateContext(
		input.eventDate ?? null,
		input.rsvpDeadline ?? null,
		input.eventTitle || '',
		today,
	);

	return renderShareMessage(template, {
		guestName: input.fullName,
		eventTitle: input.eventTitle,
		inviteUrl,
		...dateContext,
	});
}

export function buildWhatsAppShareUrl(input: BuildShareMessageInput): string {
	const targetPhone = buildWhatsAppNumber(input.phone, input.countryCode);
	if (!targetPhone) return '';

	const message = buildShareMessage({ ...input, includeLink: true });
	return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

export interface SharingConfig {
	shareMessages?: ShareMessagesConfig;
	reminderSettings?: ReminderSettings | null;
	eventDate?: string | null;
	rsvpDeadline?: string | null;
	ogDescription?: string;
}

function extractEventDate(data: Record<string, unknown> | undefined): string | null {
	if (!data) return null;
	const hero = data.hero as Record<string, unknown> | undefined;
	if (!hero || typeof hero.date !== 'string' || !hero.date) return null;
	return hero.date;
}

function extractRsvpDeadline(data: Record<string, unknown> | undefined): string | null {
	if (!data) return null;
	const rsvp = data.rsvp as Record<string, unknown> | undefined;
	if (!rsvp || typeof rsvp.confirmationDeadline !== 'string' || !rsvp.confirmationDeadline)
		return null;
	return rsvp.confirmationDeadline;
}

function extractReminderSettingsFromSharing(
	sharing: Record<string, unknown>,
): ReminderSettings | null {
	const raw = sharing.reminderSettings;
	if (!raw || typeof raw !== 'object') return null;
	return resolveReminderSettings(raw as ReminderSettings);
}

function extractSharingFromContent(content: Record<string, unknown>): SharingConfig | null {
	const sharing = content.sharing as Record<string, unknown> | undefined;
	if (!sharing) return null;

	const result: SharingConfig = {};

	const ogDescription =
		typeof sharing.ogDescription === 'string' ? sharing.ogDescription : undefined;
	if (ogDescription) result.ogDescription = ogDescription;

	const reminderSettings = extractReminderSettingsFromSharing(sharing);
	if (reminderSettings) result.reminderSettings = reminderSettings;

	const shareMessages = sharing.shareMessages as Record<string, unknown> | undefined;
	const whatsappTemplate =
		typeof sharing.whatsappTemplate === 'string' ? sharing.whatsappTemplate : undefined;

	if (shareMessages && Object.keys(shareMessages).length > 0) {
		const invitation =
			typeof shareMessages.invitation === 'string'
				? shareMessages.invitation
				: typeof shareMessages.whatsappWithPhone === 'string'
					? shareMessages.whatsappWithPhone
					: typeof shareMessages.whatsappWithoutPhone === 'string'
						? shareMessages.whatsappWithoutPhone
						: '';
		const reminder = typeof shareMessages.reminder === 'string' ? shareMessages.reminder : '';
		if (invitation) {
			result.shareMessages = {
				invitation,
				reminder: reminder || DEFAULT_REMINDER_MESSAGE,
			};
			return result;
		}
	}

	if (whatsappTemplate) {
		result.shareMessages = {
			invitation: whatsappTemplate,
			reminder: DEFAULT_REMINDER_MESSAGE,
		};
		return result;
	}

	return Object.keys(result).length > 0 ? result : null;
}

export async function getSharingConfigForSlug(
	eventSlug: string,
	eventType?: EventRecord['eventType'],
): Promise<SharingConfig> {
	const result: SharingConfig = {};

	if (eventSlug && eventType) {
		const published = await findPublishedBySlugAndEventType(eventSlug, eventType);
		if (published?.content) {
			const sharingResult = extractSharingFromContent(published.content);
			if (sharingResult) Object.assign(result, sharingResult);

			result.eventDate = extractEventDate(published.content);
			result.rsvpDeadline = extractRsvpDeadline(published.content);
			return result;
		}
	}

	const entry = eventType ? await getRoutableEventEntry(eventSlug, eventType) : null;
	const demoSharing = entry?.data?.sharing as Record<string, unknown> | undefined;
	if (demoSharing) {
		const sharingResult = extractSharingFromContent({ sharing: demoSharing });
		if (sharingResult) Object.assign(result, sharingResult);

		result.eventDate = extractEventDate(entry?.data);
		result.rsvpDeadline = extractRsvpDeadline(entry?.data);
		return result;
	}

	return result;
}
