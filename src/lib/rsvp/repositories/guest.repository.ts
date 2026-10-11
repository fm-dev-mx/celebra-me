import type {
	AttendanceStatus,
	GuestInvitationRecord,
	ResponseSource,
} from '@/interfaces/rsvp/domain.interface';
import {
	type CreateGuestInput,
	type GuestFilters,
	type UpdateGuestInput,
	toGuestRecord,
} from '@/lib/rsvp/repositories/shared/rows';
import {
	findMany,
	findSingle,
	insertSingle,
	updateSingle,
} from '@/lib/rsvp/repositories/shared/operations';
import { normalizeOptionalPhonePair } from '@/lib/rsvp/core/utils';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	stripEngagementWriteFields,
	withGuestColumns,
} from '@/lib/rsvp/repositories/shared/guest-schema-compat';

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
	if (input.isTest) {
		body.is_test = true;
	}
	return body;
}

async function updateGuestRecord(
	filter: string,
	body: Record<string, unknown>,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	return withGuestColumns((set) =>
		updateSingle(
			TABLE,
			set.columns,
			filter,
			stripEngagementWriteFields(body, set),
			toGuestRecord,
			hostAccessToken ? { authToken: hostAccessToken } : { useServiceRole: true },
		),
	);
}

const GUEST_COLUMN_MAP: Record<string, keyof UpdateGuestInput> = {
	full_name: 'fullName',
	max_allowed_attendees: 'maxAllowedAttendees',
	attendance_status: 'attendanceStatus',
	attendee_count: 'attendeeCount',
	guest_comment: 'guestComment',
	delivery_status: 'deliveryStatus',
	first_shared_at: 'firstSharedAt',
	view_percentage: 'viewPercentage',
	is_viewed: 'isViewed',
	last_response_source: 'lastResponseSource',
	responded_at: 'respondedAt',
	tags: 'tags',
	hide_celebra_me_branding: 'hideCelebraMeBranding',
	last_reminder_sent_at: 'lastReminderSentAt',
	is_test: 'isTest',
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
		const raw = filters.search.trim();
		if (raw) {
			const digitsOnly = raw.replace(/\D/g, '');
			const orConditions = [`full_name.ilike.*${encodeURIComponent(raw)}*`];
			if (digitsOnly) {
				const phoneTerm = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
				orConditions.push(`phone.ilike.*${encodeURIComponent(phoneTerm)}*`);
			}
			queryParts.push(
				orConditions.length > 1
					? `or=(${orConditions.join(',')})`
					: orConditions[0].replace('.ilike.', '=ilike.'),
			);
		}
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
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	const body = buildGuestInsertBody(input);
	return withGuestColumns((set) =>
		insertSingle(TABLE, set.columns, stripEngagementWriteFields(body, set), toGuestRecord, {
			authToken: hostAccessToken,
		}),
	);
}

