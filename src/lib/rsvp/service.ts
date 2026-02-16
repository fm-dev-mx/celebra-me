import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getEnv } from '@/utils/env';
import { getRsvpRepository } from './repository';
import { sanitize, normalizeName, toSafeAttendeeCount } from './shared-utils';
import {
	findGuestByInviteIdPublic,
	updateGuestByInviteIdPublic,
	findGuestByShortIdPublic,
	findGuestByEventAndNamePublic,
	findEventBySlugService,
	createGuestInvitationPublic,
} from '@/lib/rsvp-v2/repository';
import { publishGuestStreamEvent } from '@/lib/rsvp-v2/stream';
import { generateShortId } from '@/utils/ids';
import type {
	AttendanceStatus,
	ChannelAction,
	ChannelType,
	RsvpAuditRecord,
	RsvpChannelRecord,
	RsvpRecord,
	RsvpSource,
} from './types';

export type {
	AttendanceStatus,
	ChannelAction,
	ChannelType,
	RsvpAuditRecord,
	RsvpChannelRecord,
	RsvpRecord,
	RsvpSource,
} from './types';

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

export interface RsvpInvitationGuest {
	guestId: string;
	displayName: string;
	maxAllowedAttendees: number;
	token: string;
	personalizedUrl: string;
	waShareUrl: string;
}

export interface RsvpInvitationListResponse {
	eventSlug: string;
	eventType: string;
	baseInviteUrl: string;
	genericUrl: string;
	guests: RsvpInvitationGuest[];
	message?: string;
}

const MAX_ATTENDEES_ABSOLUTE = 20;

function getRsvpTokenSecret(): string {
	const configured = getEnv('RSVP_TOKEN_SECRET');
	if (!configured) {
		throw new Error(
			'RSVP_TOKEN_SECRET no está configurada. ' +
				'Por favor, configura esta variable de entorno. ' +
				'Genera un valor seguro con: openssl rand -base64 32',
		);
	}
	return configured;
}

function sanitizeBaseUrl(value: string): string {
	try {
		return new URL(value).origin;
	} catch {
		return 'http://localhost:4321';
	}
}

