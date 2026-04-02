import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';
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

function buildGuestInsertBody(input: CreateGuestInput, includeShortId: boolean) {
	const body: Record<string, unknown> = {
		event_id: input.eventId,
		full_name: input.fullName,
		phone: input.phone,
		max_allowed_attendees: input.maxAllowedAttendees,
		tags: input.tags,
		entry_source: input.entrySource ?? 'dashboard',
	};
	if (includeShortId && input.shortId) {
		body.short_id = input.shortId;
	}
	return body;
}

function getGuestMutationOptions(hostAccessToken?: string) {
	return hostAccessToken ? { authToken: hostAccessToken } : { useServiceRole: true as const };
}

async function insertGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	try {
		return await insertSingle(
			TABLE,
			GUEST_COLUMNS,
			buildGuestInsertBody(input, true),
			toGuestRecord,
			getGuestMutationOptions(hostAccessToken),
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
				buildGuestInsertBody(input, false),
				toGuestRecord,
				getGuestMutationOptions(hostAccessToken),
			);
		}
		throw error;
	}
}

function updateGuestRecord(
	filter: string,
	body: Record<string, unknown>,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	return updateSingle(
		TABLE,
		GUEST_COLUMNS,
		filter,
		body,
		toGuestRecord,
		getGuestMutationOptions(hostAccessToken),
	);
}

function buildGuestUpdateBody(input: {
	guestId?: string;
	fullName?: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: UpdateGuestInput['attendanceStatus'];
	attendeeCount?: number;
	guestMessage?: string;
	deliveryStatus?: UpdateGuestInput['deliveryStatus'];
	lastResponseSource?: UpdateGuestInput['lastResponseSource'];
	respondedAt?: string | null;
	tags?: string[];
}) {
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
	return updateBody;
}

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
	return insertGuestInvitation(input);
}

export async function createGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	return insertGuestInvitation(input, hostAccessToken);
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
	return updateGuestRecord(
		`id=eq.${encodeURIComponent(input.guestId)}`,
		buildGuestUpdateBody(input),
		hostAccessToken,
	);
}

export async function updateGuestByIdService(
	input: UpdateGuestInput,
): Promise<GuestInvitationRecord> {
	return updateGuestRecord(
		`id=eq.${encodeURIComponent(input.guestId)}`,
		buildGuestUpdateBody(input),
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
	return updateGuestRecord(`invite_id=eq.${encodeURIComponent(inviteId)}`, body);
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
