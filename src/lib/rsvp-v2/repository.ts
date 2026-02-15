import { supabaseRestRequest } from './supabase';
import type {
	AttendanceStatus,
	AppUserRole,
	AppUserRoleRecord,
	ClaimCodeRecord,
	EventRecord,
	EventMembershipRecord,
	GuestInvitationAuditRecord,
	GuestInvitationRecord,
	ResponseSource,
} from './types';

interface GuestFilters {
	eventId: string;
	status?: AttendanceStatus | 'all';
	search?: string;
}

interface CreateGuestInput {
	eventId: string;
	fullName: string;
	phoneE164: string;
	maxAllowedAttendees: number;
}

interface UpdateGuestInput {
	guestId: string;
	fullName?: string;
	phoneE164?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
	deliveryStatus?: 'generated' | 'shared';
	lastResponseSource?: ResponseSource;
	respondedAt?: string | null;
}

type EventRow = {
	id: string;
	owner_user_id: string;
	slug: string;
	event_type: EventRecord['eventType'];
	title: string;
	status: EventRecord['status'];
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

type GuestRow = {
	id: string;
	invite_id: string;
	event_id: string;
	full_name: string;
	phone_e164: string;
	max_allowed_attendees: number;
	attendance_status: AttendanceStatus;
	attendee_count: number;
	guest_message: string;
	delivery_status: 'generated' | 'shared';
	first_viewed_at: string | null;
	last_viewed_at: string | null;
	responded_at: string | null;
	last_response_source: ResponseSource;
	created_at: string;
	updated_at: string;
};

type GuestAuditRow = {
	id: string;
	guest_invitation_id: string;
	actor_type: 'guest' | 'host' | 'system';
	event_type: 'created' | 'viewed' | 'status_changed' | 'message_updated' | 'shared_whatsapp';
	payload: Record<string, unknown>;
	created_at: string;
};

type UserRoleRow = {
	user_id: string;
	role: AppUserRole;
	created_at: string;
	updated_at: string;
};

type EventMembershipRow = {
	id: string;
	event_id: string;
	user_id: string;
	membership_role: 'owner' | 'manager';
	created_at: string;
	updated_at: string;
};

type ClaimCodeRow = {
	id: string;
	event_id: string;
	active: boolean;
	expires_at: string | null;
	max_uses: number;
	used_count: number;
	created_by: string | null;
	created_at: string;
	updated_at: string;
};

function toEventRecord(row: EventRow): EventRecord {
	return {
		id: row.id,
		ownerUserId: row.owner_user_id,
		slug: row.slug,
		eventType: row.event_type,
		title: row.title,
		status: row.status,
		publishedAt: row.published_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toGuestRecord(row: GuestRow): GuestInvitationRecord {
	return {
		id: row.id,
		inviteId: row.invite_id,
		eventId: row.event_id,
		fullName: row.full_name,
		phoneE164: row.phone_e164,
		maxAllowedAttendees: row.max_allowed_attendees,
		attendanceStatus: row.attendance_status,
		attendeeCount: row.attendee_count,
		guestMessage: row.guest_message,
		deliveryStatus: row.delivery_status,
		firstViewedAt: row.first_viewed_at,
		lastViewedAt: row.last_viewed_at,
		respondedAt: row.responded_at,
		lastResponseSource: row.last_response_source,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toGuestAuditRecord(row: GuestAuditRow): GuestInvitationAuditRecord {
	return {
		id: row.id,
		guestInvitationId: row.guest_invitation_id,
		actorType: row.actor_type,
		eventType: row.event_type,
		payload: row.payload ?? {},
		createdAt: row.created_at,
	};
}

function toRoleRecord(row: UserRoleRow): AppUserRoleRecord {
	return {
		userId: row.user_id,
		role: row.role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toMembershipRecord(row: EventMembershipRow): EventMembershipRecord {
	return {
		id: row.id,
		eventId: row.event_id,
		userId: row.user_id,
		membershipRole: row.membership_role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toClaimCodeRecord(row: ClaimCodeRow): ClaimCodeRecord {
	return {
		id: row.id,
		eventId: row.event_id,
		active: row.active,
		expiresAt: row.expires_at,
		maxUses: row.max_uses,
		usedCount: row.used_count,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function findEventsByOwner(
	ownerUserId: string,
	hostAccessToken: string,
): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&owner_user_id=eq.${encodeURIComponent(ownerUserId)}&order=created_at.desc`,
		authToken: hostAccessToken,
	});
	return rows.map(toEventRecord);
}

export async function findEventsForHost(hostAccessToken: string): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: 'events?select=*&order=created_at.desc',
		authToken: hostAccessToken,
	});
	return rows.map(toEventRecord);
}

export async function findEventById(
	eventId: string,
	hostAccessToken: string,
): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&id=eq.${encodeURIComponent(eventId)}&limit=1`,
		authToken: hostAccessToken,
	});
	return rows[0] ? toEventRecord(rows[0]) : null;
}

export async function findEventByIdService(eventId: string): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&id=eq.${encodeURIComponent(eventId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toEventRecord(rows[0]) : null;
}

export async function findEventBySlugService(slug: string): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toEventRecord(rows[0]) : null;
}

export async function findGuestsByEvent(
	filters: GuestFilters,
	hostAccessToken: string,
): Promise<GuestInvitationRecord[]> {
	const queryParts = [`select=*`, `event_id=eq.${encodeURIComponent(filters.eventId)}`];
	if (filters.status && filters.status !== 'all') {
		queryParts.push(`attendance_status=eq.${encodeURIComponent(filters.status)}`);
	}
	if (filters.search) {
		queryParts.push(`full_name=ilike.*${encodeURIComponent(filters.search)}*`);
	}
	queryParts.push('order=updated_at.desc');

	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?${queryParts.join('&')}`,
		authToken: hostAccessToken,
	});
	return rows.map(toGuestRecord);
}

export async function createGuestInvitation(
	input: CreateGuestInput,
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: 'guest_invitations?select=*',
		method: 'POST',
		authToken: hostAccessToken,
		prefer: 'return=representation',
		body: {
			event_id: input.eventId,
			full_name: input.fullName,
			phone_e164: input.phoneE164,
			max_allowed_attendees: input.maxAllowedAttendees,
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear invitado.');
	return toGuestRecord(rows[0]);
}

export async function findGuestById(
	guestId: string,
	hostAccessToken: string,
): Promise<GuestInvitationRecord | null> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?select=*&id=eq.${encodeURIComponent(guestId)}&limit=1`,
		authToken: hostAccessToken,
	});
	return rows[0] ? toGuestRecord(rows[0]) : null;
}

export async function findGuestByIdService(guestId: string): Promise<GuestInvitationRecord | null> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?select=*&id=eq.${encodeURIComponent(guestId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toGuestRecord(rows[0]) : null;
}

export async function updateGuestById(
	input: UpdateGuestInput,
	hostAccessToken: string,
): Promise<GuestInvitationRecord> {
	const body: Record<string, unknown> = {};
	if (input.fullName !== undefined) body.full_name = input.fullName;
	if (input.phoneE164 !== undefined) body.phone_e164 = input.phoneE164;
	if (input.maxAllowedAttendees !== undefined)
		body.max_allowed_attendees = input.maxAllowedAttendees;
	if (input.attendanceStatus !== undefined) body.attendance_status = input.attendanceStatus;
	if (input.attendeeCount !== undefined) body.attendee_count = input.attendeeCount;
	if (input.guestMessage !== undefined) body.guest_message = input.guestMessage;
	if (input.deliveryStatus !== undefined) body.delivery_status = input.deliveryStatus;
	if (input.lastResponseSource !== undefined)
		body.last_response_source = input.lastResponseSource;
	if (input.respondedAt !== undefined) body.responded_at = input.respondedAt;

	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?id=eq.${encodeURIComponent(input.guestId)}&select=*`,
		method: 'PATCH',
		authToken: hostAccessToken,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0]) throw new Error('Invitado no encontrado o sin permisos.');
	return toGuestRecord(rows[0]);
}

export async function deleteGuestById(guestId: string, hostAccessToken: string): Promise<void> {
	await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?id=eq.${encodeURIComponent(guestId)}`,
		method: 'DELETE',
		authToken: hostAccessToken,
		prefer: 'return=minimal',
	});
}

export async function appendGuestAuditByHost(
	guestId: string,
	eventType: GuestAuditRow['event_type'],
	payload: Record<string, unknown>,
	hostAccessToken: string,
): Promise<void> {
	await supabaseRestRequest<GuestAuditRow[]>({
		pathWithQuery: 'guest_invitation_audit',
		method: 'POST',
		authToken: hostAccessToken,
		prefer: 'return=minimal',
		body: {
			guest_invitation_id: guestId,
			actor_type: 'host',
			event_type: eventType,
			payload,
		},
	});
}

export async function findGuestByInviteIdPublic(
	inviteId: string,
): Promise<GuestInvitationRecord | null> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?select=*&invite_id=eq.${encodeURIComponent(inviteId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toGuestRecord(rows[0]) : null;
}

export async function updateGuestByInviteIdPublic(
	inviteId: string,
	body: Record<string, unknown>,
): Promise<GuestInvitationRecord> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?invite_id=eq.${encodeURIComponent(inviteId)}&select=*`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0]) throw new Error('Invitación no encontrada.');
	return toGuestRecord(rows[0]);
}

export async function appendGuestAuditPublic(
	guestInvitationId: string,
	eventType: GuestAuditRow['event_type'],
	payload: Record<string, unknown>,
	actorType: GuestAuditRow['actor_type'] = 'guest',
): Promise<GuestInvitationAuditRecord> {
	const rows = await supabaseRestRequest<GuestAuditRow[]>({
		pathWithQuery: 'guest_invitation_audit?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			guest_invitation_id: guestInvitationId,
			actor_type: actorType,
			event_type: eventType,
			payload,
		},
	});
	if (!rows[0]) throw new Error('No se pudo registrar auditoria.');
	return toGuestAuditRecord(rows[0]);
}

export async function findEventByInvitationPublic(eventId: string): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&id=eq.${encodeURIComponent(eventId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toEventRecord(rows[0]) : null;
}

export async function findGuestByLegacyIdentityPublic(input: {
	eventSlug: string;
	guestId: string;
}): Promise<GuestInvitationRecord | null> {
	const rows = await supabaseRestRequest<GuestRow[]>({
		pathWithQuery: `guest_invitations?select=*&legacy_event_slug=eq.${encodeURIComponent(input.eventSlug)}&legacy_guest_id=eq.${encodeURIComponent(input.guestId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toGuestRecord(rows[0]) : null;
}

export async function upsertUserRoleService(input: {
	userId: string;
	role: AppUserRole;
}): Promise<AppUserRoleRecord> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: 'app_user_roles?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			user_id: input.userId,
			role: input.role,
		},
	});
	if (!rows[0]) throw new Error('No se pudo actualizar rol de usuario.');
	return toRoleRecord(rows[0]);
}

export async function findUserRoleService(userId: string): Promise<AppUserRoleRecord | null> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: `app_user_roles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRoleRecord(rows[0]) : null;
}

export async function findAppUserRoleByUserIdService(
	userId: string,
): Promise<AppUserRoleRecord | null> {
	return findUserRoleService(userId);
}

export async function listUserRolesService(): Promise<AppUserRoleRecord[]> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: 'app_user_roles?select=*&order=created_at.desc',
		useServiceRole: true,
	});
	return rows.map(toRoleRecord);
}

export async function createEventMembershipService(input: {
	eventId: string;
	userId: string;
	membershipRole: 'owner' | 'manager';
}): Promise<EventMembershipRecord> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: 'event_memberships?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			event_id: input.eventId,
			user_id: input.userId,
			membership_role: input.membershipRole,
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear membresia del evento.');
	return toMembershipRecord(rows[0]);
}

export async function findMembershipByEventForHost(
	eventId: string,
	hostAccessToken: string,
): Promise<EventMembershipRecord | null> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: `event_memberships?select=*&event_id=eq.${encodeURIComponent(eventId)}&limit=1`,
		authToken: hostAccessToken,
	});
	return rows[0] ? toMembershipRecord(rows[0]) : null;
}

export async function listMembershipsForHost(
	hostAccessToken: string,
): Promise<EventMembershipRecord[]> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: 'event_memberships?select=*&order=created_at.desc',
		authToken: hostAccessToken,
	});
	return rows.map(toMembershipRecord);
}

export async function listAllEventsService(): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: 'events?select=*&order=created_at.desc',
		useServiceRole: true,
	});
	return rows.map(toEventRecord);
}

export async function findClaimCodeRecordService(input: {
	eventId: string;
	codeHash: string;
}): Promise<{
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
} | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=id,event_id,active,expires_at,max_uses,used_count&event_id=eq.${encodeURIComponent(input.eventId)}&code_hash=eq.${encodeURIComponent(input.codeHash)}&limit=1`,
		useServiceRole: true,
	});

	if (!rows[0]) return null;
	return {
		id: rows[0].id,
		eventId: rows[0].event_id,
		active: rows[0].active,
		expiresAt: rows[0].expires_at,
		maxUses: rows[0].max_uses,
		usedCount: rows[0].used_count,
	};
}

