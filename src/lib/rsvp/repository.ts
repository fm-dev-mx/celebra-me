import { getEnv } from '@/utils/env';
import type { AttendanceStatus, RsvpAuditRecord, RsvpChannelRecord, RsvpRecord } from './types';

interface ListParams {
	eventSlug: string;
	status?: AttendanceStatus | 'all';
	search?: string;
}

interface SaveInput {
	storeKey: string;
	record: RsvpRecord;
}

export interface RsvpRepository {
	getRsvpByStoreKey(storeKey: string): Promise<RsvpRecord | null>;
	getRsvpById(rsvpId: string): Promise<RsvpRecord | null>;
	saveRsvpRecord(input: SaveInput): Promise<RsvpRecord>;
	listRsvpByEvent(params: ListParams): Promise<RsvpRecord[]>;
	appendAuditEvent(event: RsvpAuditRecord): Promise<void>;
	appendChannelEvent(event: RsvpChannelRecord): Promise<void>;
	listChannelEventsByRsvpIds(rsvpIds: string[]): Promise<RsvpChannelRecord[]>;
	getLastChannelEventByRsvpId(rsvpId: string): Promise<RsvpChannelRecord | undefined>;
}

interface RsvpStoreState {
	recordsByKey: Map<string, RsvpRecord>;
	recordsById: Map<string, RsvpRecord>;
	auditLog: RsvpAuditRecord[];
	channelLog: RsvpChannelRecord[];
}

function getMemoryState(): RsvpStoreState {
	const key = '__celebra_rsvp_state__';
	const globalRef = globalThis as typeof globalThis & { [k: string]: unknown };
	const existing = globalRef[key] as RsvpStoreState | undefined;
	if (existing) return existing;

	const created: RsvpStoreState = {
		recordsByKey: new Map<string, RsvpRecord>(),
		recordsById: new Map<string, RsvpRecord>(),
		auditLog: [],
		channelLog: [],
	};
	globalRef[key] = created;
	return created;
}

class MemoryRsvpRepository implements RsvpRepository {
	async getRsvpByStoreKey(storeKey: string): Promise<RsvpRecord | null> {
		return getMemoryState().recordsByKey.get(storeKey) ?? null;
	}

	async getRsvpById(rsvpId: string): Promise<RsvpRecord | null> {
		return getMemoryState().recordsById.get(rsvpId) ?? null;
	}

	async saveRsvpRecord(input: SaveInput): Promise<RsvpRecord> {
		const state = getMemoryState();
		state.recordsByKey.set(input.storeKey, input.record);
		state.recordsById.set(input.record.rsvpId, input.record);
		return input.record;
	}

	async listRsvpByEvent(params: ListParams): Promise<RsvpRecord[]> {
		const safeStatus = params.status ?? 'all';
		const safeSearch = params.search ?? '';

		return Array.from(getMemoryState().recordsById.values())
			.filter((item) => item.eventSlug === params.eventSlug)
			.filter((item) => (safeStatus === 'all' ? true : item.attendanceStatus === safeStatus))
			.filter((item) => (safeSearch ? item.normalizedGuestName.includes(safeSearch) : true))
			.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
	}

	async appendAuditEvent(event: RsvpAuditRecord): Promise<void> {
		getMemoryState().auditLog.push(event);
	}

	async appendChannelEvent(event: RsvpChannelRecord): Promise<void> {
		getMemoryState().channelLog.push(event);
	}

	async listChannelEventsByRsvpIds(rsvpIds: string[]): Promise<RsvpChannelRecord[]> {
		if (rsvpIds.length === 0) return [];
		const allowed = new Set(rsvpIds);
		return getMemoryState().channelLog.filter((item) => allowed.has(item.rsvpId));
	}

	async getLastChannelEventByRsvpId(rsvpId: string): Promise<RsvpChannelRecord | undefined> {
		const events = getMemoryState()
			.channelLog.filter((item) => item.rsvpId === rsvpId)
			.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
		return events[0];
	}
}

type SupabaseMethod = 'GET' | 'POST';

class SupabaseRsvpRepository implements RsvpRepository {
	private readonly baseUrl: string;
	private readonly serviceRoleKey: string;

