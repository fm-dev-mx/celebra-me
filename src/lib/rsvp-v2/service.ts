import {
	createGuestInvitation,
	deleteGuestById,
	findEventById,
	findEventByIdService,
	findEventByInvitationPublic,
	findEventsForHost,
	findGuestsByEvent,
	findMembershipByEventForHost,
	findGuestById,
	findGuestByIdService,
	findGuestByInviteIdPublic,
	findGuestByLegacyIdentityPublic,
	findUserRoleService,
	listMembershipsForHost,
	upsertUserRoleService,
	findClaimCodeRecordByKeyService,
	updateGuestById,
	updateGuestByInviteIdPublic,
	createAuditLog,
	createClaimCodeService,
	disableClaimCodeService,
	findAppUserRoleByUserIdService,
	findClaimCodeByIdService,
	listAllEventsService,
	listClaimCodesService,
	listUserRolesService,
	updateClaimCodeService,
	redeemClaimCodeRpc,
	createEventService,
	updateEventService,
	findGuestByShortIdPublic,
} from './repository';
import type {
	AdminEventListItemDTO,
	AdminUserListItemDTO,
	AttendanceStatus,
	ClaimCodeDTO,
	ClaimCodeStatus,
	DashboardGuestListResponse,
	DashboardGuestMutationResponse,
	EventRecord,
	GuestInvitationDTO,
	GuestInvitationRecord,
	GuestRSVPSubmitDTO,
	AppUserRole,
} from './types';
import { getRsvpContext } from '@/lib/rsvp/service';
import { ApiError } from './errors';
import { publishGuestStreamEvent } from './stream';
import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '@/utils/env';
import { listAuthUsers } from './authApi';
import { generateShortId } from '@/utils/ids';
import { generateInvitationLink } from '@/utils/invitationLink';

const MAX_TEXT_LEN = 500;

function sanitize(value: unknown, maxLen = MAX_TEXT_LEN): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function normalizePhone(phone: string): string {
	return sanitize(phone, 40).replace(/[^\d+]/g, '');
}

function toSafeAttendeeCount(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
	return Math.max(0, Math.min(Math.trunc(raw), 20));
}

function buildInviteUrl(
	origin: string,
	id: string,
	isShortId?: boolean,
	eventType?: string,
	eventSlug?: string,
): string {
	// For backward compatibility, if eventType and eventSlug are not provided,
	// use the old format
	if (!eventType || !eventSlug) {
		const baseUrl = origin.replace(/\/+$/, '');
		return `${baseUrl}/invitacion/${encodeURIComponent(id)}`;
	}

	// Use the new format with generateInvitationLink
	return generateInvitationLink({
		origin,
		eventType,
		eventSlug,
		inviteId: isShortId ? '' : id,
		shortId: isShortId ? id : undefined,
	});
}

async function logAdminAction(input: {
	actorId: string;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
}) {
	if (!sanitize(input.actorId, 120)) return;
	try {
		await createAuditLog({
			...input,
			useServiceRole: true,
		});
	} catch (error) {
		console.error('[Audit] Failed to log admin action:', error);
	}
}

