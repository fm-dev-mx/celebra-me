/**
 * Super-admin management of event memory spaces. The only write path for
 * `event_memory_settings`; the invitation release pipeline never touches it.
 */

import { z } from 'zod';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import {
	findEventByIdService,
	listAllEventsService,
} from '@/lib/rsvp/repositories/event.repository';
import { listEventMembershipsService } from '@/lib/rsvp/repositories/role-membership.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { resolveInvitationSchedule } from '@/lib/intake/invitation-validity';
import { deriveStartsAtUtc, isValidIanaTimeZone } from '@/lib/time/event-time';
import type {
	MemoriesAdminSpaceItem,
	MemoriesAdminTotals,
	MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ADMIN_NOTE_MAX_LENGTH,
	MEMORIES_ENTITLEMENTS,
	MEMORIES_EXPECTED_GUESTS_MAX,
	MEMORIES_LIMIT_PROFILES,
	MEMORIES_OBJECT_MAX_LIFETIME_DAYS,
	type MemoriesSpaceLimits,
} from '@/lib/memories/contract/limits';
import {
	MEMORIES_PUBLIC_SLUG_PATTERN,
	MEMORIES_PUBLIC_SLUG_MAX_LENGTH,
} from '@/lib/memories/contract/private-request';
import { appendMemoriesAudit } from './audit';
import {
	findMemorySpaceByEventId,
	insertMemorySpace,
	listAllMemorySpaces,
	updateMemorySpace,
	type MemorySpaceUpdate,
} from './settings.repository';
import { listMemorySpacesWithUsage } from './usage.service';

const DEFAULT_DAYS_BEFORE_EVENT = 7;
const DEFAULT_DAYS_AFTER_EVENT = 8;
const DEFAULT_RETENTION_DAYS = 60;
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

const localDateTime = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha local inválida (AAAA-MM-DDTHH:mm).');

const limitsSchema = z.object({
	maxEventObjects: z.number().int().positive(),
	maxEventBytes: z.number().int().positive(),
	maxSessionFiles: z.number().int().positive(),
	maxSessionVideos: z.number().int().nonnegative(),
	maxSessionBytes: z.number().int().positive(),
});

const scheduleSchema = z.object({
	timeZone: z.string().refine(isValidIanaTimeZone, 'Zona horaria inválida.'),
	uploadStartsLocal: localDateTime,
	uploadEndsLocal: localDateTime,
	retentionEndsLocal: localDateTime,
});

/** Blank notes are stored as NULL so "no note" has a single representation. */
const planningSchema = z.object({
	expectedGuests: z.number().int().min(1).max(MEMORIES_EXPECTED_GUESTS_MAX).nullable().optional(),
	adminNote: z
		.string()
		.trim()
		.max(MEMORIES_ADMIN_NOTE_MAX_LENGTH)
		.transform((value) => (value === '' ? null : value))
		.nullable()
		.optional(),
});

const createSchema = scheduleSchema.extend(planningSchema.shape).extend({
	eventId: z.string().uuid(),
	publicSlug: z
		.string()
		.max(MEMORIES_PUBLIC_SLUG_MAX_LENGTH)
		.regex(MEMORIES_PUBLIC_SLUG_PATTERN, 'El slug público debe ser kebab-case en minúsculas.')
		.optional(),
	entitlement: z.enum(MEMORIES_ENTITLEMENTS),
	limits: limitsSchema,
	enabled: z.boolean().default(true),
});

const updateSchema = scheduleSchema
	.partial()
	.extend(planningSchema.shape)
	.extend({
		entitlement: z.enum(MEMORIES_ENTITLEMENTS).optional(),
		limits: limitsSchema.optional(),
		enabled: z.boolean().optional(),
	});

export type MemorySpaceCreateInput = z.input<typeof createSchema>;

export interface MemorySpaceCandidate {
	eventId: string;
	eventSlug: string;
	eventTitle: string;
	/** Local event date from the published invitation, when readable. */
	eventDate: string | null;
	defaults: {
		publicSlug: string;
		timeZone: string;
		uploadStartsLocal: string;
		uploadEndsLocal: string;
		retentionEndsLocal: string;
		limits: MemoriesSpaceLimits;
	};
}

