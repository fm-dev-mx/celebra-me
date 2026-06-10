import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { buildWhatsAppNumber } from '@/lib/phone/validation';
import { getRoutableEventEntry } from '@/lib/content/events';
import { resolveSiteOrigin } from '@/lib/shared/origin';
import { generateInvitationLink } from '@utils/invitation-link';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	type ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';

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
	template?: string;
	shareMessages?: ShareMessagesConfig | null;
	messageType?: ShareMessageType;
	includeLink?: boolean;
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

	if (input.template) return input.template;

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

	return renderShareMessage(template, {
		guestName: input.fullName,
		eventTitle: input.eventTitle,
		inviteUrl,
	});
}

export function buildWhatsAppShareUrl(input: BuildShareMessageInput): string {
	const targetPhone = buildWhatsAppNumber(input.phone, input.countryCode);
	if (!targetPhone) return '';

	const message = buildShareMessage({ ...input, includeLink: true });
	return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

export interface SharingConfig {
	whatsappTemplate?: string;
	shareMessages?: ShareMessagesConfig;
}

function extractSharingFromContent(content: Record<string, unknown>): SharingConfig | null {
	const sharing = content.sharing as Record<string, unknown> | undefined;
	if (!sharing) return null;

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
			return {
				shareMessages: {
					invitation,
					reminder: reminder || DEFAULT_REMINDER_MESSAGE,
				},
			};
		}
	}

	if (whatsappTemplate) {
		return {
			shareMessages: {
				invitation: whatsappTemplate,
				reminder: DEFAULT_REMINDER_MESSAGE,
			},
		};
	}

	return null;
}

export async function getSharingConfigForSlug(
	eventSlug: string,
	eventType?: EventRecord['eventType'],
): Promise<SharingConfig> {
	if (eventSlug && eventType) {
		const published = await findPublishedBySlugAndEventType(eventSlug, eventType);
		if (published?.content) {
			const result = extractSharingFromContent(published.content);
			if (result) {
				if (published.isDemo) return result;
				return result;
			}
		}
	}

	const entry = eventType ? await getRoutableEventEntry(eventSlug, eventType) : null;
	const demoSharing = entry?.data?.sharing as Record<string, unknown> | undefined;
	if (demoSharing) {
		const result = extractSharingFromContent({ sharing: demoSharing });
		if (result) return result;
	}

	return {};
}
