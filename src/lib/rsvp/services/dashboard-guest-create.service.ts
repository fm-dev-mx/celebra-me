import { createGuestInvitation, findGuestByPhone } from '@/lib/rsvp/repository';
import type { DashboardGuestMutationResponse } from '@/lib/rsvp/types';
import { ApiError } from '@/lib/rsvp/errors';
import { publishGuestStreamEvent } from '@/lib/rsvp/stream';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/supabase-errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import { getEventAccessOrThrow } from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import { getSharingTemplateForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import { normalizePhone, sanitize } from '@/lib/rsvp/utils';
import { generateShortId } from '@/utils/ids';

export async function createDashboardGuest(input: {
	eventId: string;
	fullName: string;
	phone?: string;
	maxAllowedAttendees: number;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
	tags?: string[];
}): Promise<DashboardGuestMutationResponse> {
	const event = await getEventAccessOrThrow(input.eventId, input.hostAccessToken);

	const fullName = sanitize(input.fullName, 140);
	if (!fullName) throw new ApiError(400, 'bad_request', 'Nombre completo es obligatorio.');

	const phone = input.phone ? normalizePhone(input.phone) : undefined;
	if (phone) {
		const existing = await findGuestByPhone(event.id, phone, input.hostAccessToken);
		if (existing) {
			throw new ApiError(409, 'conflict', 'Este telefono ya esta registrado en este evento.');
		}
	}

	const maxAllowedAttendees = Math.max(
		1,
		Math.min(20, Math.trunc(input.maxAllowedAttendees || 1)),
	);

	let created;
	try {
		created = await createGuestInvitation(
			{
				eventId: event.id,
				fullName,
				phone: phone || undefined,
				maxAllowedAttendees,
				tags: input.tags,
				short_id: generateShortId(8),
			},
			input.hostAccessToken,
		);
	} catch (error) {
		throw mapSupabaseErrorToApiError(error);
	}

	const template = await getSharingTemplateForSlug(event.slug, event.eventType);
	const item = toGuestDto(
		created,
		input.origin,
		event.title,
		event.eventType,
		event.slug,
		template,
	);

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'create_guest',
			targetTable: 'guest_invitations',
			targetId: created.id,
			oldData: null,
			newData: created as unknown as Record<string, unknown>,
		});
	}

	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: event.id,
		guestId: created.id,
		updatedAt: item.updatedAt,
	});
	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}
