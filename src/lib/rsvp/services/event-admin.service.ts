import {
	findEventById,
	findEventByIdService,
	findEventsByOwner,
	findEventsForHost,
	findEventBySlugService,
	listAllEventsService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { listMembershipsForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import type { DashboardEventListDebug } from '@/interfaces/dashboard/admin.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import { sanitize } from '@/lib/rsvp/core/utils';
import { toDashboardEventItem } from '@/lib/rsvp/services/shared/dashboard-event-item';

const UNIQUE_VIOLATION = '23505';

async function listAllEventsForSuperAdmin(input: {
	hostUserId: string;
	requestedSlug: string;
}): Promise<{ events: EventRecord[]; debug: DashboardEventListDebug }> {
	const events = await listAllEventsService();
	const requestedSlugEvent = input.requestedSlug
		? await findEventBySlugService(input.requestedSlug)
		: null;
	return {
		events,
		debug: {
			session: {
				hasAccessToken: true,
				tokenSource: 'cookie',
				reason: 'session_role_resolved',
				userId: input.hostUserId,
				email: null,
				role: 'super_admin',
				isSuperAdmin: true,
			},
			ownerEvents: [],
			visibleEvents: events.map(toDashboardEventItem),
			memberships: [],
			membershipResolvedEvents: [],
			unresolvedMembershipEventIds: [],
			requestedSlugCheck: input.requestedSlug
				? {
						requestedSlug: input.requestedSlug,
						slugExistsInDb: Boolean(requestedSlugEvent),
						eventId: requestedSlugEvent?.id || null,
						ownerUserId: requestedSlugEvent?.ownerUserId || null,
						title: requestedSlugEvent?.title || null,
					}
				: null,
		},
	};
}

export async function updateEventAdmin(input: {
	eventId: string;
	title?: string;
	slug?: string;
	eventType?: EventRecord['eventType'];
	status?: EventRecord['status'];
	expectedUpdatedAt?: string;
	actorUserId: string;
}): Promise<EventRecord> {
	const eventId = sanitize(input.eventId, 120);
	if (!eventId) throw new ApiError(400, 'bad_request', 'eventId is required.');

	const existing = await findEventByIdService(eventId);
	if (!existing) throw new ApiError(404, 'not_found', 'Event not found.');

	const slug = input.slug !== undefined ? sanitize(input.slug, 120) : undefined;
	// A linked event must keep the invitation's slug and type: the public RSVP resolves the event
	// by `/{eventType}/{slug}` and publication rejects a type mismatch.
	if (
		existing.invitationId &&
		((slug !== undefined && slug !== existing.slug) ||
			(input.eventType !== undefined && input.eventType !== existing.eventType))
	) {
		throw new ApiError(
			409,
			'conflict',
			'El slug y el tipo de un evento vinculado a una invitación se cambian desde la invitación.',
		);
	}

	let event: EventRecord;
	try {
		event = await updateEventService({
			eventId,
			title: input.title !== undefined ? sanitize(input.title, 140) : undefined,
			slug,
			eventType: input.eventType,
			status: input.status,
			expectedUpdatedAt: input.expectedUpdatedAt,
		});
	} catch (error) {
		if (error instanceof SupabaseHttpError && error.code === UNIQUE_VIOLATION) {
			throw new ApiError(409, 'conflict', 'Ya existe otro evento con ese slug.');
		}
		throw error;
	}

	await logAdminAction({
		actorId: input.actorUserId,
		action: 'update_event',
		targetTable: 'events',
		targetId: event.id,
		oldData: existing as unknown as Record<string, unknown>,
		newData: event as unknown as Record<string, unknown>,
	});

	return event;
}

export async function listHostEvents(input: {
	hostUserId: string;
	hostAccessToken: string;
	isSuperAdmin?: boolean;
}): Promise<EventRecord[]> {
	const result = await listHostEventsWithDebug(input);
	return result.events;
}

export async function listHostEventsWithDebug(input: {
	hostUserId: string;
	hostAccessToken: string;
	requestedSlug?: string;
	isSuperAdmin?: boolean;
}): Promise<{ events: EventRecord[]; debug: DashboardEventListDebug }> {
	const requestedSlug = sanitize(input.requestedSlug || '', 120);

	if (input.isSuperAdmin) {
		return listAllEventsForSuperAdmin({
			hostUserId: input.hostUserId,
			requestedSlug,
		});
	}

	const [ownerEvents, visibleEvents, memberships, requestedSlugEvent] = await Promise.all([
		findEventsByOwner(input.hostUserId, input.hostAccessToken),
		findEventsForHost(input.hostAccessToken),
		listMembershipsForHost(input.hostAccessToken),
		requestedSlug ? findEventBySlugService(requestedSlug) : Promise.resolve(null),
	]);

	const eventsById = new Map<string, EventRecord>();
	for (const event of [...ownerEvents, ...visibleEvents]) {
		eventsById.set(event.id, event);
	}

	const membershipResolvedEvents: EventRecord[] = [];
	const unresolvedMembershipEventIds: string[] = [];
	for (const membership of memberships) {
		if (eventsById.has(membership.eventId)) continue;

		const membershipEvent =
			(await findEventById(membership.eventId, input.hostAccessToken)) ??
			(await findEventByIdService(membership.eventId));

		if (membershipEvent) {
			eventsById.set(membershipEvent.id, membershipEvent);
			membershipResolvedEvents.push(membershipEvent);
		} else {
			unresolvedMembershipEventIds.push(membership.eventId);
		}
	}

	const events = [...eventsById.values()].sort(
		(left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
	);
	return {
		events,
		debug: {
			session: {
				hasAccessToken: true,
				tokenSource: 'cookie',
				reason: 'session_role_resolved',
				userId: input.hostUserId,
				email: null,
				role: null,
				isSuperAdmin: false,
			},
			ownerEvents: ownerEvents.map(toDashboardEventItem),
			visibleEvents: visibleEvents.map(toDashboardEventItem),
			memberships: memberships.map((membership) => ({
				id: membership.id,
				eventId: membership.eventId,
				userId: membership.userId,
				membershipRole: membership.membershipRole,
			})),
			membershipResolvedEvents: membershipResolvedEvents.map(toDashboardEventItem),
			unresolvedMembershipEventIds,
			requestedSlugCheck: requestedSlug
				? {
						requestedSlug,
						slugExistsInDb: Boolean(requestedSlugEvent),
						eventId: requestedSlugEvent?.id || null,
						ownerUserId: requestedSlugEvent?.ownerUserId || null,
						title: requestedSlugEvent?.title || null,
					}
				: null,
		},
	};
}
