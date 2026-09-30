import { ApiError } from '@/lib/rsvp/core/errors';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { getEventAccessOrThrow } from '@/lib/rsvp/services/shared/dashboard-guest-context';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

/**
 * Owner-only event access: the event must be visible to the host token and the
 * host must hold an `owner` membership. Managers, other hosts and super admins
 * without membership are denied. Used by surfaces that expose guest media.
 */
export async function getEventOwnerAccessOrThrow(
	eventId: string,
	session: { userId: string; accessToken: string },
): Promise<EventRecord> {
	const event = await getEventAccessOrThrow(eventId, session.accessToken);
	const membership = await findMembershipByEventForHost(
		event.id,
		session.userId,
		session.accessToken,
	);
	if (!membership || membership.membershipRole !== 'owner') {
		throw new ApiError(403, 'forbidden', 'No tiene autorización para este evento.');
	}
	return event;
}
