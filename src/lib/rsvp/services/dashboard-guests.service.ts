import {
	createGuestInvitation,
	findGuestsByEvent,
	findGuestByPhone,
	softDeleteGuestById,
	updateGuestById,
} from '@/lib/rsvp/repositories/guest.repository';
import { findEventById, findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import type {
	AttendanceStatus,
	DeliveryFilter,
	DeliveryStatus,
	DashboardGuestMutationResponse,
} from '@/interfaces/rsvp/domain.interface';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';
import { ApiError, isApiError } from '@/lib/rsvp/core/errors';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import {
	getEventAccessOrThrow,
	getEventPresentationData,
	getGuestAccessOrThrow,
} from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import { getSharingTemplateForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import { normalizeImportedPhone, sanitize, toSafeAttendeeCount } from '@/lib/rsvp/core/utils';
import { generateShortId } from '@/lib/server/ids';

function buildDashboardTotals(items: DashboardGuestListResponse['items']) {
	let totalInvitations = 0;
	let totalPeople = 0;
	let pendingInvitations = 0;
	let pendingPeople = 0;
	let confirmedInvitations = 0;
	let confirmedPeople = 0;
	let declinedInvitations = 0;
	let declinedPeople = 0;
	let generatedInvitations = 0;
	let sharedInvitations = 0;
	let viewed = 0;

	for (const item of items) {
		totalInvitations++;
		totalPeople += item.maxAllowedAttendees ?? 0;

		switch (item.attendanceStatus) {
			case 'pending':
				pendingInvitations++;
				pendingPeople += item.maxAllowedAttendees ?? 0;
				break;
			case 'confirmed':
				confirmedInvitations++;
				confirmedPeople += item.attendeeCount ?? 0;
				break;
			case 'declined':
				declinedInvitations++;
				declinedPeople += item.maxAllowedAttendees ?? 0;
				break;
		}

		if (item.deliveryStatus === 'generated') generatedInvitations++;
		else if (item.deliveryStatus === 'shared') sharedInvitations++;

		if (item.firstViewedAt) viewed++;
	}

	return {
		totalInvitations,
		totalPeople,
		generatedInvitations,
		sharedInvitations,
		pendingInvitations,
		pendingPeople,
		confirmedInvitations,
		confirmedPeople,
		declinedInvitations,
		declinedPeople,
		viewed,
	};
}

export async function listDashboardGuests(input: {
	eventId: string;
	status?: AttendanceStatus | 'all' | 'viewed';
	search?: string;
	delivery?: DeliveryFilter;
	hostAccessToken: string;
	origin: string;
}): Promise<DashboardGuestListResponse> {
	const event = await findEventById(input.eventId, input.hostAccessToken);
	if (event) {
		const guests = await findGuestsByEvent(
			{
				eventId: event.id,
				status: input.status ?? 'all',
				search: sanitize(input.search, 120),
				delivery: input.delivery ?? 'all',
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

	const membership = await findMembershipByEventForHost(input.eventId, input.hostAccessToken);
	if (membership) {
		const guests = await findGuestsByEvent(
			{
				eventId: membership.eventId,
				status: input.status ?? 'all',
				search: sanitize(input.search, 120),
				delivery: input.delivery ?? 'all',
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

export async function createDashboardGuest(input: {
	eventId: string;
	fullName: string;
	phone?: string;
	countryCode?: string;
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

	const phone = input.phone ? normalizeImportedPhone(input.phone, input.countryCode) : undefined;
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
		if (isApiError(error)) throw error;
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
	countryCode?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestComment?: string;
	tags?: string[];
	deliveryStatus?: DeliveryStatus;
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
		const nextPhone =
			input.phone !== undefined
				? normalizeImportedPhone(input.phone, input.countryCode)
				: undefined;
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
				guestComment:
					input.guestComment !== undefined
						? sanitize(input.guestComment, 500)
						: undefined,
				lastResponseSource: 'admin',
				respondedAt: nextStatus === 'pending' ? null : new Date().toISOString(),
				tags: input.tags,
				deliveryStatus: input.deliveryStatus,
			},
			input.hostAccessToken,
		);
	} catch (error) {
		if (isApiError(error)) throw error;
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

	await softDeleteGuestById(input.guestId, input.hostAccessToken);
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

	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}
