import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { normalizePhone, sanitize } from '@/lib/rsvp/core/utils';
import { getRoutableEventEntry } from '@/lib/content/events';
import { getEnv } from '@/lib/server/env';
import { generateInvitationLink } from '@utils/invitation-link';

export interface BuildShareMessageInput {
	origin: string;
	inviteId: string;
	phone: string;
	fullName: string;
	shortId?: string;
	eventTitle?: string;
	eventType?: string;
	eventSlug?: string;
	template?: string;
	includeLink?: boolean;
}

export function isUuid(value: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(value);
}

export function resolveOrigin(providedOrigin?: string): string {
	const baseUrl = getEnv('BASE_URL');
	const isProd = process.env.NODE_ENV === 'production';

	if (baseUrl && baseUrl.startsWith('http')) {
		if (isProd || !baseUrl.includes('localhost')) {
			return baseUrl.replace(/\/+$/, '');
		}
	}

	if (
		providedOrigin &&
		providedOrigin.startsWith('http') &&
		!providedOrigin.includes('localhost')
	) {
		return providedOrigin.replace(/\/+$/, '');
	}

	return (baseUrl || providedOrigin || 'http://localhost:4321').replace(/\/+$/, '');
}

export function buildInviteUrl(
	origin: string,
	id: string,
	isShortId?: boolean,
	eventType?: string,
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

export function buildShareMessage(input: BuildShareMessageInput): string {
	const resolvedOrigin = resolveOrigin(input.origin);
	const inviteUrl = buildInviteUrl(
		resolvedOrigin,
		input.shortId || input.inviteId,
		!!input.shortId,
		input.eventType,
		input.eventSlug,
	);
	const eventLabel = sanitize(input.eventTitle, 120) || 'nuestro evento';

	let template =
		input.template || 'Hola {name}, te compartimos tu invitacion: {inviteUrl} ({eventTitle}).';

	if (input.includeLink) {
		if (!template.includes('{inviteUrl}') && !template.includes(resolvedOrigin)) {
			template = template.trim() + '\n\n{inviteUrl}';
		}
	} else {
		template = template.replace('{inviteUrl}', '').replace(/\s+$/, '');
	}

	return template
		.replace('{name}', sanitize(input.fullName, 120))
		.replace('{fullName}', sanitize(input.fullName, 120))
		.replace('{eventTitle}', eventLabel)
		.replace('{inviteUrl}', inviteUrl);
}

export function buildWhatsAppShareUrl(input: BuildShareMessageInput): string {
	const targetPhone = normalizePhone(input.phone).replace(/^\+/, '');
	if (!targetPhone) return '';

	const message = buildShareMessage({ ...input, includeLink: true });
	return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

export async function getSharingTemplateForSlug(
	eventSlug: string,
	eventType?: EventRecord['eventType'],
): Promise<string | undefined> {
	const entry = await getRoutableEventEntry(eventSlug, eventType);
	return entry?.data?.sharing?.whatsappTemplate;
}
