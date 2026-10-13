import { resolvePublicInvitation } from '@/lib/invitation/content-resolver';
import { invitationUnavailableError } from '@/lib/invitation/access/invitation-access.repository';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { sanitize } from '@/lib/rsvp/core/utils';
import type { LocationSection } from '@/lib/adapters/types';
import { UUID_PATTERN } from '@/lib/intake/constants';

export interface GatedLocationRequest {
	inviteId: string;
	eventType?: string;
	slug?: string;
}

export interface GatedLocationPayload {
	location: LocationSection;
}

export async function resolveGatedLocationPayload(
	input: GatedLocationRequest,
): Promise<GatedLocationPayload> {
	const inviteId = sanitize(input.inviteId, 100);

	if (!inviteId) {
		throw new ApiError(400, 'bad_request', 'inviteId is required.');
	}

	if (!UUID_PATTERN.test(inviteId)) {
		throw new ApiError(400, 'bad_request', 'Invalid invite ID format.');
	}

	const guestContext = await getInvitationContextByInviteId(inviteId);
	if (
		(input.eventType && guestContext.eventType !== input.eventType) ||
		(input.slug && guestContext.eventSlug !== input.slug)
	) {
		throw new ApiError(403, 'forbidden', 'Invitation does not match this event route.');
	}

	if (guestContext.guest.attendanceStatus !== 'confirmed') {
		throw new ApiError(403, 'forbidden', 'Location is available after confirmed RSVP.');
	}

	const resolution = await resolvePublicInvitation(
		guestContext.eventSlug,
		guestContext.eventType,
	);
	if (resolution?.source === 'unavailable') throw invitationUnavailableError();
	const location = resolution?.viewModel.sections.location;
	if (!location) {
		throw new ApiError(404, 'not_found', 'Location is not available for this invitation.');
	}

	return { location };
}
