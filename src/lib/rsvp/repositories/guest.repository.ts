import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';
import {
	type CreateGuestInput,
	type GuestFilters,
	GUEST_COLUMNS,
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
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { normalizeOptionalPhonePair } from '@/lib/rsvp/core/utils';

const TABLE = 'guest_invitations';
const ACTIVE_GUEST_FILTER = 'deleted_at=is.null';

function buildGuestInsertBody(input: CreateGuestInput) {
	const { phone, countryCode } = normalizeOptionalPhonePair({
		phone: input.phone,
		countryCode: input.countryCode,
	});
	const body: Record<string, unknown> = {
		event_id: input.eventId,
		full_name: input.fullName,
		max_allowed_attendees: input.maxAllowedAttendees,
		tags: input.tags,
	};
	if (phone) {
		body.phone = phone;
		body.country_code = countryCode;
	}
	if (input.shortId) {
		body.short_id = input.shortId;
	}
	body.entry_source = input.entrySource ?? 'dashboard';
	return body;
}

function getGuestMutationOptions(hostAccessToken?: string) {
	return hostAccessToken ? { authToken: hostAccessToken } : { useServiceRole: true as const };
}

async function insertGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	return insertSingle(
		TABLE,
		GUEST_COLUMNS,
		buildGuestInsertBody(input),
		toGuestRecord,
		getGuestMutationOptions(hostAccessToken),
	);
}

async function updateGuestRecord(
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

const GUEST_COLUMN_MAP: Record<string, keyof UpdateGuestInput> = {
	full_name: 'fullName',
	max_allowed_attendees: 'maxAllowedAttendees',
	attendance_status: 'attendanceStatus',
	attendee_count: 'attendeeCount',
	guest_comment: 'guestComment',
	delivery_status: 'deliveryStatus',
	view_percentage: 'viewPercentage',
	is_viewed: 'isViewed',
	last_response_source: 'lastResponseSource',
	responded_at: 'respondedAt',
	tags: 'tags',
};

function buildGuestUpdateBody(input: UpdateGuestInput) {
	const updateBody: Record<string, unknown> = {};
	for (const [column, key] of Object.entries(GUEST_COLUMN_MAP)) {
		if (input[key as keyof UpdateGuestInput] !== undefined) {
			updateBody[column] = input[key as keyof UpdateGuestInput];
		}
	}
	if (input.phone !== undefined) {
		const { phone, countryCode } = normalizeOptionalPhonePair({
			phone: input.phone,
			countryCode: input.countryCode,
		});
		if (phone) {
			updateBody.phone = phone;
			updateBody.country_code = countryCode;
		} else {
			updateBody.phone = null;
			updateBody.country_code = null;
		}
	}
	return updateBody;
}

export async function findGuestsByEvent(
	filters: GuestFilters,
	hostAccessToken: string,
): Promise<GuestInvitationRecord[]> {
	const queryParts = [`event_id=eq.${encodeURIComponent(filters.eventId)}`, ACTIVE_GUEST_FILTER];
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
	if (filters.delivery && filters.delivery !== 'all') {
		queryParts.push(`delivery_status=eq.${encodeURIComponent(filters.delivery)}`);
	}
	queryParts.push('order=updated_at.desc');

	return findMany(TABLE, queryParts.join('&'), '*', toGuestRecord, {
		authToken: hostAccessToken,
	});
}

export async function createGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	return insertGuestInvitation(input, hostAccessToken);
}

export async function findGuestById(
	guestId: string,
	hostAccessToken: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(`id=eq.${encodeURIComponent(guestId)}&${ACTIVE_GUEST_FILTER}`, {
		authToken: hostAccessToken,
	});
}

export async function findGuestByIdService(guestId: string): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(`id=eq.${encodeURIComponent(guestId)}&${ACTIVE_GUEST_FILTER}`, {
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

export async function softDeleteGuestById(guestId: string, hostAccessToken: string): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: `${TABLE}?id=eq.${encodeURIComponent(guestId)}&${ACTIVE_GUEST_FILTER}`,
		method: 'PATCH',
		body: {
			deleted_at: new Date().toISOString(),
		},
		authToken: hostAccessToken,
		prefer: 'return=minimal',
	});
}

function findGuestSingleSafe(
	filter: string,
	options: { authToken?: string; useServiceRole?: boolean },
): Promise<GuestInvitationRecord | null> {
	return findSingle(TABLE, filter, GUEST_COLUMNS, toGuestRecord, options);
}

export async function findGuestByInviteIdPublic(
	inviteId: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(
		`invite_id=eq.${encodeURIComponent(inviteId)}&${ACTIVE_GUEST_FILTER}`,
		{
			useServiceRole: true,
		},
	);
}

export async function findGuestByShortIdPublic(
	shortId: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(
		`short_id=eq.${encodeURIComponent(shortId)}&${ACTIVE_GUEST_FILTER}`,
		{
			useServiceRole: true,
		},
	);
}

export async function findGuestByPhonePublic(
	eventId: string,
	phone: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(
		`event_id=eq.${encodeURIComponent(eventId)}&phone=eq.${encodeURIComponent(phone)}&${ACTIVE_GUEST_FILTER}`,
		{ useServiceRole: true },
	);
}

export async function findGuestByPhoneAuth(
	eventId: string,
	phone: string,
	hostAccessToken: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(
		`event_id=eq.${encodeURIComponent(eventId)}&phone=eq.${encodeURIComponent(phone)}&${ACTIVE_GUEST_FILTER}`,
		{ authToken: hostAccessToken },
	);
}

/** @deprecated Use findGuestByPhonePublic or findGuestByPhoneAuth */
export async function findGuestByPhone(
	eventId: string,
	phone: string,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord | null> {
	return hostAccessToken
		? findGuestByPhoneAuth(eventId, phone, hostAccessToken)
		: findGuestByPhonePublic(eventId, phone);
}

export async function updateGuestByInviteIdPublic(
	inviteId: string,
	body: Record<string, unknown>,
): Promise<GuestInvitationRecord> {
	return updateGuestRecord(`invite_id=eq.${encodeURIComponent(inviteId)}`, body);
}
