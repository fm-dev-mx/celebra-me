import { ApiError } from '@/lib/rsvp/core/errors';
import { listMembershipsForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { getEventOwnerAccessOrThrow } from '@/lib/rsvp/services/shared/event-owner-access';
import { isValidUtcIso } from '@/lib/time/event-time';
import {
	MEMORIES_GUEST_ALIAS_PATTERN,
	canTransitionMemoriesMedia,
	isMemoriesCatalogVisibleStatus,
	isMemoriesMediaStatus,
	sanitizeMemoriesCaption,
	type MemoriesMediaPublicItem,
	type MemoriesOrganizerListQuery,
	type MemoriesOrganizerListResponse,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_CATALOG_PAGE_SIZE,
	MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH,
} from '@/lib/memories/contract/limits';
import { appendMemoriesAudit } from './audit';
import {
	findMediaById,
	listOrganizerMedia,
	patchMedia,
	revokeSessionsByAlias,
} from './catalog.repository';
import { mapMediaRow, toOrganizerItem, toPublicItem } from './media-mapper';
import { listMemorySpacesByEventIds } from './settings.repository';
import { requireMemorySpaceByEventId } from './space.service';

/** Spaces the signed-in host owns. Managers and admins without membership see none. */
export async function listOrganizerMemorySpaces(session: {
	accessToken: string;
}): Promise<MemoriesSpaceRecord[]> {
	const memberships = await listMembershipsForHost(session.accessToken);
	const ownedEventIds = memberships
		.filter((membership) => membership.membershipRole === 'owner')
		.map((membership) => membership.eventId);
	return listMemorySpacesByEventIds(ownedEventIds);
}

export async function requireOrganizerMemorySpace(
	eventId: string,
	session: { userId: string; accessToken: string },
): Promise<MemoriesSpaceRecord> {
	await getEventOwnerAccessOrThrow(eventId, session);
	return requireMemorySpaceByEventId(eventId);
}

function normalizeDateBound(value: unknown, label: string): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (!isValidUtcIso(value)) throw new ApiError(400, 'bad_request', `${label} no es válida.`);
	return value;
}

function normalizeUploaderFilter(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string')
		throw new ApiError(400, 'bad_request', 'El filtro de invitado no es válido.');
	const normalized = value.trim().replace(/\s+/g, ' ');
	if (
		!normalized ||
		normalized.length > MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH ||
		!/^[-\p{L}\p{N}\s']+$/u.test(normalized)
	) {
		throw new ApiError(400, 'bad_request', 'El filtro de invitado no es válido.');
	}
	return normalized;
}

export function organizerMaxPage(space: MemoriesSpaceRecord): number {
	return Math.max(0, Math.ceil(space.maxEventObjects / MEMORIES_CATALOG_PAGE_SIZE) - 1);
}

export async function listOrganizerMemoryItems(
	space: MemoriesSpaceRecord,
	input: MemoriesOrganizerListQuery = {},
): Promise<MemoriesOrganizerListResponse> {
	const page = input.page ?? 0;
	if (!Number.isSafeInteger(page) || page < 0 || page > organizerMaxPage(space)) {
		throw new ApiError(400, 'bad_request', 'La página no es válida.');
	}
	if (
		input.status !== undefined &&
		(!isMemoriesMediaStatus(input.status) || !isMemoriesCatalogVisibleStatus(input.status))
	) {
		throw new ApiError(400, 'bad_request', 'El estado no es válido.');
	}
	const uploader = normalizeUploaderFilter(input.uploader);
	const createdFrom = normalizeDateBound(input.createdFrom, 'La fecha inicial');
	const createdTo = normalizeDateBound(input.createdTo, 'La fecha final');
	if (createdFrom && createdTo && Date.parse(createdFrom) >= Date.parse(createdTo)) {
		throw new ApiError(400, 'bad_request', 'El rango de fechas no es válido.');
	}
	const rows = await listOrganizerMedia({
		eventId: space.eventId,
		limit: MEMORIES_CATALOG_PAGE_SIZE + 1,
		offset: page * MEMORIES_CATALOG_PAGE_SIZE,
		status: input.status,
		uploader,
		createdFrom,
		createdTo,
	});
	return {
		items: rows.slice(0, MEMORIES_CATALOG_PAGE_SIZE).map(toOrganizerItem),
		nextPage: rows.length > MEMORIES_CATALOG_PAGE_SIZE ? page + 1 : null,
	};
}

export async function updateOrganizerMemoryItem(input: {
	space: MemoriesSpaceRecord;
	mediaItemId: string;
	caption?: unknown;
	status?: unknown;
	actorId: string;
}): Promise<MemoriesMediaPublicItem> {
	const row = await findMediaById(input.space.eventId, input.mediaItemId);
	if (!row) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	const item = mapMediaRow(row);
	const targetStatus = input.status === undefined ? item.status : input.status;
	if (!isMemoriesMediaStatus(targetStatus)) {
		throw new ApiError(400, 'bad_request', 'Estado de moderación no válido.');
	}
	if (targetStatus !== item.status && !canTransitionMemoriesMedia(item.status, targetStatus)) {
		throw new ApiError(409, 'conflict', 'La transición de moderación no está permitida.');
	}
	const now = new Date().toISOString();
	const body: Record<string, unknown> = {};
	if (input.caption !== undefined) body.caption = sanitizeMemoriesCaption(input.caption);
	if (targetStatus !== item.status) {
		body.status = targetStatus;
		body.accepted_at = targetStatus === 'accepted' ? now : null;
		body.rejected_at = targetStatus === 'rejected' ? now : null;
		body.deleted_at = targetStatus === 'deleted' ? now : null;
		if (targetStatus === 'deleted' || targetStatus === 'rejected') body.cleanup_after = now;
	}
	const updated = await patchMedia(item.id, body);
	if (!updated)
		throw new ApiError(503, 'service_unavailable', 'No se pudo actualizar el recuerdo.');
	await appendMemoriesAudit({
		eventId: input.space.eventId,
		mediaItemId: item.id,
		actorType: 'organizer',
		actorId: input.actorId,
		action: targetStatus !== item.status ? 'moderation_updated' : 'caption_updated',
		metadata: { fromStatus: item.status, toStatus: targetStatus },
	});
	return toPublicItem(mapMediaRow(updated));
}

export async function revokeGuestMemorySession(input: {
	space: MemoriesSpaceRecord;
	guestAlias: unknown;
	actorId: string;
}): Promise<void> {
	const guestAlias = typeof input.guestAlias === 'string' ? input.guestAlias.trim() : '';
	if (!MEMORIES_GUEST_ALIAS_PATTERN.test(guestAlias)) {
		throw new ApiError(400, 'bad_request', 'El alias de invitado no es válido.');
	}
	const rows = await revokeSessionsByAlias(input.space.eventId, guestAlias);
	if (rows.length === 0) throw new ApiError(404, 'not_found', 'La sesión no está disponible.');
	await appendMemoriesAudit({
		eventId: input.space.eventId,
		actorType: 'organizer',
		actorId: input.actorId,
		action: 'guest_session_revoked',
	});
}
