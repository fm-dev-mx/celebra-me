import {
	createEventService,
	findEventById,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import {
	findEventByIdService,
	findEventsByOwner,
	listAllEventsService,
	findEventsForHost,
} from '@/lib/rsvp/repositories/event.repository';
import { listMembershipsForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import type { AdminEventListItemDTO } from '@/interfaces/dashboard/admin.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import { sanitize } from '@/lib/rsvp/core/utils';

function toAdminEventDto(event: EventRecord): AdminEventListItemDTO {
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

export async function listAdminEvents(): Promise<AdminEventListItemDTO[]> {
	const events = await listAllEventsService();
	return events.map(toAdminEventDto);
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
		throw new ApiError(400, 'bad_request', 'title, slug, and eventType are required.');
	}

	if (!['xv', 'boda', 'bautizo', 'cumple'].includes(eventType)) {
		throw new ApiError(
			400,
			'bad_request',
			'eventType must be one of: xv, boda, bautizo, cumple',
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

	return toAdminEventDto(event);
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
	if (!eventId) throw new ApiError(400, 'bad_request', 'eventId is required.');

	const existing = await findEventByIdService(eventId);
	if (!existing) throw new ApiError(404, 'not_found', 'Event not found.');

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

	return toAdminEventDto(event);
}

export async function listHostEvents(input: {
	hostUserId: string;
	hostAccessToken: string;
}): Promise<EventRecord[]> {
	const [ownerEvents, visibleEvents, memberships] = await Promise.all([
		findEventsByOwner(input.hostUserId, input.hostAccessToken),
		findEventsForHost(input.hostAccessToken),
		listMembershipsForHost(input.hostAccessToken),
	]);

	const eventsById = new Map<string, EventRecord>();
	for (const event of [...ownerEvents, ...visibleEvents]) {
		eventsById.set(event.id, event);
	}

	for (const membership of memberships) {
		if (eventsById.has(membership.eventId)) continue;

		const membershipEvent =
			(await findEventById(membership.eventId, input.hostAccessToken)) ??
			(await findEventByIdService(membership.eventId));

		if (membershipEvent) {
			eventsById.set(membershipEvent.id, membershipEvent);
		}
	}

	return [...eventsById.values()].sort(
		(left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
	);
}
