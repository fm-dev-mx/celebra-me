import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getEnv } from '@/utils/env';

export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type RsvpSource = 'personalized_link' | 'generic_link' | 'admin';
export type ChannelType = 'whatsapp';
export type ChannelAction = 'cta_rendered' | 'clicked';

interface GuestEntry {
	guestId: string;
	displayName: string;
	maxAllowedAttendees: number;
}

interface EventRsvpConfig {
	guestCap: number;
	guests: GuestEntry[];
}

type EventEntry = CollectionEntry<'events'>;

export interface RsvpContextResult {
	eventSlug: string;
	mode: 'personalized' | 'generic';
	tokenValid: boolean;
	invalidTokenMessage?: string;
	guest?: {
		guestId: string;
		displayName: string;
		maxAllowedAttendees: number;
	};
	currentResponse?: {
		rsvpId: string;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		updatedAt: string;
	};
}

export interface RsvpRecord {
	rsvpId: string;
	eventSlug: string;
	guestId: string | null;
	guestNameEntered: string;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	notes: string;
	dietary: string;
	source: RsvpSource;
	createdAt: string;
	lastUpdatedAt: string;
	normalizedGuestName: string;
	isPotentialDuplicate: boolean;
}

interface RsvpAuditRecord {
	auditId: string;
	rsvpId: string;
	previousStatus: AttendanceStatus | null;
	newStatus: AttendanceStatus;
	previousAttendeeCount: number | null;
	newAttendeeCount: number;
	changedBy: 'guest' | 'admin' | 'system';
	changedAt: string;
}

interface RsvpChannelRecord {
	channelEventId: string;
	rsvpId: string;
	channel: ChannelType;
	action: ChannelAction;
	occurredAt: string;
}

interface RsvpStoreState {
	recordsByKey: Map<string, RsvpRecord>;
	recordsById: Map<string, RsvpRecord>;
	auditLog: RsvpAuditRecord[];
	channelLog: RsvpChannelRecord[];
}

interface GuestTokenPayload {
	eventSlug: string;
	guestId: string;
	exp?: number;
}

interface ResolveTokenResult {
	isValid: boolean;
	payload?: GuestTokenPayload;
}

interface SaveRsvpInput {
	eventSlug: string;
	token?: string;
	guestName?: string;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	notes?: string;
	dietary?: string;
}

export interface SaveRsvpResult {
	rsvp: RsvpRecord;
	contextMode: 'personalized' | 'generic';
}

export interface AdminListResult {
	items: Array<
		RsvpRecord & {
			lastChannelEvent?: RsvpChannelRecord;
		}
	>;
	totals: {
		total: number;
		pending: number;
		confirmed: number;
		declined: number;
	};
}

const MAX_FIELD_LENGTH = 200;
const MAX_ATTENDEES_ABSOLUTE = 20;
const RSVP_TOKEN_SECRET = getEnv('RSVP_TOKEN_SECRET') || 'dev-rsvp-secret-change-me';

function sanitizeString(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLength);
}