	constructor(baseUrl: string, serviceRoleKey: string) {
		this.baseUrl = `${baseUrl.replace(/\/+$/, '')}/rest/v1`;
		this.serviceRoleKey = serviceRoleKey;
	}

	private async request<T>(
		pathWithQuery: string,
		method: SupabaseMethod,
		body?: unknown,
		prefer?: string,
	): Promise<T> {
		const response = await fetch(`${this.baseUrl}/${pathWithQuery}`, {
			method,
			headers: {
				apikey: this.serviceRoleKey,
				Authorization: `Bearer ${this.serviceRoleKey}`,
				'Content-Type': 'application/json',
				...(prefer ? { Prefer: prefer } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const raw = await response.text();
			throw new Error(
				`Supabase RSVP error (${response.status}): ${raw || response.statusText}`,
			);
		}

		if (response.status === 204) {
			return [] as T;
		}

		return (await response.json()) as T;
	}

	async getRsvpByStoreKey(storeKey: string): Promise<RsvpRecord | null> {
		const rows = await this.request<SupabaseRsvpRow[]>(
			`rsvp_records?select=*&store_key=eq.${encodeURIComponent(storeKey)}&limit=1`,
			'GET',
		);
		return rows[0] ? mapRowToRecord(rows[0]) : null;
	}

	async getRsvpById(rsvpId: string): Promise<RsvpRecord | null> {
		const rows = await this.request<SupabaseRsvpRow[]>(
			`rsvp_records?select=*&rsvp_id=eq.${encodeURIComponent(rsvpId)}&limit=1`,
			'GET',
		);
		return rows[0] ? mapRowToRecord(rows[0]) : null;
	}

	async saveRsvpRecord(input: SaveInput): Promise<RsvpRecord> {
		const payload = {
			...mapRecordToRow(input.record),
			store_key: input.storeKey,
		};
		const rows = await this.request<SupabaseRsvpRow[]>(
			'rsvp_records?on_conflict=store_key',
			'POST',
			payload,
			'resolution=merge-duplicates,return=representation',
		);
		if (!rows[0]) {
			throw new Error('No se pudo guardar RSVP en persistencia durable.');
		}
		return mapRowToRecord(rows[0]);
	}

	async listRsvpByEvent(params: ListParams): Promise<RsvpRecord[]> {
		const pieces = [`select=*`, `event_slug=eq.${encodeURIComponent(params.eventSlug)}`];
		if (params.status && params.status !== 'all') {
			pieces.push(`attendance_status=eq.${encodeURIComponent(params.status)}`);
		}
		if (params.search) {
			pieces.push(`normalized_guest_name=ilike.*${encodeURIComponent(params.search)}*`);
		}
		pieces.push('order=last_updated_at.desc');

		const rows = await this.request<SupabaseRsvpRow[]>(
			`rsvp_records?${pieces.join('&')}`,
			'GET',
		);
		return rows.map(mapRowToRecord);
	}

	async appendAuditEvent(event: RsvpAuditRecord): Promise<void> {
		await this.request<SupabaseAuditRow[]>(
			'rsvp_audit_log',
			'POST',
			mapAuditToRow(event),
			'return=minimal',
		);
	}

	async appendChannelEvent(event: RsvpChannelRecord): Promise<void> {
		await this.request<SupabaseChannelRow[]>(
			'rsvp_channel_log',
			'POST',
			mapChannelToRow(event),
			'return=minimal',
		);
	}

	async listChannelEventsByRsvpIds(rsvpIds: string[]): Promise<RsvpChannelRecord[]> {
		if (rsvpIds.length === 0) return [];
		const quoted = rsvpIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
		const rows = await this.request<SupabaseChannelRow[]>(
			`rsvp_channel_log?select=*&rsvp_id=in.(${quoted})&order=occurred_at.desc`,
			'GET',
		);
		return rows.map(mapRowToChannel);
	}

	async getLastChannelEventByRsvpId(rsvpId: string): Promise<RsvpChannelRecord | undefined> {
		const rows = await this.request<SupabaseChannelRow[]>(
			`rsvp_channel_log?select=*&rsvp_id=eq.${encodeURIComponent(rsvpId)}&order=occurred_at.desc&limit=1`,
			'GET',
		);
		return rows[0] ? mapRowToChannel(rows[0]) : undefined;
	}
}

type SupabaseRsvpRow = {
	rsvp_id: string;
	event_slug: string;
	guest_id: string | null;
	guest_name_entered: string;
	attendance_status: AttendanceStatus;
	attendee_count: number;
	notes: string;
	dietary: string;
	source: string;
	created_at: string;
	last_updated_at: string;
	normalized_guest_name: string;
	is_potential_duplicate: boolean;
};

type SupabaseAuditRow = {
	audit_id: string;
	rsvp_id: string;
	previous_status: AttendanceStatus | null;
	new_status: AttendanceStatus;
	previous_attendee_count: number | null;
	new_attendee_count: number;
	changed_by: 'guest' | 'admin' | 'system';
	changed_at: string;
};

type SupabaseChannelRow = {
	channel_event_id: string;
	rsvp_id: string;
	channel: 'whatsapp';
	action: 'cta_rendered' | 'clicked';
	occurred_at: string;
};

function mapRecordToRow(record: RsvpRecord): SupabaseRsvpRow {
	return {
		rsvp_id: record.rsvpId,
		event_slug: record.eventSlug,
		guest_id: record.guestId,
		guest_name_entered: record.guestNameEntered,
		attendance_status: record.attendanceStatus,
		attendee_count: record.attendeeCount,
		notes: record.notes,
		dietary: record.dietary,
		source: record.source,
		created_at: record.createdAt,
		last_updated_at: record.lastUpdatedAt,
		normalized_guest_name: record.normalizedGuestName,
		is_potential_duplicate: record.isPotentialDuplicate,
	};
}

function mapRowToRecord(row: SupabaseRsvpRow): RsvpRecord {
	return {
		rsvpId: row.rsvp_id,
		eventSlug: row.event_slug,
		guestId: row.guest_id,
		guestNameEntered: row.guest_name_entered,
		attendanceStatus: row.attendance_status,
		attendeeCount: row.attendee_count,
		notes: row.notes,
		dietary: row.dietary,
		source: row.source as RsvpRecord['source'],
		createdAt: row.created_at,
		lastUpdatedAt: row.last_updated_at,
		normalizedGuestName: row.normalized_guest_name,
		isPotentialDuplicate: row.is_potential_duplicate,
	};
}

function mapAuditToRow(record: RsvpAuditRecord): SupabaseAuditRow {
	return {
		audit_id: record.auditId,
		rsvp_id: record.rsvpId,
		previous_status: record.previousStatus,
		new_status: record.newStatus,
		previous_attendee_count: record.previousAttendeeCount,
		new_attendee_count: record.newAttendeeCount,
		changed_by: record.changedBy,
		changed_at: record.changedAt,
	};
}

function mapChannelToRow(record: RsvpChannelRecord): SupabaseChannelRow {
	return {
		channel_event_id: record.channelEventId,
		rsvp_id: record.rsvpId,
		channel: record.channel,
		action: record.action,
		occurred_at: record.occurredAt,
	};
}

function mapRowToChannel(row: SupabaseChannelRow): RsvpChannelRecord {
	return {
		channelEventId: row.channel_event_id,
		rsvpId: row.rsvp_id,
		channel: row.channel,
		action: row.action,
		occurredAt: row.occurred_at,
	};
}

let cachedRepository: RsvpRepository | null = null;

export function getRsvpRepository(): RsvpRepository {
	if (cachedRepository) return cachedRepository;

	const supabaseUrl = getEnv('SUPABASE_URL');
	const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
	if (supabaseUrl && supabaseServiceRoleKey) {
		cachedRepository = new SupabaseRsvpRepository(supabaseUrl, supabaseServiceRoleKey);
		return cachedRepository;
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'Persistencia RSVP no configurada para producción. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
		);
	}

	cachedRepository = new MemoryRsvpRepository();
	return cachedRepository;
}

export function resetRsvpRepositoryForTests(): void {
	cachedRepository = null;
}

export function clearRsvpMemoryStoreForTests(): void {
	const key = '__celebra_rsvp_state__';
	const globalRef = globalThis as typeof globalThis & { [k: string]: unknown };
	delete globalRef[key];
}