function uuidLike(prefix: string): string {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
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

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function signPayload(encodedPayload: string): string {
	return createHmac('sha256', getRsvpTokenSecret()).update(encodedPayload).digest('base64url');
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
		guestId: sanitize(guest.guestId, 80),
		displayName: sanitize(guest.displayName, 120),
		maxAllowedAttendees: toSafeAttendeeCount(guest.maxAllowedAttendees, MAX_ATTENDEES_ABSOLUTE),
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

async function markPotentialDuplicate(
	eventSlug: string,
	normalizedGuestName: string,
	currentRecordId: string | null,
): Promise<boolean> {
	const repository = getRsvpRepository();
	const records = await repository.listRsvpByEvent({ eventSlug, status: 'all' });
	for (const record of records) {
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
	const safeEventSlug = sanitize(eventSlug, 120);
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
		// FALLBACK: Try resolving as V2 inviteId (UUID) or shortId
		let v2Guest = null;
		if (isUuid(token)) {
			v2Guest = await findGuestByInviteIdPublic(token);
		} else if (token.length <= 12) {
			v2Guest = await findGuestByShortIdPublic(token);
		}

		if (v2Guest) {
			const repository = getRsvpRepository();
			const existingKey = buildStoreKey(
				safeEventSlug,
				v2Guest.inviteId,
				normalizeName(v2Guest.fullName),
			);
			const existing = await repository.getRsvpByStoreKey(existingKey);

			return {
				eventSlug: safeEventSlug,
				mode: 'personalized',
				tokenValid: true,
				guest: {
					guestId: v2Guest.inviteId,
					displayName: v2Guest.fullName,
					maxAllowedAttendees: v2Guest.maxAllowedAttendees,
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

	const repository = getRsvpRepository();
	const existingKey = buildStoreKey(
		safeEventSlug,
		guest.guestId,
		normalizeName(guest.displayName),
	);
	const existing = await repository.getRsvpByStoreKey(existingKey);

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
	const eventSlug = sanitize(input.eventSlug, 120);
	const event = await getEventBySlug(eventSlug);
	if (!event) {
		throw new Error('Evento no encontrado.');
	}

	const { guestCap } = getEventRsvpConfig(event);
	let source: RsvpSource = 'generic_link';
	let guestId: string | null = null;
	let resolvedName = sanitize(input.guestName);
	let maxAllowedAttendees = Math.min(guestCap, MAX_ATTENDEES_ABSOLUTE);
	let contextMode: 'personalized' | 'generic' = 'generic';

	const rawToken = sanitize(input.token, 2000);
	if (rawToken) {
		const context = await getRsvpContext(eventSlug, rawToken);
		if (context.mode === 'personalized' && context.tokenValid && context.guest) {
			source = 'personalized_link';
			guestId = context.guest.guestId;
			resolvedName = context.guest.displayName;
			maxAllowedAttendees = Math.min(context.guest.maxAllowedAttendees, guestCap);
			contextMode = 'personalized';
		} else {
			const { guests } = getEventRsvpConfig(event);
			const normalizedInputName = normalizeName(resolvedName);

			for (const guest of guests) {
				const normalizedGuestName = normalizeName(guest.displayName);
				if (normalizedGuestName === normalizedInputName) {
					// Found matching guest by name but no valid token => flag as manual_entry
					source = 'manual_entry';
					guestId = null;
					resolvedName = input.guestName ?? guest.displayName;
					maxAllowedAttendees = guestCap;
					break;
				}
			}

			// V2 DASHBOARD SYNC: If no guestId yet, try to find a V2 guest by name
			if (!guestId && resolvedName) {
				try {
					const v2Event = await findEventBySlugService(eventSlug);
					if (v2Event) {
						const v2Guest = await findGuestByEventAndNamePublic(
							v2Event.id,
							resolvedName,
						);
						if (v2Guest) {
							guestId = v2Guest.inviteId; // Use V2 inviteId for sync
							console.log(
								`[RSVP Sync] Found V2 guest by name match: ${resolvedName} (${guestId})`,
							);
						}
					}
				} catch (e) {
					console.error('[RSVP Sync] Failed to find v2 guest by name:', e);
				}
			}
		}
	} else if (resolvedName) {
		// Generic link or custom name entry
		source = 'manual_entry';

		// V2 DASHBOARD SYNC: Try to find a V2 guest by name even for generic links
		try {
			const v2Event = await findEventBySlugService(eventSlug);
			if (v2Event) {
				const v2Guest = await findGuestByEventAndNamePublic(v2Event.id, resolvedName);
				if (v2Guest) {
					guestId = v2Guest.inviteId; // Link it for sync
					console.log(
						`[RSVP Sync] Linked generic RSVP to V2 guest by name: ${resolvedName} (${guestId})`,
					);
				} else {
					// AUTO-CREATE: No V2 guest found by name, create a new one to show in dashboard
					const createdV2 = await createGuestInvitationPublic({
						eventId: v2Event.id,
						fullName: resolvedName,
						phone: '', // Phone is optional in V1, setting empty for now
						maxAllowedAttendees: maxAllowedAttendees,
						short_id: generateShortId(8),
					});
					guestId = createdV2.inviteId;
					console.log(
						`[RSVP Sync] Created new V2 guest for generic entry: ${resolvedName} (${guestId})`,
					);
				}
			}
		} catch (e) {
			console.error('[RSVP Sync] Failed to link/create generic RSVP in v2 guest:', e);
		}
	}

	if (!resolvedName) {
		throw new Error('El nombre es obligatorio.');
	}

	const attendanceStatus = input.attendanceStatus;
	if (!['confirmed', 'declined', 'pending'].includes(attendanceStatus)) {
		throw new Error('El estado de asistencia es inválido.');
	}

	const attendeeCount =
		attendanceStatus === 'declined'
			? 0
			: toSafeAttendeeCount(input.attendeeCount, MAX_ATTENDEES_ABSOLUTE);

	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new Error('Para confirmar asistencia, el total de asistentes debe ser al menos 1.');
	}

	if (attendeeCount > maxAllowedAttendees) {
		throw new Error(`El límite de asistentes para este enlace es ${maxAllowedAttendees}.`);
	}

	const notes = sanitize(input.notes);
	const dietary = sanitize(input.dietary);
	const normalizedGuestName = normalizeName(resolvedName);
	const storeKey = buildStoreKey(eventSlug, guestId, normalizedGuestName);
	const now = new Date().toISOString();
	const repository = getRsvpRepository();
	const existing = await repository.getRsvpByStoreKey(storeKey);

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
		isPotentialDuplicate: await markPotentialDuplicate(
			eventSlug,
			normalizedGuestName,
			existing?.rsvpId ?? null,
		),
	};

	const persisted = await repository.saveRsvpRecord({ storeKey, record: updatedRecord });

	// SYNC: Update V2 guest_invitations if guestId is a UUID (inviteId)
	if (guestId && isUuid(guestId)) {
		try {
			await updateGuestByInviteIdPublic(guestId, {
				attendance_status: updatedRecord.attendanceStatus,
				attendee_count: updatedRecord.attendeeCount,
				guest_message: updatedRecord.notes,
				responded_at: now,
				last_response_source: 'link',
			});
			console.log(`[RSVP Sync] Updated V2 guest_invitation for ${guestId}`);

			// Publish stream event for real-time dashboard updates
			const v2Event = await findEventBySlugService(eventSlug);
			if (v2Event) {
				const v2Guest = await findGuestByInviteIdPublic(guestId);
				if (v2Guest) {
					publishGuestStreamEvent({
						type: 'guest_updated',
						eventId: v2Event.id,
						guestId: v2Guest.id, // V2 internal ID
						updatedAt: now,
					});
				}
			}
		} catch (error) {
			console.error(
				`[RSVP Sync] Failed to update V2 guest_invitation for ${guestId}:`,
				error,
			);
		}
	}

	const auditRecord: RsvpAuditRecord = {
		auditId: uuidLike('audit'),
		rsvpId: persisted.rsvpId,
		previousStatus: existing?.attendanceStatus ?? null,
		newStatus: persisted.attendanceStatus,
		previousAttendeeCount: existing?.attendeeCount ?? null,
		newAttendeeCount: persisted.attendeeCount,
		changedBy: 'guest',
		changedAt: now,
	};
	await repository.appendAuditEvent(auditRecord);

	return { rsvp: persisted, contextMode };
}

export async function logRsvpChannelEvent(input: {
	rsvpId: string;
	channel: ChannelType;
	action: ChannelAction;
}): Promise<void> {
	const repository = getRsvpRepository();
	const safeRsvpId = sanitize(input.rsvpId, 120);
	const rsvp = await repository.getRsvpById(safeRsvpId);
	if (!rsvp) {
		throw new Error('RSVP no encontrado.');
	}

	const channelRecord: RsvpChannelRecord = {
		channelEventId: uuidLike('channel'),
		rsvpId: safeRsvpId,
		channel: input.channel,
		action: input.action,
		occurredAt: new Date().toISOString(),
	};
	await repository.appendChannelEvent(channelRecord);
}

export async function getAdminRsvpList(params: {
	eventSlug: string;
	status?: AttendanceStatus | 'all';
	search?: string;
}): Promise<AdminListResult> {
	const repository = getRsvpRepository();
	const safeEventSlug = sanitize(params.eventSlug, 120);
	const safeSearch = normalizeName(sanitize(params.search, 120));
	const safeStatus = params.status ?? 'all';

	const items = await repository.listRsvpByEvent({
		eventSlug: safeEventSlug,
		status: safeStatus,
		search: safeSearch,
	});

	const channelEvents = await repository.listChannelEventsByRsvpIds(
		items.map((item) => item.rsvpId),
	);
	const channelByRsvp = new Map<string, RsvpChannelRecord>();
	for (const channelEvent of channelEvents) {
		const existing = channelByRsvp.get(channelEvent.rsvpId);
		if (!existing || existing.occurredAt < channelEvent.occurredAt) {
			channelByRsvp.set(channelEvent.rsvpId, channelEvent);
		}
	}

	const enrichedItems = items.map((item) => ({
		...item,
		lastChannelEvent: channelByRsvp.get(item.rsvpId),
	}));

	const totals = {
		total: enrichedItems.length,
		pending: enrichedItems.filter((item) => item.attendanceStatus === 'pending').length,
		confirmed: enrichedItems.filter((item) => item.attendanceStatus === 'confirmed').length,
		declined: enrichedItems.filter((item) => item.attendanceStatus === 'declined').length,
	};

	return { items: enrichedItems, totals };
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

export function buildGenericInvitationLink(input: {
	baseUrl: string;
	eventType: string;
	eventSlug: string;
}): string {
	const safeBaseUrl = sanitizeBaseUrl(input.baseUrl);
	const safeEventType = sanitize(input.eventType, 80);
	const safeEventSlug = sanitize(input.eventSlug, 120);
	return `${safeBaseUrl}/${encodeURIComponent(safeEventType)}/${encodeURIComponent(safeEventSlug)}`;
}

export function buildGuestInvitationLink(input: {
	baseUrl: string;
	eventType: string;
	eventSlug: string;
	guestId: string;
}): { token: string; personalizedUrl: string } {
	const safeEventSlug = sanitize(input.eventSlug, 120);
	const safeGuestId = sanitize(input.guestId, 120);
	const token = createGuestToken({
		eventSlug: safeEventSlug,
		guestId: safeGuestId,
	});
	const genericUrl = buildGenericInvitationLink({
		baseUrl: input.baseUrl,
		eventType: input.eventType,
		eventSlug: safeEventSlug,
	});
	const personalizedUrl = `${genericUrl}?t=${encodeURIComponent(token)}`;
	return { token, personalizedUrl };
}

export function buildWhatsAppShareLink(input: {
	phone?: string;
	guestName: string;
	inviteUrl: string;
	eventTitle: string;
	template?: string;
}): string {
	const safePhone = normalizeName(sanitize(input.phone, 40)).replace(/\D/g, '');
	if (!safePhone) return '';
	const safeGuestName = sanitize(input.guestName, 120);
	const safeInviteUrl = sanitize(input.inviteUrl, 2000);
	const safeEventTitle = sanitize(input.eventTitle, 120);
	const template =
		sanitize(input.template, 300) ||
		'Hola {name}, te comparto la invitación de {eventTitle}: {inviteUrl}';
	const message = template
		.replace('{name}', safeGuestName)
		.replace('{eventTitle}', safeEventTitle)
		.replace('{inviteUrl}', safeInviteUrl)
		.replace('{guestCount}', '')
		.trim();
	return `https://wa.me/${safePhone}?text=${encodeURIComponent(message)}`;
}

export async function getRsvpInvitationContext(
	eventSlug: string,
	baseUrl?: string,
): Promise<RsvpInvitationListResponse> {
	const safeEventSlug = sanitize(eventSlug, 120);
	const event = await getEventBySlug(safeEventSlug);
	if (!event) {
		throw new Error('Evento no encontrado.');
	}

	const safeEventType = sanitize(event.data.eventType, 80);
	if (!safeEventType) {
		throw new Error('Tipo de evento inválido.');
	}

	const configuredBaseUrl = sanitize(baseUrl || getEnv('BASE_URL'), 300);
	const resolvedBaseUrl = sanitizeBaseUrl(configuredBaseUrl || 'http://localhost:4321');
	const genericUrl = buildGenericInvitationLink({
		baseUrl: resolvedBaseUrl,
		eventType: safeEventType,
		eventSlug: safeEventSlug,
	});

	const { guests } = getEventRsvpConfig(event);
	const waPhone = sanitize(event.data.rsvp?.whatsappConfig?.phone, 40);
	const waTemplate = sanitize(event.data.rsvp?.whatsappConfig?.messageTemplate, 300);

	const guestLinks: RsvpInvitationGuest[] = guests.map((guest) => {
		const { token, personalizedUrl } = buildGuestInvitationLink({
			baseUrl: resolvedBaseUrl,
			eventType: safeEventType,
			eventSlug: safeEventSlug,
			guestId: guest.guestId,
		});
		return {
			guestId: guest.guestId,
			displayName: guest.displayName,
			maxAllowedAttendees: guest.maxAllowedAttendees,
			token,
			personalizedUrl,
			waShareUrl: buildWhatsAppShareLink({
				phone: waPhone,
				guestName: guest.displayName,
				inviteUrl: personalizedUrl,
				eventTitle: event.data.title,
				template: waTemplate,
			}),
		};
	});

	return {
		eventSlug: safeEventSlug,
		eventType: safeEventType,
		baseInviteUrl: resolvedBaseUrl,
		genericUrl,
		guests: guestLinks,
		message:
			guestLinks.length === 0
				? 'Este evento no tiene invitados configurados en rsvp.guests.'
				: undefined,
	};
}

export function parseAttendanceInput(rawAttendance: unknown): AttendanceStatus | null {
	return parseAttendanceStatus(sanitize(rawAttendance));
}
