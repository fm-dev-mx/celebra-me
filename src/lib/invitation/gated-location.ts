import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { sanitize } from '@/lib/rsvp/core/utils';
import type { InvitationViewModel } from '@/lib/adapters/types';

type LocationSection = NonNullable<InvitationViewModel['sections']['location']>;

export interface GatedLocationRequest {
	inviteId: string;
	eventType: string;
	slug: string;
}

export interface GatedLocationPayload {
	location: LocationSection;
}

export async function resolveGatedLocationPayload(
	input: GatedLocationRequest,
): Promise<GatedLocationPayload> {
	const inviteId = sanitize(input.inviteId, 100);
	const eventType = sanitize(input.eventType, 40);
	const slug = sanitize(input.slug, 140);

	if (!inviteId || !eventType || !slug) {
		throw new ApiError(400, 'bad_request', 'inviteId, eventType, and slug are required.');
	}

	const guestContext = await getInvitationContextByInviteId(inviteId);
	if (guestContext.eventType !== eventType || guestContext.eventSlug !== slug) {
		throw new ApiError(403, 'forbidden', 'Invitation does not match this event route.');
	}

	if (guestContext.guest.attendanceStatus !== 'confirmed') {
		throw new ApiError(403, 'forbidden', 'Location is available after confirmed RSVP.');
	}

	const resolution = await resolveInvitationContent(slug, eventType);
	const location = resolution?.viewModel.sections.location;
	if (!location) {
		throw new ApiError(404, 'not_found', 'Location is not available for this invitation.');
	}

	return { location };
}