function validationError(error: z.ZodError): ApiError {
	return new ApiError(400, 'validation_error', error.issues[0]?.message ?? 'Datos inválidos.', {
		issues: error.issues.map((issue) => ({
			path: issue.path.join('.'),
			message: issue.message,
		})),
	});
}

function toInstant(localValue: string, timeZone: string, label: string): string {
	const instant = deriveStartsAtUtc(localValue, timeZone);
	if (!instant) throw new ApiError(400, 'validation_error', `${label} no es válida.`);
	return instant;
}

function assertSchedule(input: {
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
}) {
	const starts = Date.parse(input.uploadStartsAt);
	const ends = Date.parse(input.uploadEndsAt);
	const retention = Date.parse(input.retentionEndsAt);
	if (ends <= starts) {
		throw new ApiError(
			400,
			'validation_error',
			'El cierre de la ventana debe ser posterior a la apertura.',
		);
	}
	if (retention < ends) {
		throw new ApiError(
			400,
			'validation_error',
			'La retención debe terminar después del cierre de la ventana.',
		);
	}
	if (retention - starts > MEMORIES_OBJECT_MAX_LIFETIME_DAYS * 24 * 60 * 60 * 1000) {
		throw new ApiError(
			400,
			'validation_error',
			`La retención no puede superar ${MEMORIES_OBJECT_MAX_LIFETIME_DAYS} días desde la apertura.`,
		);
	}
}

function shiftLocalDate(date: string, days: number): string {
	const [year, month, day] = date.split('-').map(Number);
	const shifted = new Date(Date.UTC(year, month - 1, day + days));
	return shifted.toISOString().slice(0, 10);
}

function mapPersistenceError(error: unknown): never {
	if (error instanceof SupabaseHttpError) {
		if (error.code === UNIQUE_VIOLATION) {
			throw new ApiError(
				409,
				'conflict',
				'El evento ya tiene recuerdos o el slug público está en uso.',
			);
		}
		if (error.code === CHECK_VIOLATION) {
			throw new ApiError(
				400,
				'validation_error',
				'Los valores no cumplen las reglas del espacio de recuerdos.',
			);
		}
	}
	throw error;
}

export async function listMemorySpacesAdmin(
	now = new Date(),
): Promise<{ items: MemoriesAdminSpaceItem[]; totals: MemoriesAdminTotals }> {
	const [spaces, events, memberships] = await Promise.all([
		listAllMemorySpaces(),
		listAllEventsService(),
		listEventMembershipsService(),
	]);
	const invitationByEvent = new Map(events.map((event) => [event.id, event.invitationId]));
	const ownedEventIds = new Set(
		memberships
			.filter((membership) => membership.membershipRole === 'owner')
			.map((membership) => membership.eventId),
	);
	const dated = await Promise.all(
		spaces.map(async (space) => ({
			...space,
			eventDate: await resolveEventDate(invitationByEvent.get(space.eventId), now),
			hasOwner: ownedEventIds.has(space.eventId),
		})),
	);
	return listMemorySpacesWithUsage(dated, now);
}

async function resolveEventDate(
	invitationId: string | null | undefined,
	now: Date,
): Promise<string | null> {
	if (!invitationId) return null;
	const published = await findPublishedByInvitationId(invitationId);
	return resolveInvitationSchedule('client', published?.content, now).eventDate ?? null;
}

/**
 * Published events without a space, with defaults derived from their published timing.
 * Events without a readable date fall back to `now`; the form is reviewed before saving.
 */
export async function listMemorySpaceCandidatesAdmin(
	now = new Date(),
): Promise<MemorySpaceCandidate[]> {
	const [events, spaces] = await Promise.all([listAllEventsService(), listAllMemorySpaces()]);
	const taken = new Set(spaces.map((space) => space.eventId));
	const eligible = events.filter((event) => !taken.has(event.id) && event.status === 'published');
	return Promise.all(
		eligible.map(async (event) => {
			const published = event.invitationId
				? await findPublishedByInvitationId(event.invitationId)
				: null;
			const schedule = resolveInvitationSchedule('client', published?.content, now);
			const eventDate = schedule.eventDate ?? now.toISOString().slice(0, 10);
			const uploadEndsDate = shiftLocalDate(eventDate, DEFAULT_DAYS_AFTER_EVENT);
			return {
				eventId: event.id,
				eventSlug: event.slug,
				eventTitle: event.title,
				eventDate: schedule.eventDate ?? null,
				defaults: {
					publicSlug: event.slug,
					timeZone: schedule.eventTimeZone,
					uploadStartsLocal: `${shiftLocalDate(eventDate, -DEFAULT_DAYS_BEFORE_EVENT)}T00:00`,
					uploadEndsLocal: `${uploadEndsDate}T00:00`,
					retentionEndsLocal: `${shiftLocalDate(uploadEndsDate, DEFAULT_RETENTION_DAYS)}T00:00`,
					limits: { ...MEMORIES_LIMIT_PROFILES.standard },
				},
			};
		}),
	);
}