export async function findClaimCodeRecordByKeyService(input: { codeKey: string }): Promise<{
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
} | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=id,event_id,active,expires_at,max_uses,used_count&code_key=eq.${encodeURIComponent(input.codeKey)}&limit=1`,
		useServiceRole: true,
	});

	if (!rows[0]) return null;
	return {
		id: rows[0].id,
		eventId: rows[0].event_id,
		active: rows[0].active,
		expiresAt: rows[0].expires_at,
		maxUses: rows[0].max_uses,
		usedCount: rows[0].used_count,
	};
}

export async function listClaimCodesService(input: {
	eventId?: string;
}): Promise<ClaimCodeRecord[]> {
	const eventFilter = input.eventId ? `&event_id=eq.${encodeURIComponent(input.eventId)}` : '';
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=*&order=created_at.desc${eventFilter}`,
		useServiceRole: true,
	});
	return rows.map(toClaimCodeRecord);
}

export async function findClaimCodeByIdService(
	claimCodeId: string,
): Promise<ClaimCodeRecord | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=*&id=eq.${encodeURIComponent(claimCodeId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toClaimCodeRecord(rows[0]) : null;
}

export async function createClaimCodeService(input: {
	eventId: string;
	codeHash: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string;
}): Promise<ClaimCodeRecord> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: 'event_claim_codes?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			event_id: input.eventId,
			code_hash: input.codeHash,
			code_key: input.codeHash,
			active: input.active,
			expires_at: input.expiresAt,
			max_uses: input.maxUses,
			used_count: input.usedCount,
			created_by: input.createdBy,
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear claim code.');
	return toClaimCodeRecord(rows[0]);
}

