/**
 * Shared gallery: a read-only page anyone with the link can open. The link token
 * is HMAC-SHA256(secret, event id and share version), so nothing secret is stored
 * and bumping the version revokes the old link. It never shows hidden files and
 * stops working when retention ends.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getEnv } from '@/lib/server/env';
import {
	resolveMemoriesWindowState,
	type MemoriesGalleryItem,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_CATALOG_PAGE_SIZE } from '@/lib/memories/contract/limits';
import {
	MEMORIES_SHARE_TOKEN_PATTERN,
	buildMemoriesGalleryUrl,
} from '@/lib/memories/contract/private-request';
import { appendMemoriesAudit } from './audit';
import { listGalleryMedia } from './catalog.repository';
import { MEMORIES_ENV } from './config';
import { toOrganizerItem } from './media-mapper';
import { organizerMaxPage } from './organizer.service';
import { updateMemorySpaceShare } from './settings.repository';
import { findPublicMemorySpace } from './space.service';

function readShareSecret(): string | null {
	const secret = (getEnv(MEMORIES_ENV.shareSecret) ?? '').trim();
	return secret.length >= 32 ? secret : null;
}

export function buildMemoriesShareToken(
	space: Pick<MemoriesSpaceRecord, 'eventId' | 'shareVersion'>,
	secret: string,
): string {
	return createHmac('sha256', secret)
		.update(`memories-share:${space.eventId}:${space.shareVersion}`)
		.digest('base64url');
}

export function verifyMemoriesShareToken(
	space: Pick<MemoriesSpaceRecord, 'eventId' | 'shareVersion'>,
	token: string,
	secret: string,
): boolean {
	if (!MEMORIES_SHARE_TOKEN_PATTERN.test(token)) return false;
	const expected = Buffer.from(buildMemoriesShareToken(space, secret));
	const received = Buffer.from(token);
	return expected.length === received.length && timingSafeEqual(expected, received);
}

/** The link while sharing is on and retention has not ended; null otherwise. */
export function resolveMemoriesShareUrl(
	space: MemoriesSpaceRecord,
	now = new Date(),
): string | null {
	if (!space.shareEnabledAt) return null;
	if (resolveMemoriesWindowState(space, now) === 'expired') return null;
	const secret = readShareSecret();
	if (!secret) return null;
	return buildMemoriesGalleryUrl(space.publicSlug, buildMemoriesShareToken(space, secret));
}

export type MemoriesShareAction = 'enable' | 'disable' | 'rotate';

const SHARE_AUDIT_ACTION: Record<MemoriesShareAction, string> = {
	enable: 'gallery_share_enabled',
	disable: 'gallery_share_disabled',
	rotate: 'gallery_share_rotated',
};

export function isMemoriesShareAction(value: unknown): value is MemoriesShareAction {
	return value === 'enable' || value === 'disable' || value === 'rotate';
}

export async function updateMemoriesShare(input: {
	space: MemoriesSpaceRecord;
	action: MemoriesShareAction;
	actorId: string;
	now?: Date;
}): Promise<{ shareUrl: string | null }> {
	const now = input.now ?? new Date();
	if (input.action !== 'disable' && !readShareSecret()) {
		throw new ApiError(503, 'config_error', 'La galería compartida no está configurada.');
	}
	if (input.action !== 'disable' && resolveMemoriesWindowState(input.space, now) === 'expired') {
		throw new ApiError(
			409,
			'conflict',
			'Los recuerdos de este evento ya no están disponibles.',
		);
	}
	const { space } = input;
	const updated = await updateMemorySpaceShare(space.eventId, {
		expectedVersion: space.shareVersion,
		shareVersion: input.action === 'rotate' ? space.shareVersion + 1 : space.shareVersion,
		shareEnabledAt:
			input.action === 'disable' ? null : (space.shareEnabledAt ?? now.toISOString()),
	});
	if (!updated)
		throw new ApiError(409, 'conflict', 'El enlace cambió mientras tanto. Recargue la página.');
	await appendMemoriesAudit({
		eventId: space.eventId,
		actorType: 'organizer',
		actorId: input.actorId,
		action: SHARE_AUDIT_ACTION[input.action],
		metadata: { shareVersion: updated.shareVersion },
	});
	return { shareUrl: resolveMemoriesShareUrl(updated, now) };
}

/** Resolves a visitor's link to its space, or a 404 that does not say which part failed. */
export async function requireSharedGallerySpace(
	publicSlug: unknown,
	token: unknown,
	now = new Date(),
): Promise<MemoriesSpaceRecord> {
	const notFound = new ApiError(404, 'not_found', 'Esta galería no está disponible.');
	if (typeof token !== 'string') throw notFound;
	const space = await findPublicMemorySpace(publicSlug);
	const secret = readShareSecret();
	if (!space || !secret || !space.shareEnabledAt) throw notFound;
	if (resolveMemoriesWindowState(space, now) === 'expired') throw notFound;
	if (!verifyMemoriesShareToken(space, token, secret)) throw notFound;
	return space;
}

export async function listSharedGalleryItems(
	space: MemoriesSpaceRecord,
	page: number,
): Promise<{ items: MemoriesGalleryItem[]; nextPage: number | null }> {
	if (!Number.isSafeInteger(page) || page < 0 || page > organizerMaxPage(space)) {
		throw new ApiError(400, 'bad_request', 'La página no es válida.');
	}
	const rows = await listGalleryMedia({
		eventId: space.eventId,
		limit: MEMORIES_CATALOG_PAGE_SIZE + 1,
		offset: page * MEMORIES_CATALOG_PAGE_SIZE,
	});
	return {
		items: rows.slice(0, MEMORIES_CATALOG_PAGE_SIZE).map((row) => {
			const item = toOrganizerItem(row);
			return {
				id: item.id,
				mimeType: item.mimeType,
				durationSeconds: item.durationSeconds,
				caption: item.caption,
				createdAt: item.createdAt,
				hasThumbnail: item.hasThumbnail,
				uploaderName: item.uploader.displayName,
			};
		}),
		nextPage: rows.length > MEMORIES_CATALOG_PAGE_SIZE ? page + 1 : null,
	};
}
