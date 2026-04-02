import {
	createGuestInvitation,
	deleteGuestById,
	findGuestsByEvent,
	findGuestByPhone,
	updateGuestById,
} from '@/lib/rsvp/repositories/guest.repository';
import { findEventById } from '@/lib/rsvp/repositories/event.repository';
import { findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import type {
	AttendanceStatus,
	DashboardGuestMutationResponse,
} from '@/interfaces/rsvp/domain.interface';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import { publishGuestStreamEvent } from '@/lib/rsvp/core/stream';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import {
	getEventAccessOrThrow,
	getEventPresentationData,
	getGuestAccessOrThrow,
} from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import { getSharingTemplateForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import { normalizePhone, sanitize, toSafeAttendeeCount } from '@/lib/rsvp/core/utils';
import { generateShortId } from '@/lib/server/ids';

function buildDashboardTotals(items: DashboardGuestListResponse['items']) {
	const pendingItems = items.filter((item) => item.attendanceStatus === 'pending');
	const confirmedItems = items.filter((item) => item.attendanceStatus === 'confirmed');
	const declinedItems = items.filter((item) => item.attendanceStatus === 'declined');

	return {
		totalInvitations: items.length,
		totalPeople: items.reduce((acc, item) => acc + (item.maxAllowedAttendees || 0), 0),
		pendingInvitations: pendingItems.length,
		pendingPeople: pendingItems.reduce((acc, item) => acc + (item.maxAllowedAttendees || 0), 0),
		confirmedInvitations: confirmedItems.length,
		confirmedPeople: confirmedItems.reduce((acc, item) => acc + (item.attendeeCount || 0), 0),
		declinedInvitations: declinedItems.length,
		declinedPeople: declinedItems.reduce(
			(acc, item) => acc + (item.maxAllowedAttendees || 0),
			0,
		),
		viewed: items.filter((item) => !!item.firstViewedAt).length,
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
			return {
				eventId: membership.eventId,
				items,
				totals: buildDashboardTotals(items),
				updatedAt: new Date().toISOString(),
			};
		}

		const serviceEvent = await findEventByIdService(input.eventId);
		if (serviceEvent) {
			throw new ApiError(403, 'forbidden', 'Access to the requested event is denied.');
		}
		throw new ApiError(404, 'not_found', 'Event not found.');
	}

	const guests = await findGuestsByEvent(
		{
			eventId: event.id,
			status: input.status ?? 'all',
			search: sanitize(input.search, 120),
		},
		input.hostAccessToken,
	);

	const template = await getSharingTemplateForSlug(event.slug, event.eventType);
	const items = guests.map((guest) =>
		toGuestDto(guest, input.origin, event.title, event.eventType, event.slug, template),
	);

	return {
		eventId: event.id,
		items,
		totals: buildDashboardTotals(items),
		updatedAt: new Date().toISOString(),
	};
}

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
	if (!fullName) throw new ApiError(400, 'bad_request', 'Full name is required.');

	const phone = input.phone ? normalizePhone(input.phone) : undefined;
	if (phone) {
		const existing = await findGuestByPhone(event.id, phone, input.hostAccessToken);
		if (existing) {
			throw new ApiError(
				409,
				'conflict',
				'This phone number is already registered for this event.',
			);
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
				shortId: generateShortId(8),
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

export async function updateDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
	fullName?: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
	tags?: string[];
}): Promise<DashboardGuestMutationResponse> {
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);

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
		throw new ApiError(
			400,
			'bad_request',
			'Confirmed attendance requires at least one attendee.',
		);
	}
	if (nextAttendeeCount > nextCap) {
		throw new ApiError(400, 'bad_request', `The maximum allowed value is ${nextCap}.`);
	}

	let updated;
	try {
		const nextPhone = input.phone !== undefined ? normalizePhone(input.phone) : undefined;
		if (nextPhone && nextPhone !== existing.phone) {
			const duplicate = await findGuestByPhone(
				existing.eventId,
				nextPhone,
				input.hostAccessToken,
			);
			if (duplicate) {
				throw new ApiError(
					409,
					'conflict',
					'This phone number is already registered for this event.',
				);
			}
		}

		updated = await updateGuestById(
			{
				guestId: input.guestId,
				fullName: input.fullName !== undefined ? sanitize(input.fullName, 140) : undefined,
				phone: nextPhone,
				maxAllowedAttendees: nextCap,
				attendanceStatus: nextStatus,
				attendeeCount: nextAttendeeCount,
				guestMessage:
					input.guestMessage !== undefined
						? sanitize(input.guestMessage, 500)
						: undefined,
				lastResponseSource: 'admin',
				respondedAt: nextStatus === 'pending' ? null : new Date().toISOString(),
				tags: input.tags,
			},
			input.hostAccessToken,
		);
	} catch (error) {
		throw mapSupabaseErrorToApiError(error);
	}

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

	const presentation = await getEventPresentationData(updated.eventId, input.hostAccessToken);
	const item = toGuestDto(
		updated,
		input.origin,
		presentation.eventTitle,
		presentation.eventType,
		presentation.eventSlug,
		presentation.template,
	);

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
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);

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
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);
	const updated = await updateGuestById(
		{
			guestId: input.guestId,
			deliveryStatus: 'shared',
		},
		input.hostAccessToken,
	);

	const presentation = await getEventPresentationData(updated.eventId, input.hostAccessToken);
	const item = toGuestDto(
		updated,
		input.origin,
		presentation.eventTitle,
		presentation.eventType,
		presentation.eventSlug,
		presentation.template,
	);

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