export async function findGuestById(
	guestId: string,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord | null> {
	return withGuestColumns((set) =>
		findSingle(
			TABLE,
			`id=eq.${encodeURIComponent(guestId)}&${ACTIVE_GUEST_FILTER}`,
			set.columns,
			toGuestRecord,
			hostAccessToken ? { authToken: hostAccessToken } : { useServiceRole: true },
		),
	);
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

/**
 * Soft-deletes an active guest. Client sessions cannot do this through RLS
 * (the SELECT policy hides deleted rows), so the privileged RPC re-checks that
 * the actor owns, manages or administers the guest's event. Returns false when
 * the guest is missing or already deleted.
 */
export async function softDeleteGuestById(guestId: string, actorUserId: string): Promise<boolean> {
	const deleted = await supabaseRestRequest<boolean>({
		pathWithQuery: 'rpc/soft_delete_guest_invitation_v1',
		method: 'POST',
		useServiceRole: true,
		body: { p_guest_id: guestId, p_actor_user_id: actorUserId },
	});
	return deleted === true;
}

export async function findGuestByInviteIdPublic(
	inviteId: string,
): Promise<GuestInvitationRecord | null> {
	return withGuestColumns((set) =>
		findSingle(
			TABLE,
			`invite_id=eq.${encodeURIComponent(inviteId)}&${ACTIVE_GUEST_FILTER}`,
			set.columns,
			toGuestRecord,
			{ useServiceRole: true },
		),
	);
}

export async function findGuestByShortIdPublic(
	shortId: string,
): Promise<GuestInvitationRecord | null> {
	return withGuestColumns((set) =>
		findSingle(
			TABLE,
			`short_id=eq.${encodeURIComponent(shortId)}&${ACTIVE_GUEST_FILTER}`,
			set.columns,
			toGuestRecord,
			{ useServiceRole: true },
		),
	);
}
export async function findGuestByPhoneAuth(
	eventId: string,
	countryCode: string,
	phone: string,
	hostAccessToken: string,
): Promise<GuestInvitationRecord | null> {
	return withGuestColumns((set) =>
		findSingle(
			TABLE,
			`event_id=eq.${encodeURIComponent(eventId)}&country_code=eq.${encodeURIComponent(countryCode)}&phone=eq.${encodeURIComponent(phone)}&${ACTIVE_GUEST_FILTER}`,
			set.columns,
			toGuestRecord,
			{ authToken: hostAccessToken },
		),
	);
}

export async function submitGuestRsvpPublicRpc(input: {
	inviteId?: string | null;
	eventId?: string | null;
	fullName?: string | null;
	phone?: string | null;
	countryCode?: string | null;
	maxAllowedAttendees?: number | null;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestComment?: string | null;
	responseSource?: ResponseSource;
	shortId?: string | null;
}): Promise<GuestInvitationRecord> {
	const rows = await supabaseRestRequest<Array<{ invite_id: string }> | { invite_id: string }>({
		pathWithQuery: 'rpc/submit_guest_rsvp_public',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_invite_id: input.inviteId ?? null,
			p_event_id: input.eventId ?? null,
			p_full_name: input.fullName ?? null,
			p_phone: input.phone ?? null,
			p_country_code: input.countryCode ?? null,
			p_max_allowed_attendees: input.maxAllowedAttendees ?? null,
			p_attendance_status: input.attendanceStatus,
			p_attendee_count: input.attendeeCount,
			p_guest_comment: input.guestComment ?? null,
			p_response_source: input.responseSource ?? 'link',
			p_short_id: input.shortId ?? null,
		},
	});

	const row = Array.isArray(rows) ? rows[0] : rows;
	if (!row?.invite_id) {
		throw new Error('No se pudo guardar la respuesta de la invitación.');
	}

	const guest = await findGuestByInviteIdPublic(row.invite_id);
	if (!guest) {
		throw new Error('No se pudo guardar la respuesta de la invitación.');
	}
	return guest;
}

export async function trackGuestInvitationViewPublicRpc(
	inviteId: string,
	viewPercentage?: number,
): Promise<boolean> {
	return await supabaseRestRequest<boolean>({
		pathWithQuery: 'rpc/track_guest_invitation_view_public',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_invite_id: inviteId,
			p_view_percentage: viewPercentage ?? null,
		},
	});
}

export async function updateGuestByInviteIdPublic(
	inviteId: string,
	body: Record<string, unknown>,
): Promise<GuestInvitationRecord> {
	if (!body.attendance_status) {
		throw new Error('Failed to update guest_invitations');
	}
	return submitGuestRsvpPublicRpc({
		inviteId,
		attendanceStatus: body.attendance_status as AttendanceStatus,
		attendeeCount: (body.attendee_count as number) ?? 1,
		guestComment: (body.guest_comment as string) ?? null,
		responseSource: (body.last_response_source as ResponseSource) ?? 'link',
	});
}
