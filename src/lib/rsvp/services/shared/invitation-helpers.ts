import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { buildWhatsAppNumber } from '@/lib/phone/validation';
import { getRoutableEventEntry } from '@/lib/content/events';
import { resolveSiteOrigin } from '@/lib/shared/origin';
import { generateInvitationLink } from '@utils/invitation-link';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_SHARE_MESSAGE_WITH_PHONE,
	DEFAULT_SHARE_MESSAGE_WITHOUT_PHONE,
	type ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';

export type ShareMessageVariant = 'with-phone' | 'without-phone';

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
	variant?: ShareMessageVariant;
	includeLink?: boolean;
}

export function isUuid(value: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(value);
}

export function resolveOrigin(providedOrigin?: string): string {
	const configured = resolveSiteOrigin();

	if (
		providedOrigin &&
		providedOrigin.startsWith('http') &&
		!providedOrigin.includes('localhost')
	) {
		return providedOrigin.replace(/\/+$/, '');
	}

	return configured;
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
	const variant = input.variant ?? 'with-phone';

	if (input.shareMessages) {
		return variant === 'without-phone'
			? input.shareMessages.whatsappWithoutPhone
			: input.shareMessages.whatsappWithPhone;
	}

	if (input.template) return input.template;

	return variant === 'without-phone'
		? DEFAULT_SHARE_MESSAGE_WITHOUT_PHONE
		: DEFAULT_SHARE_MESSAGE_WITH_PHONE;
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

	const shareMessages = sharing.shareMessages as ShareMessagesConfig | undefined;
	const whatsappTemplate =
		typeof sharing.whatsappTemplate === 'string' ? sharing.whatsappTemplate : undefined;

	if (shareMessages?.whatsappWithPhone && shareMessages?.whatsappWithoutPhone) {
		return { whatsappTemplate, shareMessages };
	}
	if (whatsappTemplate) {
		return { whatsappTemplate };
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
			if (result) return result;
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
