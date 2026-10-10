/**
 * Aggregate usage of memory spaces, projected per role. The admin projection
 * carries diagnostics but no guest identity; the host projection carries progress
 * but no limits, commercial origin or rejection counts. Session ids are used to
 * count distinct uploaders and never leave this module.
 */

import {
	resolveMemoriesWindowState,
	type MemoriesAdminSpaceItem,
	type MemoriesAdminTotals,
	type MemoriesSpaceAdminUsage,
	type MemoriesSpaceHostSummary,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import { committedMemoriesBytes } from '@/lib/memories/contract/capacity';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import {
	findLastOrganizerDownloadAt,
	listResidentMediaUsage,
	listSessionEventIds,
	type MediaUsageRow,
} from './catalog.repository';
import { resolveMemoriesPublicOrigin } from './public-origin';
import { resolveMemoriesShareUrl } from './share.service';
import { toMemorySpaceSummary } from './space.service';

function emptyUsage(): MemoriesSpaceAdminUsage {
	return {
		photos: 0,
		videos: 0,
		guestsWithUploads: 0,
		sessions: 0,
		residentObjects: 0,
		residentBytes: 0,
		inFlight: 0,
		rejected: 0,
		lastAcceptedAt: null,
	};
}

function accumulate(usage: MemoriesSpaceAdminUsage, row: MediaUsageRow, uploaders: Set<string>) {
	usage.residentObjects += 1;
	usage.residentBytes += Number(row.size_bytes);
	if (row.status === 'uploading' || row.status === 'validating') usage.inFlight += 1;
	if (row.status === 'rejected') usage.rejected += 1;
	if (row.status !== 'accepted') return;
	if (row.mime_type.startsWith('video/')) usage.videos += 1;
	else usage.photos += 1;
	uploaders.add(row.session_id);
	if (row.accepted_at && (!usage.lastAcceptedAt || row.accepted_at > usage.lastAcceptedAt)) {
		usage.lastAcceptedAt = row.accepted_at;
	}
}

export async function summarizeMemorySpaceUsage(
	eventIds: readonly string[],
): Promise<Map<string, MemoriesSpaceAdminUsage>> {
	const [rows, sessionEventIds] = await Promise.all([
		listResidentMediaUsage(eventIds),
		listSessionEventIds(eventIds),
	]);
	const usage = new Map(eventIds.map((eventId) => [eventId, emptyUsage()]));
	const uploaders = new Map(eventIds.map((eventId) => [eventId, new Set<string>()]));
	for (const row of rows) {
		const entry = usage.get(row.event_id);
		const set = uploaders.get(row.event_id);
		if (entry && set) accumulate(entry, row, set);
	}
	for (const eventId of sessionEventIds) {
		const entry = usage.get(eventId);
		if (entry) entry.sessions += 1;
	}
	for (const [eventId, set] of uploaders) {
		const entry = usage.get(eventId);
		if (entry) entry.guestsWithUploads = set.size;
	}
	return usage;
}

export type MemorySpaceWithEventDate = MemoriesSpaceRecord & {
	eventDate: string | null;
	hasOwner: boolean;
};

export async function listMemorySpacesWithUsage(
	spaces: readonly MemorySpaceWithEventDate[],
	now = new Date(),
): Promise<{ items: MemoriesAdminSpaceItem[]; totals: MemoriesAdminTotals }> {
	// Expired spaces hold no downloadable content, so their audit trail is not read.
	const [usage, downloads] = await Promise.all([
		summarizeMemorySpaceUsage(spaces.map((space) => space.eventId)),
		Promise.all(
			spaces.map((space) =>
				resolveMemoriesWindowState(space, now) === 'expired'
					? null
					: findLastOrganizerDownloadAt(space.eventId),
			),
		),
	]);
	const items = spaces.map((space, index) => ({
		...space,
		usage: usage.get(space.eventId) ?? emptyUsage(),
		lastHostDownloadAt: downloads[index],
	}));
	return {
		items,
		totals: {
			residentBytes: items.reduce((total, item) => total + item.usage.residentBytes, 0),
			committedBytes: items.reduce(
				(total, item) =>
					total +
					committedMemoriesBytes(
						resolveMemoriesWindowState(item, now),
						item.maxEventBytes,
						item.usage.residentBytes,
					),
				0,
			),
		},
	};
}

function remainingPercent(used: number, limit: number): number {
	if (limit <= 0) return 0;
	return Math.max(0, Math.min(100, Math.floor(((limit - used) / limit) * 100)));
}

function toHostSummary(
	space: MemoriesSpaceRecord,
	usage: MemoriesSpaceAdminUsage,
	now = new Date(),
	requestOrigin?: string,
): MemoriesSpaceHostSummary {
	return {
		...toMemorySpaceSummary(space, now),
		publicUrl: buildMemoriesPublicUrl(
			space.publicSlug,
			resolveMemoriesPublicOrigin(requestOrigin),
		),
		photos: usage.photos,
		videos: usage.videos,
		guestsWithUploads: usage.guestsWithUploads,
		expectedGuests: space.expectedGuests,
		shareUrl: resolveMemoriesShareUrl(space, now, requestOrigin),
		lastAcceptedAt: usage.lastAcceptedAt,
		capacityRemainingPercent: Math.min(
			remainingPercent(usage.residentBytes, space.maxEventBytes),
			remainingPercent(usage.residentObjects, space.maxEventObjects),
		),
	};
}

export async function getMemorySpaceHostSummary(
	space: MemoriesSpaceRecord,
	now = new Date(),
	requestOrigin?: string,
): Promise<MemoriesSpaceHostSummary> {
	const usage = await summarizeMemorySpaceUsage([space.eventId]);
	return toHostSummary(space, usage.get(space.eventId) ?? emptyUsage(), now, requestOrigin);
}

/**
 * True once the space cannot take another file: the same resident counts the
 * reservation RPC enforces, so guests learn it before choosing files.
 */
export async function isMemorySpaceFull(space: MemoriesSpaceRecord): Promise<boolean> {
	const usage =
		(await summarizeMemorySpaceUsage([space.eventId])).get(space.eventId) ?? emptyUsage();
	return (
		usage.residentObjects >= space.maxEventObjects || usage.residentBytes >= space.maxEventBytes
	);
}