function normalizeName(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function uuidLike(prefix: string): string {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function getState(): RsvpStoreState {
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

function base64UrlEncode(value: string): string {
	return Buffer.from(value, 'utf8')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
	try {
		const padded = value.replace(/-/g, '+').replace(/_/g, '/');
		const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=');
		return Buffer.from(normalized, 'base64').toString('utf8');
	} catch {
		return null;
	}
}

function signPayload(encodedPayload: string): string {
	return createHmac('sha256', RSVP_TOKEN_SECRET).update(encodedPayload).digest('base64url');
}

function verifySignature(expected: string, received: string): boolean {
	try {
		const expectedBuffer = Buffer.from(expected);
		const receivedBuffer = Buffer.from(received);
		if (expectedBuffer.length !== receivedBuffer.length) return false;
		return timingSafeEqual(expectedBuffer, receivedBuffer);
	} catch {
		return false;
	}
}

export function createGuestToken(payload: GuestTokenPayload): string {
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signature = signPayload(encodedPayload);
	return `${encodedPayload}.${signature}`;
}

function resolveGuestToken(token: string): ResolveTokenResult {
	const [encodedPayload, signature] = token.split('.');
	if (!encodedPayload || !signature) return { isValid: false };

	const expectedSignature = signPayload(encodedPayload);
	if (!verifySignature(expectedSignature, signature)) return { isValid: false };

	const rawPayload = base64UrlDecode(encodedPayload);
	if (!rawPayload) return { isValid: false };

	try {
		const parsed = JSON.parse(rawPayload) as GuestTokenPayload;
		if (!parsed.eventSlug || !parsed.guestId) return { isValid: false };
		if (parsed.exp && Date.now() > parsed.exp * 1000) return { isValid: false };
		return { isValid: true, payload: parsed };
	} catch {
		return { isValid: false };
	}
}

async function getEventBySlug(eventSlug: string): Promise<EventEntry | null> {
	const events = (await getCollection('events')) as EventEntry[];
	return events.find((entry) => entry.id === eventSlug) ?? null;
}

function getEventRsvpConfig(event: EventEntry): EventRsvpConfig {
	const guestCap = Math.max(1, event.data.rsvp?.guestCap ?? 1);
	const rawGuests = (event.data.rsvp?.guests ?? []) as GuestEntry[];
	const guests: GuestEntry[] = rawGuests.map((guest: GuestEntry) => ({
		guestId: sanitizeString(guest.guestId, 80),
		displayName: sanitizeString(guest.displayName, 120),
		maxAllowedAttendees: Math.max(
			1,
			Math.min(guest.maxAllowedAttendees, MAX_ATTENDEES_ABSOLUTE),
		),
	}));

	return { guestCap, guests };
}

function parseAttendanceStatus(rawValue: string): AttendanceStatus | null {
	switch (rawValue) {
		case 'pending':
			return 'pending';
		case 'confirmed':
		case 'yes':
			return 'confirmed';
		case 'declined':
		case 'no':
			return 'declined';
		default:
			return null;
	}
}

function buildStoreKey(
	eventSlug: string,
	guestId: string | null,
	normalizedGuestName: string,
): string {
	if (guestId) return `${eventSlug}::guest::${guestId}`;
	return `${eventSlug}::generic::${normalizedGuestName}`;
}

function markPotentialDuplicate(
	state: RsvpStoreState,
	eventSlug: string,
	normalizedGuestName: string,
	currentRecordId: string | null,
): boolean {
	for (const record of state.recordsById.values()) {
		if (record.eventSlug !== eventSlug) continue;
		if (record.guestId !== null) continue;
		if (record.normalizedGuestName !== normalizedGuestName) continue;
		if (currentRecordId && record.rsvpId === currentRecordId) continue;
		return true;
	}
	return false;
}

export async function getRsvpContext(
	eventSlug: string,
	token?: string,
): Promise<RsvpContextResult> {
	const safeEventSlug = sanitizeString(eventSlug, 120);
	const event = await getEventBySlug(safeEventSlug);
	if (!event) {
		return {
			eventSlug: safeEventSlug,
			mode: 'generic',
			tokenValid: false,
			invalidTokenMessage: 'Evento no encontrado.',
		};
	}

	const { guests } = getEventRsvpConfig(event);
	if (!token) {
		return { eventSlug: safeEventSlug, mode: 'generic', tokenValid: false };
	}

	const tokenResult = resolveGuestToken(token);
	if (!tokenResult.isValid || !tokenResult.payload) {
		return {
			eventSlug: safeEventSlug,
			mode: 'generic',
			tokenValid: false,
			invalidTokenMessage:
				'No pudimos validar tu enlace personalizado. Puedes confirmar manualmente.',
		};
	}

	if (tokenResult.payload.eventSlug !== safeEventSlug) {
		return {
			eventSlug: safeEventSlug,
			mode: 'generic',
			tokenValid: false,
			invalidTokenMessage: 'El enlace no corresponde con este evento.',
		};
	}

	const guest = guests.find((entry) => entry.guestId === tokenResult.payload?.guestId);
	if (!guest) {
		return {
			eventSlug: safeEventSlug,
			mode: 'generic',
			tokenValid: false,
			invalidTokenMessage: 'Tu enlace ya no es válido. Puedes confirmar manualmente.',
		};
	}

	const state = getState();
	const existingKey = buildStoreKey(
		safeEventSlug,
		guest.guestId,
		normalizeName(guest.displayName),
	);
	const existing = state.recordsByKey.get(existingKey);

	return {
		eventSlug: safeEventSlug,
		mode: 'personalized',
		tokenValid: true,
		guest: {
			guestId: guest.guestId,
			displayName: guest.displayName,
			maxAllowedAttendees: guest.maxAllowedAttendees,
		},
		currentResponse: existing
			? {
					rsvpId: existing.rsvpId,
					attendanceStatus: existing.attendanceStatus,
					attendeeCount: existing.attendeeCount,
					updatedAt: existing.lastUpdatedAt,
				}
			: undefined,
	};
}

export async function saveRsvp(input: SaveRsvpInput): Promise<SaveRsvpResult> {
	const eventSlug = sanitizeString(input.eventSlug, 120);
	const event = await getEventBySlug(eventSlug);
	if (!event) {
		throw new Error('Evento no encontrado.');
	}

	const { guestCap } = getEventRsvpConfig(event);
	let source: RsvpSource = 'generic_link';
	let guestId: string | null = null;
	let resolvedName = sanitizeString(input.guestName);
	let maxAllowedAttendees = Math.min(guestCap, MAX_ATTENDEES_ABSOLUTE);
	let contextMode: 'personalized' | 'generic' = 'generic';

	const rawToken = sanitizeString(input.token, 2000);
	if (rawToken) {
		const context = await getRsvpContext(eventSlug, rawToken);
		if (context.mode === 'personalized' && context.tokenValid && context.guest) {
			source = 'personalized_link';
			guestId = context.guest.guestId;
			resolvedName = context.guest.displayName;
			maxAllowedAttendees = Math.min(context.guest.maxAllowedAttendees, guestCap);
			contextMode = 'personalized';
		}
	}

	if (!resolvedName) {
		throw new Error('El nombre es obligatorio.');
	}

	const attendanceStatus = input.attendanceStatus;
	if (!['confirmed', 'declined', 'pending'].includes(attendanceStatus)) {
		throw new Error('El estado de asistencia es inválido.');
	}

	const boundedInputCount = Math.max(0, Math.min(input.attendeeCount, MAX_ATTENDEES_ABSOLUTE));
	const attendeeCount = attendanceStatus === 'declined' ? 0 : boundedInputCount;

	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new Error('Para confirmar asistencia, el total de asistentes debe ser al menos 1.');
	}

	if (attendeeCount > maxAllowedAttendees) {
		throw new Error(`El límite de asistentes para este enlace es ${maxAllowedAttendees}.`);
	}

	const notes = sanitizeString(input.notes);
	const dietary = sanitizeString(input.dietary);
	const normalizedGuestName = normalizeName(resolvedName);
	const state = getState();
	const storeKey = buildStoreKey(eventSlug, guestId, normalizedGuestName);
	const now = new Date().toISOString();
	const existing = state.recordsByKey.get(storeKey);

	const updatedRecord: RsvpRecord = {
		rsvpId: existing?.rsvpId ?? uuidLike('rsvp'),
		eventSlug,
		guestId,
		guestNameEntered: resolvedName,
		attendanceStatus,
		attendeeCount,
		notes,
		dietary,
		source,
		createdAt: existing?.createdAt ?? now,
		lastUpdatedAt: now,
		normalizedGuestName,
		isPotentialDuplicate: markPotentialDuplicate(
			state,
			eventSlug,
			normalizedGuestName,
			existing?.rsvpId ?? null,
		),
	};

	state.recordsByKey.set(storeKey, updatedRecord);
	state.recordsById.set(updatedRecord.rsvpId, updatedRecord);

	state.auditLog.push({
		auditId: uuidLike('audit'),
		rsvpId: updatedRecord.rsvpId,
		previousStatus: existing?.attendanceStatus ?? null,
		newStatus: updatedRecord.attendanceStatus,
		previousAttendeeCount: existing?.attendeeCount ?? null,
		newAttendeeCount: updatedRecord.attendeeCount,
		changedBy: 'guest',
		changedAt: now,
	});

	return { rsvp: updatedRecord, contextMode };
}

export async function logRsvpChannelEvent(input: {
	rsvpId: string;
	channel: ChannelType;
	action: ChannelAction;
}): Promise<void> {
	const state = getState();
	const safeRsvpId = sanitizeString(input.rsvpId, 120);
	const rsvp = state.recordsById.get(safeRsvpId);
	if (!rsvp) {
		throw new Error('RSVP no encontrado.');
	}

	state.channelLog.push({
		channelEventId: uuidLike('channel'),
		rsvpId: safeRsvpId,
		channel: input.channel,
		action: input.action,
		occurredAt: new Date().toISOString(),
	});
}

export async function getAdminRsvpList(params: {
	eventSlug: string;
	status?: AttendanceStatus | 'all';
	search?: string;
}): Promise<AdminListResult> {
	const state = getState();
	const safeEventSlug = sanitizeString(params.eventSlug, 120);
	const safeSearch = normalizeName(sanitizeString(params.search, 120));
	const safeStatus = params.status ?? 'all';

	const channelByRsvp = new Map<string, RsvpChannelRecord>();
	for (const channelEvent of state.channelLog) {
		const existing = channelByRsvp.get(channelEvent.rsvpId);
		if (!existing || existing.occurredAt < channelEvent.occurredAt) {
			channelByRsvp.set(channelEvent.rsvpId, channelEvent);
		}
	}

	const items = Array.from(state.recordsById.values())
		.filter((item) => item.eventSlug === safeEventSlug)
		.filter((item) => (safeStatus === 'all' ? true : item.attendanceStatus === safeStatus))
		.filter((item) => (safeSearch ? item.normalizedGuestName.includes(safeSearch) : true))
		.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
		.map((item) => ({
			...item,
			lastChannelEvent: channelByRsvp.get(item.rsvpId),
		}));

	const totals = {
		total: items.length,
		pending: items.filter((item) => item.attendanceStatus === 'pending').length,
		confirmed: items.filter((item) => item.attendanceStatus === 'confirmed').length,
		declined: items.filter((item) => item.attendanceStatus === 'declined').length,
	};

	return { items, totals };
}

export async function getAdminRsvpCsv(eventSlug: string): Promise<string> {
	const { items } = await getAdminRsvpList({ eventSlug, status: 'all' });
	const header = [
		'rsvp_id',
		'event_slug',
		'name',
		'source',
		'status',
		'attendee_count',
		'possible_duplicate',
		'created_at',
		'updated_at',
		'last_channel_action',
		'last_channel_at',
	];

	const rows = items.map((item) => {
		const values = [
			item.rsvpId,
			item.eventSlug,
			item.guestNameEntered,
			item.source,
			item.attendanceStatus,
			String(item.attendeeCount),
			item.isPotentialDuplicate ? 'true' : 'false',
			item.createdAt,
			item.lastUpdatedAt,
			item.lastChannelEvent?.action ?? '',
			item.lastChannelEvent?.occurredAt ?? '',
		];

		return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',');
	});

	return [header.join(','), ...rows].join('\n');
}

export function parseAttendanceInput(rawAttendance: unknown): AttendanceStatus | null {
	return parseAttendanceStatus(sanitizeString(rawAttendance));
}
