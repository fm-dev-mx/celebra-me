import {
	createEventMembershipService,
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
	incrementClaimCodeUsageService,
	listMembershipsForHost,
	upsertUserRoleService,
	findClaimCodeRecordByKeyService,
	updateGuestById,
	updateGuestByInviteIdPublic,
	createAuditLog,
} from './repository';
import type {
	AttendanceStatus,
	DashboardGuestListResponse,
	DashboardGuestMutationResponse,
	EventRecord,
	GuestInvitationDTO,
	GuestInvitationRecord,
	GuestRSVPSubmitDTO,
} from './types';
import { getRsvpContext } from '@/lib/rsvp/service';
import { ApiError } from './errors';
import { publishGuestStreamEvent } from './stream';
import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '@/utils/env';

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

function buildInviteUrl(origin: string, inviteId: string): string {
	return `${origin.replace(/\/+$/, '')}/invitacion/${encodeURIComponent(inviteId)}`;
}

async function logAdminAction(input: {
	actorId: string;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
}) {
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
	eventTitle?: string;
}): string {
	const targetPhone = normalizePhone(input.phoneE164).replace(/^\+/, '');
	if (!targetPhone) return '';
	const inviteUrl = buildInviteUrl(input.origin, input.inviteId);
	const eventLabel = sanitize(input.eventTitle, 120) || 'nuestro evento';
	const message = `Hola ${sanitize(input.fullName, 120)}, te compartimos tu invitacion: ${inviteUrl} (${eventLabel}).`;
	return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

function toGuestDto(
	guest: GuestInvitationRecord,
	origin: string,
	eventTitle?: string,
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
		}),
		updatedAt: guest.updatedAt,
	};
}

export async function listDashboardGuests(input: {
	eventId: string;
	status?: AttendanceStatus | 'all';
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

	const items = guests.map((guest) => toGuestDto(guest, input.origin, event.title));
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
		},
		input.hostAccessToken,
	);

	const item = toGuestDto(created, input.origin, event.title);

	if (isSuperAdminEmail(input.origin)) {
		await logAdminAction({
			actorId: input.hostAccessToken,
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
	fullName?: string;
	phoneE164?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
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
		},
		input.hostAccessToken,
	);

	if (isSuperAdminEmail(input.origin)) {
		await logAdminAction({
			actorId: input.hostAccessToken,
			action: 'update_guest',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: updated as unknown as Record<string, unknown>,
		});
	}

	const item = toGuestDto(updated, input.origin);
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
}): Promise<void> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) {
		const serviceGuest = await findGuestByIdService(input.guestId);
		if (serviceGuest) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al invitado solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Invitado no encontrado.');
	}

	if (isSuperAdminEmail(input.hostAccessToken)) {
		await logAdminAction({
			actorId: input.hostAccessToken,
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

	const item = toGuestDto(updated, input.origin);
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
	const claim = await findClaimCodeRecordByKeyService({
		codeKey: hashClaimCode(input.claimCode),
	});
	if (!claim || !claim.active) {
		throw new ApiError(403, 'forbidden', 'Claim code invalido.');
	}
	if (claim.expiresAt && new Date(claim.expiresAt).getTime() < Date.now()) {
		throw new ApiError(403, 'forbidden', 'Claim code expirado.');
	}
	if (claim.usedCount >= claim.maxUses) {
		throw new ApiError(403, 'forbidden', 'Claim code agotado.');
	}

	await createEventMembershipService({
		eventId: claim.eventId,
		userId: input.userId,
		membershipRole: 'owner',
	});
	await incrementClaimCodeUsageService(claim.id, claim.usedCount + 1);
	return {
		eventId: claim.eventId,
		membershipRole: 'owner',
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

export function generateTemporaryPassword(): string {
	return `${randomBytes(12).toString('base64url')}!aA1`;
}
