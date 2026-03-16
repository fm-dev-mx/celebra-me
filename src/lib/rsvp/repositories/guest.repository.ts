import type { GuestInvitationRecord } from '@/lib/rsvp/types';
import {
	type CreateGuestInput,
	type GuestFilters,
	GUEST_COLUMNS,
	GUEST_COLUMNS_WITHOUT_SHORT_ID,
	type UpdateGuestInput,
	toGuestRecord,
} from '@/lib/rsvp/repositories/shared/rows';
import {
	findMany,
	findSingle,
	insertSingle,
	updateSingle,
	deleteByQuery,
} from '@/lib/rsvp/repositories/shared/operations';

const TABLE = 'guest_invitations';

export async function findGuestsByEvent(
	filters: GuestFilters,
	hostAccessToken: string,
): Promise<GuestInvitationRecord[]> {
	const queryParts = [`event_id=eq.${encodeURIComponent(filters.eventId)}`];
	if (filters.status && filters.status !== 'all') {
		if (filters.status === 'viewed') {
			queryParts.push('first_viewed_at=not.is.null');
		} else {
			queryParts.push(`attendance_status=eq.${encodeURIComponent(filters.status)}`);
		}
	}
	if (filters.search) {
		queryParts.push(`full_name=ilike.*${encodeURIComponent(filters.search)}*`);
	}
	queryParts.push('order=updated_at.desc');

	return findMany(TABLE, queryParts.join('&'), '*', toGuestRecord, {
		authToken: hostAccessToken,
	});
}

export async function createGuestInvitationPublic(
	input: CreateGuestInput,
): Promise<GuestInvitationRecord> {
	return insertSingle(
		TABLE,
		GUEST_COLUMNS,
		{
			event_id: input.eventId,
			full_name: input.fullName,
			phone: input.phone,
			max_allowed_attendees: input.maxAllowedAttendees,
			tags: input.tags,
			short_id: input.short_id,
		},
		toGuestRecord,
		{ useServiceRole: true },
	);
}

export async function createGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	try {
		return await insertSingle(
			TABLE,
			GUEST_COLUMNS,
			{
				event_id: input.eventId,
				full_name: input.fullName,
				phone: input.phone,
				max_allowed_attendees: input.maxAllowedAttendees,
				tags: input.tags,
				short_id: input.short_id,
			},
			toGuestRecord,
			{ authToken: hostAccessToken },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('PGRST204') || message.includes('short_id')) {
			console.warn(
				'[Repository] PGRST204 detected, falling back to insertion without short_id.',
			);
			return insertSingle(
				TABLE,
				GUEST_COLUMNS_WITHOUT_SHORT_ID,
				{
					event_id: input.eventId,
					full_name: input.fullName,
					phone: input.phone,
					max_allowed_attendees: input.maxAllowedAttendees,
					tags: input.tags,
				},
				toGuestRecord,
				{ authToken: hostAccessToken },
			);
		}
		throw error;
	}
}

export async function findGuestById(
	guestId: string,
	hostAccessToken: string,
): Promise<GuestInvitationRecord | null> {
	return findSingle(TABLE, `id=eq.${encodeURIComponent(guestId)}`, GUEST_COLUMNS, toGuestRecord, {
		authToken: hostAccessToken,
	});
}

export async function findGuestByIdService(guestId: string): Promise<GuestInvitationRecord | null> {
	return findSingle(TABLE, `id=eq.${encodeURIComponent(guestId)}`, '*', toGuestRecord, {
		useServiceRole: true,
	});
}

export async function updateGuestById(
	input: UpdateGuestInput,
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	const updateBody: Record<string, unknown> = {};
	if (input.fullName !== undefined) updateBody.full_name = input.fullName;
	if (input.phone !== undefined) updateBody.phone = input.phone;
	if (input.maxAllowedAttendees !== undefined) {
		updateBody.max_allowed_attendees = input.maxAllowedAttendees;
	}
	if (input.attendanceStatus !== undefined) updateBody.attendance_status = input.attendanceStatus;
	if (input.attendeeCount !== undefined) updateBody.attendee_count = input.attendeeCount;
	if (input.guestMessage !== undefined) updateBody.guest_message = input.guestMessage;
	if (input.deliveryStatus !== undefined) updateBody.delivery_status = input.deliveryStatus;
	if (input.lastResponseSource !== undefined) {
		updateBody.last_response_source = input.lastResponseSource;
	}
	if (input.respondedAt !== undefined) updateBody.responded_at = input.respondedAt;
	if (input.tags !== undefined) updateBody.tags = input.tags;

	return updateSingle(
		TABLE,
		GUEST_COLUMNS,
		`id=eq.${encodeURIComponent(input.guestId)}`,
		updateBody,
		toGuestRecord,
		{ authToken: hostAccessToken },
	);
}

export async function deleteGuestById(guestId: string, hostAccessToken: string): Promise<void> {
	return deleteByQuery(TABLE, `id=eq.${encodeURIComponent(guestId)}`, {
		authToken: hostAccessToken,
	});
}

export async function findGuestByEventAndNamePublic(
	eventId: string,
	fullName: string,
): Promise<GuestInvitationRecord | null> {
	return findSingle(
		TABLE,
		`event_id=eq.${encodeURIComponent(eventId)}&full_name=ilike.${encodeURIComponent(fullName)}`,
		GUEST_COLUMNS,
		toGuestRecord,
		{ useServiceRole: true },
	);
}

export async function findGuestByInviteIdPublic(
	inviteId: string,
): Promise<GuestInvitationRecord | null> {
	return findSingle(
		TABLE,
		`invite_id=eq.${encodeURIComponent(inviteId)}`,
		GUEST_COLUMNS,
		toGuestRecord,
		{ useServiceRole: true },
	);
}

export async function findGuestByShortIdPublic(
	shortId: string,
): Promise<GuestInvitationRecord | null> {
	return findSingle(
		TABLE,
		`short_id=eq.${encodeURIComponent(shortId)}`,
		GUEST_COLUMNS,
		toGuestRecord,
		{ useServiceRole: true },
	);
}

export async function findGuestByPhone(
	eventId: string,
	phone: string,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord | null> {
	return findSingle(
		TABLE,
		`event_id=eq.${encodeURIComponent(eventId)}&phone=eq.${encodeURIComponent(phone)}`,
		GUEST_COLUMNS,
		toGuestRecord,
		{
			authToken: hostAccessToken,
			useServiceRole: !hostAccessToken,
		},
	);
}

export async function updateGuestByInviteIdPublic(
	inviteId: string,
	body: Record<string, unknown>,
): Promise<GuestInvitationRecord> {
	return updateSingle(
		TABLE,
		GUEST_COLUMNS,
		`invite_id=eq.${encodeURIComponent(inviteId)}`,
		body,
		toGuestRecord,
		{ useServiceRole: true },
	);
}

export async function findGuestByLegacyIdentityPublic(input: {
	eventSlug: string;
	guestId: string;
}): Promise<GuestInvitationRecord | null> {
	return findSingle(
		TABLE,
		`legacy_event_slug=eq.${encodeURIComponent(input.eventSlug)}&legacy_guest_id=eq.${encodeURIComponent(input.guestId)}`,
		GUEST_COLUMNS,
		toGuestRecord,
		{ useServiceRole: true },
	);
}
