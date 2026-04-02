import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';
import {
	type CreateGuestInput,
	type GuestFilters,
	GUEST_COLUMNS,
	GUEST_COLUMNS_WITHOUT_SHORT_ID,
	GUEST_COLUMNS_WITHOUT_ENTRY_SOURCE,
	GUEST_COLUMNS_MINIMAL,
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

const TABLE = 'guest_invitations';

function isGuestSchemaErrorMessage(message: string) {
	return (
		message.includes('PGRST204') ||
		message.includes('42703') ||
		message.includes('entry_source')
	);
}

async function supportsGenericRsvpSources(hostAccessToken?: string): Promise<boolean> {
	try {
		await supabaseRestRequest<Array<{ entry_source?: string }>>({
			pathWithQuery: `${TABLE}?select=entry_source&limit=1`,
			...getGuestMutationOptions(hostAccessToken),
		});
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (isGuestSchemaErrorMessage(message)) {
			return false;
		}
		throw error;
	}
}

function adaptGuestInsertInputForSchema(
	input: CreateGuestInput,
	options: { supportsGenericSources: boolean },
): CreateGuestInput {
	if (options.supportsGenericSources) return input;
	return {
		...input,
		entrySource: 'dashboard',
	};
}

function adaptGuestUpdateBodyForSchema(
	body: Record<string, unknown>,
	options: { supportsGenericSources: boolean },
): Record<string, unknown> {
	if (options.supportsGenericSources) return body;

	const nextBody = { ...body };
	if (nextBody.last_response_source === 'generic_link') {
		nextBody.last_response_source = 'link';
	}
	delete nextBody.entry_source;
	return nextBody;
}

function buildGuestInsertBody(
	input: CreateGuestInput,
	includeShortId: boolean,
	includeEntrySource: boolean,
) {
	const body: Record<string, unknown> = {
		event_id: input.eventId,
		full_name: input.fullName,
		phone: input.phone,
		max_allowed_attendees: input.maxAllowedAttendees,
		tags: input.tags,
	};
	if (includeShortId && input.shortId) {
		body.short_id = input.shortId;
	}
	if (includeEntrySource) {
		body.entry_source = input.entrySource ?? 'dashboard';
	}
	return body;
}

function getGuestMutationOptions(hostAccessToken?: string) {
	return hostAccessToken ? { authToken: hostAccessToken } : { useServiceRole: true as const };
}

function getGuestReturnColumns(isMissingShortId: boolean, isMissingEntrySource: boolean) {
	if (isMissingShortId && isMissingEntrySource) return GUEST_COLUMNS_MINIMAL;
	if (isMissingShortId) return GUEST_COLUMNS_WITHOUT_SHORT_ID;
	if (isMissingEntrySource) return GUEST_COLUMNS_WITHOUT_ENTRY_SOURCE;
	return GUEST_COLUMNS;
}

async function insertGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	const supportsGenericSources = await supportsGenericRsvpSources(hostAccessToken);
	const normalizedInput = adaptGuestInsertInputForSchema(input, { supportsGenericSources });
	const initialColumns = supportsGenericSources
		? GUEST_COLUMNS
		: GUEST_COLUMNS_WITHOUT_ENTRY_SOURCE;

	try {
		return await insertSingle(
			TABLE,
			initialColumns,
			buildGuestInsertBody(normalizedInput, true, supportsGenericSources),
			toGuestRecord,
			getGuestMutationOptions(hostAccessToken),
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		const isSchemaError = message.includes('PGRST204') || message.includes('42703');
		const isMissingShortId = message.includes('short_id');
		const isMissingEntrySource = message.includes('entry_source');

		// Handle missing schema columns
		if (isSchemaError || isMissingShortId || isMissingEntrySource) {
			console.warn(`[Repository] Retrying INSERT with safe columns: ${message}`);
			return insertSingle(
				TABLE,
				getGuestReturnColumns(isMissingShortId, isMissingEntrySource),
				buildGuestInsertBody(normalizedInput, !isMissingShortId, !isMissingEntrySource),
				toGuestRecord,
				getGuestMutationOptions(hostAccessToken),
			);
		}

		if (message.includes('23514') && input.entrySource === 'generic_public') {
			console.warn(
				'[Repository] Retrying INSERT with legacy entry_source fallback (dashboard).',
			);
			return insertGuestInvitation({ ...input, entrySource: 'dashboard' }, hostAccessToken);
		}

		throw error;
	}
}

async function updateGuestRecord(
	filter: string,
	body: Record<string, unknown>,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord> {
	const supportsGenericSources = await supportsGenericRsvpSources(hostAccessToken);
	const normalizedBody = adaptGuestUpdateBodyForSchema(body, { supportsGenericSources });
	const initialColumns = supportsGenericSources
		? GUEST_COLUMNS
		: GUEST_COLUMNS_WITHOUT_ENTRY_SOURCE;

	try {
		return await updateSingle(
			TABLE,
			initialColumns,
			filter,
			normalizedBody,
			toGuestRecord,
			getGuestMutationOptions(hostAccessToken),
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		const isSchemaError = message.includes('PGRST204') || message.includes('42703');
		const isMissingShortId = message.includes('short_id');
		const isMissingEntrySource = message.includes('entry_source');

		if (isSchemaError || isMissingShortId || isMissingEntrySource) {
			console.warn(`[Repository] Retrying UPDATE with safe columns: ${message}`);
			return updateSingle(
				TABLE,
				getGuestReturnColumns(isMissingShortId, isMissingEntrySource),
				filter,
				normalizedBody,
				toGuestRecord,
				getGuestMutationOptions(hostAccessToken),
			);
		}

		if (message.includes('23514')) {
			if (body.last_response_source === 'generic_link') {
				console.warn(
					'[Repository] Retrying UPDATE with legacy response source fallback (link).',
				);
				return updateGuestRecord(
					filter,
					{ ...body, last_response_source: 'link' },
					hostAccessToken,
				);
			}
			if (body.entry_source === 'generic_public') {
				console.warn(
					'[Repository] Retrying UPDATE with legacy entry source fallback (dashboard).',
				);
				return updateGuestRecord(
					filter,
					{ ...body, entry_source: 'dashboard' },
					hostAccessToken,
				);
			}
		}

		throw error;
	}
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

async function findGuestSingleSafe(
	filter: string,
	options: { authToken?: string; useServiceRole?: boolean },
): Promise<GuestInvitationRecord | null> {
	try {
		return await findSingle(TABLE, filter, GUEST_COLUMNS, toGuestRecord, options);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		const isSchemaError = message.includes('PGRST204') || message.includes('42703');
		const isMissingShortId = message.includes('short_id');
		const isMissingEntrySource = message.includes('entry_source');

		if (isSchemaError || isMissingShortId || isMissingEntrySource) {
			console.warn(`[Repository] Retrying SELECT with safe columns: ${message}`);
			return findSingle(
				TABLE,
				filter,
				getGuestReturnColumns(isMissingShortId, isMissingEntrySource),
				toGuestRecord,
				options,
			);
		}
		throw error;
	}
}

export async function findGuestByInviteIdPublic(
	inviteId: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(`invite_id=eq.${encodeURIComponent(inviteId)}`, {
		useServiceRole: true,
	});
}

export async function findGuestByShortIdPublic(
	shortId: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(`short_id=eq.${encodeURIComponent(shortId)}`, {
		useServiceRole: true,
	});
}

export async function findGuestByPhone(
	eventId: string,
	phone: string,
	hostAccessToken?: string,
): Promise<GuestInvitationRecord | null> {
	return findGuestSingleSafe(
		`event_id=eq.${encodeURIComponent(eventId)}&phone=eq.${encodeURIComponent(phone)}`,
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