function buildWhatsAppShareUrl(input: {
	origin: string;
	inviteId: string;
	phoneE164: string;
	fullName: string;
	shortId?: string;
	eventTitle?: string;
	eventType?: string;
	eventSlug?: string;
}): string {
	const targetPhone = normalizePhone(input.phoneE164).replace(/^\+/, '');
	if (!targetPhone) return '';
	const inviteUrl = buildInviteUrl(
		input.origin,
		input.shortId || input.inviteId,
		!!input.shortId,
		input.eventType,
		input.eventSlug,
	);
	const eventLabel = sanitize(input.eventTitle, 120) || 'nuestro evento';
	const message = `Hola ${sanitize(input.fullName, 120)}, te compartimos tu invitacion: ${inviteUrl} (${eventLabel}).`;
	return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

function toGuestDto(
	guest: GuestInvitationRecord,
	origin: string,
	eventTitle?: string,
	eventType?: EventRecord['eventType'],
	eventSlug?: string,
): GuestInvitationDTO {
	return {
		guestId: guest.id,
		inviteId: guest.inviteId,
		fullName: guest.fullName,
		phoneE164: guest.phoneE164,
		maxAllowedAttendees: guest.maxAllowedAttendees,
		attendanceStatus: guest.attendanceStatus,
		attendeeCount: guest.attendeeCount,
		guestMessage: guest.guestMessage,
		deliveryStatus: guest.deliveryStatus,
		firstViewedAt: guest.firstViewedAt,
		respondedAt: guest.respondedAt,
		waShareUrl: buildWhatsAppShareUrl({
			origin,
			inviteId: guest.inviteId,
			phoneE164: guest.phoneE164,
			fullName: guest.fullName,
			eventTitle,
			shortId: guest.shortId,
			eventType,
			eventSlug,
		}),
		updatedAt: guest.updatedAt,
		tags: guest.tags || [],
		eventType,
		eventSlug,
		shortId: guest.shortId,
	};
}

export async function listDashboardGuests(input: {
	eventId: string;
	status?: AttendanceStatus | 'all' | 'viewed';
	search?: string;
	hostAccessToken: string;
	origin: string;
}): Promise<DashboardGuestListResponse> {
	const event = await findEventById(input.eventId, input.hostAccessToken);
	if (!event) {
		const membership = await findMembershipByEventForHost(input.eventId, input.hostAccessToken);
		if (membership) {
			const guests = await findGuestsByEvent(
				{
					eventId: membership.eventId,
					status: input.status ?? 'all',
					search: sanitize(input.search, 120),
				},
				input.hostAccessToken,
			);
			const items = guests.map((guest) => toGuestDto(guest, input.origin));
			// NOTE: If membership exists but event details are missing, DTO will have missing fields.
			// However, the main flow below fetches the event correctly.
			return {
				eventId: membership.eventId,
				items,
				totals: {
					total: items.length,
					pending: items.filter((item) => item.attendanceStatus === 'pending').length,
					confirmed: items.filter((item) => item.attendanceStatus === 'confirmed').length,
					declined: items.filter((item) => item.attendanceStatus === 'declined').length,
					viewed: items.filter((item) => !!item.firstViewedAt).length,
				},
				updatedAt: new Date().toISOString(),
			};
		}
		// Try to fetch service event if membership branch is too limited
		const serviceEvent = await findEventByIdService(input.eventId);
		if (serviceEvent) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Evento no encontrado.');
	}

	const guests = await findGuestsByEvent(
		{
			eventId: event.id,
			status: input.status ?? 'all',
			search: sanitize(input.search, 120),
		},
		input.hostAccessToken,
	);

	const items = guests.map((guest) =>
		toGuestDto(guest, input.origin, event.title, event.eventType, event.slug),
	);
	return {
		eventId: event.id,
		items,
		totals: {
			total: items.length,
			pending: items.filter((item) => item.attendanceStatus === 'pending').length,
			confirmed: items.filter((item) => item.attendanceStatus === 'confirmed').length,
			declined: items.filter((item) => item.attendanceStatus === 'declined').length,
			viewed: items.filter((item) => !!item.firstViewedAt).length,
		},
		updatedAt: new Date().toISOString(),
	};
}

export async function listHostEvents(input: {
	hostUserId: string;
	hostAccessToken: string;
}): Promise<EventRecord[]> {
	void input.hostUserId;
	return findEventsForHost(input.hostAccessToken);
}

export async function createDashboardGuest(input: {
	eventId: string;
	fullName: string;
	phoneE164: string;
	maxAllowedAttendees: number;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
	tags?: string[];
}): Promise<DashboardGuestMutationResponse> {
	const event = await findEventById(input.eventId, input.hostAccessToken);
	if (!event) {
		const serviceEvent = await findEventByIdService(input.eventId);
		if (serviceEvent) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Evento no encontrado.');
	}

	const fullName = sanitize(input.fullName, 140);
	if (!fullName) throw new ApiError(400, 'bad_request', 'Nombre completo es obligatorio.');
	const phoneE164 = normalizePhone(input.phoneE164);
	if (!phoneE164) throw new ApiError(400, 'bad_request', 'Telefono es obligatorio.');
	const maxAllowedAttendees = Math.max(
		1,
		Math.min(20, Math.trunc(input.maxAllowedAttendees || 1)),
	);

	const created = await createGuestInvitation(
		{
			eventId: event.id,
			fullName,
			phoneE164,
			maxAllowedAttendees,
			tags: input.tags,
			short_id: generateShortId(8),
		},
		input.hostAccessToken,
	);

	const item = toGuestDto(created, input.origin, event.title, event.eventType, event.slug);

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

export async function updateDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
	fullName?: string;
	phoneE164?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
	tags?: string[];
}): Promise<DashboardGuestMutationResponse> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) {
		const serviceGuest = await findGuestByIdService(input.guestId);
		if (serviceGuest) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al invitado solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Invitado no encontrado.');
	}

	const nextStatus = input.attendanceStatus ?? existing.attendanceStatus;
	const requestedCount =
		input.attendeeCount !== undefined
			? toSafeAttendeeCount(input.attendeeCount)
			: existing.attendeeCount;
	const nextAttendeeCount = nextStatus === 'declined' ? 0 : requestedCount;
	const nextCap =
		input.maxAllowedAttendees !== undefined
			? Math.max(1, Math.min(20, Math.trunc(input.maxAllowedAttendees)))
			: existing.maxAllowedAttendees;

	if (nextStatus === 'confirmed' && nextAttendeeCount < 1) {
		throw new ApiError(400, 'bad_request', 'Confirmado requiere al menos un asistente.');
	}
	if (nextAttendeeCount > nextCap) {
		throw new ApiError(400, 'bad_request', `El maximo permitido es ${nextCap}.`);
	}

	const updated = await updateGuestById(
		{
			guestId: input.guestId,
			fullName: input.fullName !== undefined ? sanitize(input.fullName, 140) : undefined,
			phoneE164: input.phoneE164 !== undefined ? normalizePhone(input.phoneE164) : undefined,
			maxAllowedAttendees: nextCap,
			attendanceStatus: nextStatus,
			attendeeCount: nextAttendeeCount,
			guestMessage:
				input.guestMessage !== undefined ? sanitize(input.guestMessage, 500) : undefined,
			lastResponseSource: 'admin',
			respondedAt: nextStatus === 'pending' ? null : new Date().toISOString(),
			tags: input.tags,
		},
		input.hostAccessToken,
	);

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'update_guest',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: updated as unknown as Record<string, unknown>,
		});
	}

	let eventTitle: string | undefined;
	let eventType: EventRecord['eventType'] | undefined;
	let eventSlug: string | undefined;

	const event = await findEventById(updated.eventId, input.hostAccessToken);
	if (event) {
		eventTitle = event.title;
		eventType = event.eventType;
		eventSlug = event.slug;
	}

	const item = toGuestDto(updated, input.origin, eventTitle, eventType, eventSlug);
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: updated.eventId,
		guestId: updated.id,
		updatedAt: item.updatedAt,
	});
	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}

