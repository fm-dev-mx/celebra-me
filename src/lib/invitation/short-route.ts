import { isReservedInvitationSlug } from '@/lib/invitation/slug-policy';
import { isEventType, type EventType } from '@/lib/theme/theme-contract';
import { safeErr } from '@/lib/server/safe-error';

type EventTypeLookup = (slug: string) => Promise<string | null>;

/**
 * Event type behind a `/{slug}` request, or null when the slug is reserved, unknown,
 * ambiguous or stored with an unsupported event type (the route answers 404).
 */
export async function resolveShortRouteEventType(
	slug: string,
	lookup: EventTypeLookup,
): Promise<EventType | null> {
	if (isReservedInvitationSlug(slug)) return null;
	try {
		const eventType = await lookup(slug);
		return eventType && isEventType(eventType) ? eventType : null;
	} catch (error) {
		console.error(`[ShortRoute] Slug lookup failed for "${slug}":`, safeErr(error));
		return null;
	}
}