export async function createMemorySpaceAdmin(
	payload: unknown,
	adminUserId: string,
): Promise<MemoriesSpaceRecord> {
	const parsed = createSchema.safeParse(payload);
	if (!parsed.success) throw validationError(parsed.error);
	const input = parsed.data;
	const event = await findEventByIdService(input.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'El evento no existe.');
	if (event.status !== 'published') {
		throw new ApiError(409, 'conflict', 'Solo los eventos publicados pueden tener recuerdos.');
	}
	const schedule = {
		uploadStartsAt: toInstant(input.uploadStartsLocal, input.timeZone, 'La apertura'),
		uploadEndsAt: toInstant(input.uploadEndsLocal, input.timeZone, 'El cierre'),
		retentionEndsAt: toInstant(input.retentionEndsLocal, input.timeZone, 'La retención'),
	};
	assertSchedule(schedule);
	let space: MemoriesSpaceRecord;
	try {
		space = await insertMemorySpace({
			eventId: event.id,
			publicSlug: input.publicSlug ?? event.slug,
			enabled: input.enabled,
			timeZone: input.timeZone,
			...schedule,
			...input.limits,
			entitlement: input.entitlement,
			expectedGuests: input.expectedGuests ?? null,
			adminNote: input.adminNote ?? null,
			createdBy: adminUserId,
		});
	} catch (error) {
		mapPersistenceError(error);
	}
	await appendMemoriesAudit({
		eventId: space.eventId,
		actorType: 'admin',
		actorId: adminUserId,
		action: 'space_created',
		metadata: { entitlement: space.entitlement },
	});
	return space;
}

export async function updateMemorySpaceAdmin(
	eventId: string,
	payload: unknown,
	adminUserId: string,
): Promise<MemoriesSpaceRecord> {
	const parsed = updateSchema.safeParse(payload);
	if (!parsed.success) throw validationError(parsed.error);
	const input = parsed.data;
	const current = await findMemorySpaceByEventId(eventId);
	if (!current) throw new ApiError(404, 'not_found', 'El evento no tiene recuerdos.');
	const timeZone = input.timeZone ?? current.timeZone;
	const schedule = {
		uploadStartsAt: input.uploadStartsLocal
			? toInstant(input.uploadStartsLocal, timeZone, 'La apertura')
			: current.uploadStartsAt,
		uploadEndsAt: input.uploadEndsLocal
			? toInstant(input.uploadEndsLocal, timeZone, 'El cierre')
			: current.uploadEndsAt,
		retentionEndsAt: input.retentionEndsLocal
			? toInstant(input.retentionEndsLocal, timeZone, 'La retención')
			: current.retentionEndsAt,
	};
	assertSchedule(schedule);
	const patch: MemorySpaceUpdate = {
		...schedule,
		timeZone,
		...(input.limits ?? {}),
		...(input.entitlement !== undefined ? { entitlement: input.entitlement } : {}),
		...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
		...(input.expectedGuests !== undefined ? { expectedGuests: input.expectedGuests } : {}),
		...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
	};
	let updated: MemoriesSpaceRecord | null;
	try {
		updated = await updateMemorySpace(eventId, patch);
	} catch (error) {
		mapPersistenceError(error);
	}
	if (!updated) throw new ApiError(404, 'not_found', 'El evento no tiene recuerdos.');
	await appendMemoriesAudit({
		eventId,
		actorType: 'admin',
		actorId: adminUserId,
		action: 'space_updated',
		metadata: { enabled: updated.enabled, previousEnabled: current.enabled },
	});
	return updated;
}