export async function deleteDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
}): Promise<void> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) {
		const serviceGuest = await findGuestByIdService(input.guestId);
		if (serviceGuest) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al invitado solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Invitado no encontrado.');
	}

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'delete_guest',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: null,
		});
	}

	await deleteGuestById(input.guestId, input.hostAccessToken);
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: existing.eventId,
		guestId: existing.id,
		updatedAt: new Date().toISOString(),
	});
}

export async function markGuestShared(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
}): Promise<DashboardGuestMutationResponse> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) {
		const serviceGuest = await findGuestByIdService(input.guestId);
		if (serviceGuest) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al invitado solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Invitado no encontrado.');
	}

	const updated = await updateGuestById(
		{
			guestId: input.guestId,
			deliveryStatus: 'shared',
		},
		input.hostAccessToken,
	);

	let eventTitle: string | undefined;
	let eventType: EventRecord['eventType'] | undefined;
	let eventSlug: string | undefined;

	const event = await findEventById(updated.eventId, input.hostAccessToken);
	if (event) {
		eventTitle = event.title;
		eventType = event.eventType;
		eventSlug = event.slug;
	}

	const item = toGuestDto(updated, input.origin, eventTitle, eventType, eventSlug);
	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'mark_guest_shared',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: updated as unknown as Record<string, unknown>,
		});
	}
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: updated.eventId,
		guestId: updated.id,
		updatedAt: item.updatedAt,
	});
	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}

