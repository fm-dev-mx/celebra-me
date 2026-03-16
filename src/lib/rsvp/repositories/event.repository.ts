import { supabaseRestRequest } from '@/lib/rsvp/supabase';
import type { EventRecord } from '@/lib/rsvp/types';
import {
	EVENT_COLUMNS,
	EVENT_MUTATION_COLUMNS,
	type EventRow,
	toEventRecord,
} from '@/lib/rsvp/repositories/shared/rows';

export async function findEventsByOwner(
	ownerUserId: string,
	hostAccessToken: string,
): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=${EVENT_COLUMNS}&owner_user_id=eq.${encodeURIComponent(ownerUserId)}&order=created_at.desc`,
		authToken: hostAccessToken,
	});
	return rows.map(toEventRecord);
}

export async function findEventsForHost(hostAccessToken: string): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=${EVENT_COLUMNS}&order=created_at.desc`,
		authToken: hostAccessToken,
	});
	return rows.map(toEventRecord);
}

export async function findEventById(
	eventId: string,
	hostAccessToken: string,
): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=${EVENT_COLUMNS}&id=eq.${encodeURIComponent(eventId)}&limit=1`,
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

export async function findEventByInvitationPublic(eventId: string): Promise<EventRecord | null> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=*&id=eq.${encodeURIComponent(eventId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toEventRecord(rows[0]) : null;
}

export async function listAllEventsService(): Promise<EventRecord[]> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: 'events?select=*&order=created_at.desc',
		useServiceRole: true,
	});
	return rows.map(toEventRecord);
}

export async function createEventService(input: {
	ownerUserId: string;
	slug: string;
	eventType: EventRecord['eventType'];
	title: string;
	status?: EventRecord['status'];
}): Promise<EventRecord> {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?select=${EVENT_MUTATION_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			owner_user_id: input.ownerUserId,
			slug: input.slug,
			event_type: input.eventType,
			title: input.title,
			status: input.status || 'draft',
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear evento.');
	return toEventRecord(rows[0]);
}

export async function updateEventService(input: {
	eventId: string;
	title?: string;
	slug?: string;
	eventType?: EventRecord['eventType'];
	status?: EventRecord['status'];
}): Promise<EventRecord> {
	const body: Record<string, unknown> = {};
	if (input.title !== undefined) body.title = input.title;
	if (input.slug !== undefined) body.slug = input.slug;
	if (input.eventType !== undefined) body.event_type = input.eventType;
	if (input.status !== undefined) body.status = input.status;

	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?id=eq.${encodeURIComponent(input.eventId)}&select=*`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0]) throw new Error('Evento no encontrado.');
	return toEventRecord(rows[0]);
}
