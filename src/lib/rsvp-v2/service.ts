import {
	createGuestInvitation,
	deleteGuestById,
	findEventById,
	findEventByInvitationPublic,
	findEventsByOwner,
	findGuestsByEvent,
	findGuestById,
	findGuestByInviteIdPublic,
	findGuestByLegacyIdentityPublic,
	updateGuestById,
	updateGuestByInviteIdPublic,
} from './repository';
import type {
	AttendanceStatus,
	DashboardGuestListResponse,
	EventRecord,
	GuestInvitationDTO,
	GuestInvitationRecord,
	GuestRSVPSubmitDTO,
} from './types';
import { getRsvpContext } from '@/lib/rsvp/service';

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
	if (!event) throw new Error('Evento no encontrado o sin permisos.');

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
	return findEventsByOwner(input.hostUserId, input.hostAccessToken);
}

export async function createDashboardGuest(input: {
	eventId: string;
	fullName: string;
	phoneE164: string;
	maxAllowedAttendees: number;
	hostAccessToken: string;
	origin: string;
}): Promise<GuestInvitationDTO> {
	const event = await findEventById(input.eventId, input.hostAccessToken);
	if (!event) throw new Error('Evento no encontrado o sin permisos.');

	const fullName = sanitize(input.fullName, 140);
	if (!fullName) throw new Error('Nombre completo es obligatorio.');
	const phoneE164 = normalizePhone(input.phoneE164);
	if (!phoneE164) throw new Error('Telefono es obligatorio.');
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

	return toGuestDto(created, input.origin, event.title);
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
}): Promise<GuestInvitationDTO> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) throw new Error('Invitado no encontrado o sin permisos.');

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
		throw new Error('Confirmado requiere al menos un asistente.');
	}
	if (nextAttendeeCount > nextCap) {
		throw new Error(`El maximo permitido es ${nextCap}.`);
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

	return toGuestDto(updated, input.origin);
}

export async function deleteDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
}): Promise<void> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) throw new Error('Invitado no encontrado o sin permisos.');
	await deleteGuestById(input.guestId, input.hostAccessToken);
}

export async function markGuestShared(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
}): Promise<GuestInvitationDTO> {
	const existing = await findGuestById(input.guestId, input.hostAccessToken);
	if (!existing) throw new Error('Invitado no encontrado o sin permisos.');

	const updated = await updateGuestById(
		{
			guestId: input.guestId,
			deliveryStatus: 'shared',
		},
		input.hostAccessToken,
	);

	return toGuestDto(updated, input.origin);
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
	if (!safeInviteId) throw new Error('inviteId invalido.');

	const invitation = await findGuestByInviteIdPublic(safeInviteId);
	if (!invitation) throw new Error('Invitacion no encontrada.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new Error('Evento no encontrado.');

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
	if (!invitation) throw new Error('Invitacion no encontrada.');

	const attendanceStatus = payload.attendanceStatus;
	if (attendanceStatus !== 'confirmed' && attendanceStatus !== 'declined') {
		throw new Error('Estado de asistencia invalido.');
	}

	const safeCount = toSafeAttendeeCount(payload.attendeeCount);
	const attendeeCount = attendanceStatus === 'declined' ? 0 : safeCount;
	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new Error('Confirmado requiere al menos 1 asistente.');
	}
	if (attendeeCount > invitation.maxAllowedAttendees) {
		throw new Error(`El limite para esta invitacion es ${invitation.maxAllowedAttendees}.`);
	}

	const respondedAt = new Date().toISOString();
	const updated = await updateGuestByInviteIdPublic(inviteId, {
		attendance_status: attendanceStatus,
		attendee_count: attendeeCount,
		guest_message: sanitize(payload.guestMessage, 500),
		responded_at: respondedAt,
		last_response_source: 'link',
	});

	return {
		attendanceStatus: updated.attendanceStatus,
		attendeeCount: updated.attendeeCount,
		respondedAt: updated.respondedAt ?? respondedAt,
	};
}

export async function trackInvitationView(inviteId: string): Promise<void> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new Error('Invitacion no encontrada.');
	const now = new Date().toISOString();
	await updateGuestByInviteIdPublic(inviteId, {
		first_viewed_at: invitation.firstViewedAt ?? now,
		last_viewed_at: now,
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