export async function getInvitationContextByInviteId(inviteId: string): Promise<{
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestMessage: string;
	};
}> {
	const safeInviteId = sanitize(inviteId, 64);
	if (!safeInviteId) throw new ApiError(400, 'bad_request', 'inviteId invalido.');

	const invitation = await findGuestByInviteIdPublic(safeInviteId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Evento no encontrado.');

	return {
		inviteId: invitation.inviteId,
		eventSlug: event.slug,
		eventType: event.eventType,
		eventTitle: event.title,
		guest: {
			fullName: invitation.fullName,
			maxAllowedAttendees: invitation.maxAllowedAttendees,
			attendanceStatus: invitation.attendanceStatus,
			attendeeCount: invitation.attendeeCount,
			guestMessage: invitation.guestMessage,
		},
	};
}

export async function getInvitationContextByShortId(shortId: string): Promise<{
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestMessage: string;
	};
}> {
	const safeShortId = sanitize(shortId, 12);
	if (!safeShortId) throw new ApiError(400, 'bad_request', 'short_id invalido.');

	const invitation = await findGuestByShortIdPublic(safeShortId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Evento no encontrado.');

	return {
		inviteId: invitation.inviteId,
		eventSlug: event.slug,
		eventType: event.eventType,
		eventTitle: event.title,
		guest: {
			fullName: invitation.fullName,
			maxAllowedAttendees: invitation.maxAllowedAttendees,
			attendanceStatus: invitation.attendanceStatus,
			attendeeCount: invitation.attendeeCount,
			guestMessage: invitation.guestMessage,
		},
	};
}

export async function submitGuestRsvpByInviteId(
	inviteId: string,
	payload: GuestRSVPSubmitDTO,
): Promise<{ attendanceStatus: AttendanceStatus; attendeeCount: number; respondedAt: string }> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const attendanceStatus = payload.attendanceStatus;
	if (attendanceStatus !== 'confirmed' && attendanceStatus !== 'declined') {
		throw new ApiError(400, 'bad_request', 'Estado de asistencia invalido.');
	}

	const safeCount = toSafeAttendeeCount(payload.attendeeCount);
	const attendeeCount = attendanceStatus === 'declined' ? 0 : safeCount;
	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new ApiError(400, 'bad_request', 'Confirmado requiere al menos 1 asistente.');
	}
	if (attendeeCount > invitation.maxAllowedAttendees) {
		throw new ApiError(
			400,
			'bad_request',
			`El limite para esta invitacion es ${invitation.maxAllowedAttendees}.`,
		);
	}

	const respondedAt = new Date().toISOString();
	const updated = await updateGuestByInviteIdPublic(inviteId, {
		attendance_status: attendanceStatus,
		attendee_count: attendeeCount,
		guest_message: sanitize(payload.guestMessage, 500),
		responded_at: respondedAt,
		last_response_source: 'link',
	});
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: invitation.eventId,
		guestId: invitation.id,
		updatedAt: updated.updatedAt,
	});

	return {
		attendanceStatus: updated.attendanceStatus,
		attendeeCount: updated.attendeeCount,
		respondedAt: updated.respondedAt ?? respondedAt,
	};
}

export async function trackInvitationView(inviteId: string): Promise<void> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');
	const now = new Date().toISOString();
	await updateGuestByInviteIdPublic(inviteId, {
		first_viewed_at: invitation.firstViewedAt ?? now,
		last_viewed_at: now,
	});
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: invitation.eventId,
		guestId: invitation.id,
		updatedAt: now,
	});
}

