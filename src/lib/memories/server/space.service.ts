import { ApiError } from '@/lib/rsvp/core/errors';
import {
	resolveMemoriesWindowState,
	type MemoriesSpaceRecord,
	type MemoriesSpaceSummary,
	type MemoriesWindowState,
} from '@/lib/memories/contract/catalog';
import { isMemoriesPublicSlug } from '@/lib/memories/contract/private-request';
import { findMemorySpaceByEventId, findMemorySpaceByPublicSlug } from './settings.repository';

export function toMemorySpaceSummary(
	space: MemoriesSpaceRecord,
	now = new Date(),
): MemoriesSpaceSummary {
	return {
		publicSlug: space.publicSlug,
		eventTitle: space.eventTitle,
		timeZone: space.timeZone,
		uploadStartsAt: space.uploadStartsAt,
		uploadEndsAt: space.uploadEndsAt,
		retentionEndsAt: space.retentionEndsAt,
		windowState: resolveMemoriesWindowState(space, now),
	};
}

/**
 * Landing-page resolution for a printed QR: unknown and malformed slugs are
 * indistinguishable (null → 404), while expired spaces still resolve so the
 * page can show a closure message instead of an error.
 */
export async function findPublicMemorySpace(
	publicSlug: unknown,
): Promise<MemoriesSpaceRecord | null> {
	if (!isMemoriesPublicSlug(publicSlug)) return null;
	return findMemorySpaceByPublicSlug(publicSlug);
}

/** API resolution: unknown, malformed and expired slugs are indistinguishable (404). */
export async function resolvePublicMemorySpace(
	publicSlug: unknown,
	now = new Date(),
): Promise<MemoriesSpaceRecord | null> {
	const space = await findPublicMemorySpace(publicSlug);
	if (!space || resolveMemoriesWindowState(space, now) === 'expired') return null;
	return space;
}

/** Guest interaction (session, catalog, uploads) is offered only while the space is live. */
export function isMemorySpaceInteractive(state: MemoriesWindowState): boolean {
	return state !== 'expired' && state !== 'disabled';
}

export async function requirePublicMemorySpace(publicSlug: unknown): Promise<MemoriesSpaceRecord> {
	const space = await resolvePublicMemorySpace(publicSlug);
	if (!space) throw new ApiError(404, 'not_found', 'El espacio de recuerdos no está disponible.');
	return space;
}

/** Guests may read and recover until retention ends; uploads need an open window. */
export function assertMemorySpaceAcceptsGuests(space: MemoriesSpaceRecord, now = new Date()): void {
	if (!isMemorySpaceInteractive(resolveMemoriesWindowState(space, now))) {
		throw new ApiError(404, 'not_found', 'El espacio de recuerdos no está disponible.');
	}
}

export async function requireMemorySpaceByEventId(eventId: string): Promise<MemoriesSpaceRecord> {
	const space = await findMemorySpaceByEventId(eventId);
	if (!space) throw new ApiError(404, 'not_found', 'El evento no tiene recuerdos activos.');
	return space;
}