export async function updateClaimCodeService(input: {
	claimCodeId: string;
	active?: boolean;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<ClaimCodeRecord> {
	const body: Record<string, unknown> = {};
	if (typeof input.active === 'boolean') body.active = input.active;
	if (input.expiresAt !== undefined) body.expires_at = input.expiresAt;
	if (typeof input.maxUses === 'number') body.max_uses = input.maxUses;
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?id=eq.${encodeURIComponent(input.claimCodeId)}&select=*`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0]) throw new Error('No se pudo actualizar claim code.');
	return toClaimCodeRecord(rows[0]);
}

export async function disableClaimCodeService(claimCodeId: string): Promise<ClaimCodeRecord> {
	return updateClaimCodeService({ claimCodeId, active: false });
}

export async function incrementClaimCodeUsageService(
	claimCodeId: string,
	nextUsedCount: number,
): Promise<void> {
	await supabaseRestRequest<unknown[]>({
		pathWithQuery: `event_claim_codes?id=eq.${encodeURIComponent(claimCodeId)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: {
			used_count: nextUsedCount,
		},
	});
}

export async function createAuditLog(input: {
	actorId: string | null;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
	useServiceRole?: boolean;
}): Promise<void> {
	await supabaseRestRequest<unknown[]>({
		pathWithQuery: 'audit_logs',
		method: 'POST',
		useServiceRole: input.useServiceRole ?? true,
		prefer: 'return=minimal',
		body: {
			actor_id: input.actorId,
			action: input.action,
			target_table: input.targetTable,
			target_id: input.targetId,
			old_data: input.oldData,
			new_data: input.newData,
		},
	});
}