export async function resolveLegacyTokenToCanonicalUrl(input: {
	eventSlug: string;
	token: string;
	origin: string;
}): Promise<string | null> {
	const context = await getRsvpContext(
		sanitize(input.eventSlug, 120),
		sanitize(input.token, 2048),
	);
	if (!context.tokenValid || !context.guest) return null;

	const invitation = await findGuestByLegacyIdentityPublic({
		eventSlug: context.eventSlug,
		guestId: context.guest.guestId,
	});
	if (!invitation) return null;

	return buildInviteUrl(input.origin, invitation.inviteId);
}

function hashClaimCode(rawCode: string): string {
	const pepper = getEnv('RSVP_CLAIM_CODE_PEPPER') || 'default-pepper';
	return createHash('sha256')
		.update(`${pepper}:${normalizeClaimCode(rawCode)}`)
		.digest('hex');
}

export function normalizeClaimCode(rawCode: string): string {
	return sanitize(rawCode, 256).toLowerCase();
}

export function isSuperAdminEmail(email: string): boolean {
	const allowlist = (getEnv('SUPER_ADMIN_EMAILS') || '')
		.split(',')
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
	if (allowlist.length === 0) return false;
	return allowlist.includes(sanitize(email, 320).toLowerCase());
}

export async function ensureUserRole(input: {
	userId: string;
	email: string;
	defaultRole?: 'host_client' | 'super_admin';
}): Promise<'host_client' | 'super_admin'> {
	const existing = await findUserRoleService(input.userId);
	if (existing) return existing.role;
	const nextRole = isSuperAdminEmail(input.email)
		? 'super_admin'
		: (input.defaultRole ?? 'host_client');
	const upserted = await upsertUserRoleService({
		userId: input.userId,
		role: nextRole,
	});
	return upserted.role;
}

export async function claimEventForUser(input: {
	userId: string;
	eventSlug: string;
	claimCode: string;
}): Promise<{ eventId: string; membershipRole: 'owner' | 'manager' }> {
	void sanitize(input.eventSlug, 120);
	return claimEventForUserByClaimCode({
		userId: input.userId,
		claimCode: input.claimCode,
	});
}

export async function claimEventForUserByClaimCode(input: {
	userId: string;
	claimCode: string;
}): Promise<{ eventId: string; membershipRole: 'owner' | 'manager' }> {
	const result = await redeemClaimCodeRpc({
		userId: input.userId,
		codeKey: hashClaimCode(input.claimCode),
	});

	if (!result.success) {
		const errorMessages: Record<string, string> = {
			invalid_code: 'Claim code invalido.',
			inactive: 'Claim code desactivado.',
			expired: 'Claim code expirado.',
			exhausted: 'Claim code agotado.',
		};
		throw new ApiError(
			403,
			'forbidden',
			errorMessages[result.errorCode || ''] || 'Error al canjear el codigo.',
		);
	}

	if (!result.eventId) {
		throw new ApiError(500, 'internal_error', 'Error inesperado: no se recibio event_id');
	}

	return {
		eventId: result.eventId,
		membershipRole: result.membershipRole || 'owner',
	};
}

export async function buildAuthSessionDto(input: {
	userId: string;
	email: string;
	accessToken: string;
}): Promise<{
	userId: string;
	email: string;
	role: 'host_client' | 'super_admin' | null;
	isSuperAdmin: boolean;
	memberships: Array<{
		id: string;
		eventId: string;
		userId: string;
		membershipRole: 'owner' | 'manager';
		createdAt: string;
		updatedAt: string;
	}>;
}> {
	const role = await ensureUserRole({
		userId: input.userId,
		email: input.email,
		defaultRole: 'host_client',
	});
	const memberships = await listMembershipsForHost(input.accessToken);
	return {
		userId: input.userId,
		email: sanitize(input.email, 320),
		role,
		isSuperAdmin: role === 'super_admin',
		memberships,
	};
}

function toClaimCodeStatus(input: {
	active: boolean;
	expiresAt: string | null;
	usedCount: number;
	maxUses: number;
}): ClaimCodeStatus {
	if (!input.active) return 'disabled';
	if (input.expiresAt && new Date(input.expiresAt).getTime() < Date.now()) return 'expired';
	if (input.usedCount >= input.maxUses) return 'exhausted';
	return 'active';
}

