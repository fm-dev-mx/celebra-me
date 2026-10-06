/**
 * `event_memory_settings` access. The only module that knows this table's name
 * and columns; every read joins the parent event so callers get slug and title.
 */

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import type { MemoriesEntitlement, MemoriesSpaceLimits } from '@/lib/memories/contract/limits';

const TABLE = 'event_memory_settings';
/** Events are soft-deleted; `deleted_at` on the embed keeps archived events out. */
const EVENT_EMBED = 'event:events!inner(slug,title,deleted_at)';
const SELECT =
	`event_id,public_slug,enabled,time_zone,upload_starts_at,upload_ends_at,retention_ends_at,` +
	`max_event_objects,max_event_bytes,max_session_files,max_session_videos,max_session_bytes,` +
	`entitlement,expected_guests,admin_note,share_version,share_enabled_at,created_at,updated_at,${EVENT_EMBED}`;
const ACTIVE_EVENT_FILTER = 'event.deleted_at=is.null';

type SettingsRow = {
	event_id: string;
	public_slug: string;
	enabled: boolean;
	time_zone: string;
	upload_starts_at: string;
	upload_ends_at: string;
	retention_ends_at: string;
	max_event_objects: number;
	max_event_bytes: number;
	max_session_files: number;
	max_session_videos: number;
	max_session_bytes: number;
	entitlement: MemoriesEntitlement;
	expected_guests: number | null;
	admin_note: string | null;
	share_version: number | null;
	share_enabled_at: string | null;
	created_at: string;
	updated_at: string;
	event: { slug: string; title: string; deleted_at: string | null } | null;
};

function toRecord(row: SettingsRow): MemoriesSpaceRecord {
	return {
		eventId: row.event_id,
		eventSlug: row.event?.slug ?? '',
		eventTitle: row.event?.title ?? '',
		publicSlug: row.public_slug,
		enabled: row.enabled,
		timeZone: row.time_zone,
		uploadStartsAt: row.upload_starts_at,
		uploadEndsAt: row.upload_ends_at,
		retentionEndsAt: row.retention_ends_at,
		maxEventObjects: Number(row.max_event_objects),
		maxEventBytes: Number(row.max_event_bytes),
		maxSessionFiles: Number(row.max_session_files),
		maxSessionVideos: Number(row.max_session_videos),
		maxSessionBytes: Number(row.max_session_bytes),
		entitlement: row.entitlement,
		expectedGuests: row.expected_guests === null ? null : Number(row.expected_guests),
		adminNote: row.admin_note,
		shareVersion: Number(row.share_version ?? 0),
		shareEnabledAt: row.share_enabled_at ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function findMemorySpaceByPublicSlug(
	publicSlug: string,
): Promise<MemoriesSpaceRecord | null> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?select=${SELECT}&public_slug=eq.${encodeURIComponent(publicSlug)}&${ACTIVE_EVENT_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRecord(rows[0]) : null;
}

export async function findMemorySpaceByEventId(
	eventId: string,
): Promise<MemoriesSpaceRecord | null> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?select=${SELECT}&event_id=eq.${encodeURIComponent(eventId)}&${ACTIVE_EVENT_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRecord(rows[0]) : null;
}

export async function listMemorySpacesByEventIds(
	eventIds: readonly string[],
): Promise<MemoriesSpaceRecord[]> {
	if (eventIds.length === 0) return [];
	const encoded = eventIds.map((id) => encodeURIComponent(id)).join(',');
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?select=${SELECT}&event_id=in.(${encoded})&${ACTIVE_EVENT_FILTER}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toRecord);
}

export async function listAllMemorySpaces(): Promise<MemoriesSpaceRecord[]> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?select=${SELECT}&${ACTIVE_EVENT_FILTER}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toRecord);
}

export interface MemorySpaceInsert extends MemoriesSpaceLimits {
	eventId: string;
	publicSlug: string;
	enabled: boolean;
	timeZone: string;
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
	entitlement: MemoriesEntitlement;
	expectedGuests?: number | null;
	adminNote?: string | null;
	createdBy: string;
}

export type MemorySpaceUpdate = Partial<
	Omit<MemorySpaceInsert, 'eventId' | 'publicSlug' | 'createdBy'>
>;

function toColumns(input: MemorySpaceUpdate): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (input.enabled !== undefined) body.enabled = input.enabled;
	if (input.timeZone !== undefined) body.time_zone = input.timeZone;
	if (input.uploadStartsAt !== undefined) body.upload_starts_at = input.uploadStartsAt;
	if (input.uploadEndsAt !== undefined) body.upload_ends_at = input.uploadEndsAt;
	if (input.retentionEndsAt !== undefined) body.retention_ends_at = input.retentionEndsAt;
	if (input.maxEventObjects !== undefined) body.max_event_objects = input.maxEventObjects;
	if (input.maxEventBytes !== undefined) body.max_event_bytes = input.maxEventBytes;
	if (input.maxSessionFiles !== undefined) body.max_session_files = input.maxSessionFiles;
	if (input.maxSessionVideos !== undefined) body.max_session_videos = input.maxSessionVideos;
	if (input.maxSessionBytes !== undefined) body.max_session_bytes = input.maxSessionBytes;
	if (input.entitlement !== undefined) body.entitlement = input.entitlement;
	// `null` clears the stored value; `undefined` leaves it untouched.
	if (input.expectedGuests !== undefined) body.expected_guests = input.expectedGuests;
	if (input.adminNote !== undefined) body.admin_note = input.adminNote;
	return body;
}

export async function insertMemorySpace(input: MemorySpaceInsert): Promise<MemoriesSpaceRecord> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?select=${SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			...toColumns(input),
			event_id: input.eventId,
			public_slug: input.publicSlug,
			created_by: input.createdBy,
		},
	});
	if (!rows[0]) throw new Error('Failed to create memory space.');
	return toRecord(rows[0]);
}

export async function updateMemorySpace(
	eventId: string,
	input: MemorySpaceUpdate,
): Promise<MemoriesSpaceRecord | null> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?event_id=eq.${encodeURIComponent(eventId)}&select=${SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { ...toColumns(input), updated_at: new Date().toISOString() },
	});
	return rows[0] ? toRecord(rows[0]) : null;
}

/**
 * Turns the shared gallery on or off, or bumps its version to revoke the link.
 * `expectedVersion` makes a rotation a compare-and-swap, so two clicks revoke once.
 */
export async function updateMemorySpaceShare(
	eventId: string,
	input: { shareEnabledAt: string | null; shareVersion: number; expectedVersion: number },
): Promise<MemoriesSpaceRecord | null> {
	const rows = await supabaseRestRequest<SettingsRow[]>({
		pathWithQuery: `${TABLE}?event_id=eq.${encodeURIComponent(eventId)}&share_version=eq.${input.expectedVersion}&select=${SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			share_enabled_at: input.shareEnabledAt,
			share_version: input.shareVersion,
			updated_at: new Date().toISOString(),
		},
	});
	return rows[0] ? toRecord(rows[0]) : null;
}
