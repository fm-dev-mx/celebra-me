import { ApiError } from '@/lib/rsvp/core/errors';
import { listMembershipsForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { getEventOwnerAccessOrThrow } from '@/lib/rsvp/services/shared/event-owner-access';
import { isValidUtcIso } from '@/lib/time/event-time';
import {
	MEMORIES_GUEST_ALIAS_PATTERN,
	MEMORIES_MEDIA_KINDS,
	MEMORIES_VISIBILITY_FILTERS,
	canTransitionMemoriesMedia,
	isMemoriesCatalogVisibleStatus,
	isMemoriesMediaStatus,
	sanitizeMemoriesCaption,
	type MemoriesMediaPublicItem,
	type MemoriesOrganizerListQuery,
	type MemoriesMediaItem,
	type MemoriesMediaKind,
	type MemoriesOrganizerListResponse,
	type MemoriesOrganizerUploader,
	type MemoriesSpaceRecord,
	type MemoriesVisibilityFilter,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_CATALOG_PAGE_SIZE,
	MEMORIES_ORGANIZER_UPLOADER_FILTER_MAX_LENGTH,
} from '@/lib/memories/contract/limits';
import { appendMemoriesAudit } from './audit';
import {
	findMediaById,
	listOrganizerMedia,
	listUploaderFileCounts,
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

function normalizeOption<T extends string>(
	value: unknown,
	options: readonly T[],
	message: string,
): T | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string' || !(options as readonly string[]).includes(value))
		throw new ApiError(400, 'bad_request', message);
	return value as T;
}

function normalizeUploaderAlias(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string' || !MEMORIES_GUEST_ALIAS_PATTERN.test(value))
		throw new ApiError(400, 'bad_request', 'El invitado no es válido.');
	return value;
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
	const uploaderAlias = normalizeUploaderAlias(input.uploaderAlias);
	const kind = normalizeOption<MemoriesMediaKind>(
		input.kind,
		MEMORIES_MEDIA_KINDS,
		'El tipo no es válido.',
	);
	const visibility = normalizeOption<MemoriesVisibilityFilter>(
		input.visibility,
		MEMORIES_VISIBILITY_FILTERS,
		'La visibilidad no es válida.',
	);
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
		uploaderAlias,
		kind,
		visibility,
		createdFrom,
		createdTo,
	});
	return {
		items: rows.slice(0, MEMORIES_CATALOG_PAGE_SIZE).map(toOrganizerItem),
		nextPage: rows.length > MEMORIES_CATALOG_PAGE_SIZE ? page + 1 : null,
	};
}

function resolveHiddenAt(item: MemoriesMediaItem, hidden: unknown, now: string): string | null {
	if (typeof hidden !== 'boolean')
		throw new ApiError(400, 'bad_request', 'La visibilidad no es válida.');
	if (item.status !== 'accepted')
		throw new ApiError(409, 'conflict', 'Solo se pueden ocultar recuerdos disponibles.');
	return hidden ? (item.hiddenAt ?? now) : null;
}

function resolveAuditAction(statusChanged: boolean, hidden: unknown): string {
	if (statusChanged) return 'moderation_updated';
	if (hidden === true) return 'hidden_by_organizer';
	if (hidden === false) return 'shown_by_organizer';
	return 'caption_updated';
}

/** Guests with available files, alphabetically, for the host's guest filter. */
export async function listOrganizerUploaders(
	space: MemoriesSpaceRecord,
): Promise<MemoriesOrganizerUploader[]> {
	const rows = await listUploaderFileCounts(space.eventId);
	return rows
		.map((row) => ({
			displayName: row.display_name,
			guestAlias: row.guest_alias,
			files: row.files,
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es-MX'));
}

export async function updateOrganizerMemoryItem(input: {
	space: MemoriesSpaceRecord;
	mediaItemId: string;
	caption?: unknown;
	status?: unknown;
	/** True hides the file from the shared gallery and "download all"; false shows it again. */
	hidden?: unknown;
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
	if (input.hidden !== undefined) body.hidden_at = resolveHiddenAt(item, input.hidden, now);
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
		action: resolveAuditAction(targetStatus !== item.status, input.hidden),
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