function toClaimCodeDto(input: {
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}): ClaimCodeDTO {
	return {
		id: input.id,
		eventId: input.eventId,
		active: input.active,
		expiresAt: input.expiresAt,
		maxUses: input.maxUses,
		usedCount: input.usedCount,
		createdBy: input.createdBy,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		status: toClaimCodeStatus(input),
	};
}

function generateClaimCode(length = 12): string {
	return randomBytes(length)
		.toString('base64url')
		.replace(/[^A-Za-z0-9]/g, '')
		.slice(0, length);
}

export async function listClaimCodesAdmin(input: { eventId?: string }): Promise<ClaimCodeDTO[]> {
	const items = await listClaimCodesService({
		eventId: sanitize(input.eventId, 120) || undefined,
	});
	return items.map(toClaimCodeDto);
}

export async function createClaimCodeAdmin(input: {
	eventId: string;
	createdBy: string;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<{ plainCode: string; item: ClaimCodeDTO }> {
	const eventId = sanitize(input.eventId, 120);
	if (!eventId) throw new ApiError(400, 'bad_request', 'eventId es obligatorio.');
	const plainCode = generateClaimCode(14);
	const maxUses = Math.max(1, Math.min(10000, Math.trunc(input.maxUses ?? 1)));
	const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
	const created = await createClaimCodeService({
		eventId,
		codeHash: hashClaimCode(plainCode),
		active: true,
		expiresAt,
		maxUses,
		usedCount: 0,
		createdBy: sanitize(input.createdBy, 120),
	});
	return {
		plainCode,
		item: toClaimCodeDto(created),
	};
}

export async function updateClaimCodeAdmin(input: {
	claimCodeId: string;
	active?: boolean;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<ClaimCodeDTO> {
	const claimCodeId = sanitize(input.claimCodeId, 120);
	if (!claimCodeId) throw new ApiError(400, 'bad_request', 'claimCodeId es obligatorio.');
	const existing = await findClaimCodeByIdService(claimCodeId);
	if (!existing) throw new ApiError(404, 'not_found', 'Claim code no encontrado.');
	const updated = await updateClaimCodeService({
		claimCodeId,
		active: typeof input.active === 'boolean' ? input.active : undefined,
		expiresAt: input.expiresAt !== undefined ? input.expiresAt : undefined,
		maxUses:
			typeof input.maxUses === 'number'
				? Math.max(1, Math.min(10000, Math.trunc(input.maxUses)))
				: undefined,
	});
	return toClaimCodeDto(updated);
}

export async function disableClaimCodeAdmin(input: { claimCodeId: string }): Promise<ClaimCodeDTO> {
	const claimCodeId = sanitize(input.claimCodeId, 120);
	if (!claimCodeId) throw new ApiError(400, 'bad_request', 'claimCodeId es obligatorio.');
	const updated = await disableClaimCodeService(claimCodeId);
	return toClaimCodeDto(updated);
}

export async function validateClaimCodeAdmin(input: { claimCode: string }): Promise<ClaimCodeDTO> {
	const claim = await findClaimCodeRecordByKeyService({
		codeKey: hashClaimCode(input.claimCode),
	});
	if (!claim) throw new ApiError(404, 'not_found', 'Claim code no encontrado.');
	return toClaimCodeDto({
		id: claim.id,
		eventId: claim.eventId,
		active: claim.active,
		expiresAt: claim.expiresAt,
		maxUses: claim.maxUses,
		usedCount: claim.usedCount,
		createdBy: null,
		createdAt: '',
		updatedAt: '',
	});
}

export async function listAdminEvents(): Promise<AdminEventListItemDTO[]> {
	const events = await listAllEventsService();
	return events.map((event) => ({
		id: event.id,
		title: event.title,
		slug: event.slug,
		eventType: event.eventType,
		status: event.status,
		ownerUserId: event.ownerUserId,
		createdAt: event.createdAt,
		updatedAt: event.updatedAt,
	}));
}

export async function createEventAdmin(input: {
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
	status?: EventRecord['status'];
	actorUserId: string;
}): Promise<AdminEventListItemDTO> {
	const title = sanitize(input.title, 140);
	const slug = sanitize(input.slug, 120);
	const eventType = input.eventType;
	const status = input.status || 'draft';

	if (!title || !slug || !eventType) {
		throw new ApiError(400, 'bad_request', 'title, slug y eventType son obligatorios.');
	}

	if (!['xv', 'boda', 'bautizo', 'cumple'].includes(eventType)) {
		throw new ApiError(
			400,
			'bad_request',
			'eventType debe ser uno de: xv, boda, bautizo, cumple',
		);
	}

	const event = await createEventService({
		ownerUserId: input.actorUserId,
		slug,
		eventType,
		title,
		status,
	});

	await logAdminAction({
		actorId: input.actorUserId,
		action: 'create_event',
		targetTable: 'events',
		targetId: event.id,
		oldData: null,
		newData: event as unknown as Record<string, unknown>,
	});

	return {
		id: event.id,
		title: event.title,
		slug: event.slug,
		eventType: event.eventType,
		status: event.status,
		ownerUserId: event.ownerUserId,
		createdAt: event.createdAt,
		updatedAt: event.updatedAt,
	};
}

export async function updateEventAdmin(input: {
	eventId: string;
	title?: string;
	slug?: string;
	eventType?: EventRecord['eventType'];
	status?: EventRecord['status'];
	actorUserId: string;
}): Promise<AdminEventListItemDTO> {
	const eventId = sanitize(input.eventId, 120);
	if (!eventId) throw new ApiError(400, 'bad_request', 'eventId es obligatorio.');

	const existing = await findEventByIdService(eventId);
	if (!existing) throw new ApiError(404, 'not_found', 'Evento no encontrado.');

	const event = await updateEventService({
		eventId,
		title: input.title !== undefined ? sanitize(input.title, 140) : undefined,
		slug: input.slug !== undefined ? sanitize(input.slug, 120) : undefined,
		eventType: input.eventType,
		status: input.status,
	});

	await logAdminAction({
		actorId: input.actorUserId,
		action: 'update_event',
		targetTable: 'events',
		targetId: event.id,
		oldData: existing as unknown as Record<string, unknown>,
		newData: event as unknown as Record<string, unknown>,
	});

	return {
		id: event.id,
		title: event.title,
		slug: event.slug,
		eventType: event.eventType,
		status: event.status,
		ownerUserId: event.ownerUserId,
		createdAt: event.createdAt,
		updatedAt: event.updatedAt,
	};
}

export async function listAdminUsers(input?: {
	page?: number;
	perPage?: number;
}): Promise<AdminUserListItemDTO[]> {
	const users = await listAuthUsers({
		page: input?.page ?? 1,
		perPage: input?.perPage ?? 200,
	});
	const roleRecords = await listUserRolesService();
	const roleMap = new Map<string, AppUserRole>();
	for (const item of roleRecords) {
		roleMap.set(item.userId, item.role);
	}
	return users.map((user) => ({
		id: user.id,
		email: sanitize(user.email, 320),
		role: roleMap.get(user.id) ?? 'host_client',
		createdAt: user.created_at || new Date().toISOString(),
	}));
}

export async function changeUserRoleAdmin(input: {
	userId: string;
	role: AppUserRole;
	actorUserId: string;
}): Promise<{ userId: string; role: AppUserRole }> {
	const userId = sanitize(input.userId, 120);
	const role = input.role === 'super_admin' ? 'super_admin' : 'host_client';
	const existing = await findAppUserRoleByUserIdService(userId);
	const next = await upsertUserRoleService({ userId, role });
	await logAdminAction({
		actorId: sanitize(input.actorUserId, 120),
		action: 'change_user_role',
		targetTable: 'app_user_roles',
		targetId: userId,
		oldData: existing ? (existing as unknown as Record<string, unknown>) : null,
		newData: next as unknown as Record<string, unknown>,
	});
	return {
		userId: next.userId,
		role: next.role,
	};
}

export function generateTemporaryPassword(): string {
	return `${randomBytes(12).toString('base64url')}!aA1`;
}
