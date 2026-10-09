/**
 * Super-admin health view of one memory space: catalog rows by status, stalled
 * uploads, upload failures by cause and optional live reachability checks.
 * Reads counts, dates and cause codes only; never guest names, aliases,
 * captions, object keys or media.
 */

import {
	MEMORIES_MEDIA_STATUSES,
	isMemoriesUploadFailureReason,
	type MemoriesMediaStatus,
	type MemoriesSpaceDiagnostics,
	type MemoriesSpaceRecord,
	type MemoriesUploadFailureReason,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
} from '@/lib/memories/contract/limits';
import { getEnv } from '@/lib/server/env';
import {
	MEMORIES_CANONICAL_APP_ORIGIN,
	MEMORIES_PUBLIC_ORIGIN,
} from '@/lib/memories/contract/private-request';
import {
	listDiagnosticAuditRows,
	listMediaStatusRows,
	type DiagnosticAuditRow,
	type MediaStatusRow,
} from './catalog.repository';
import { MEMORIES_ENV } from './config';
import { runMemoriesLiveChecks } from './live-check';
import { resolveMemoriesWorkerUrl } from './private-request';

/** Audit rows read per request; a busy space reports a lower bound past this. */
export const MEMORIES_DIAGNOSTICS_AUDIT_CAP = 5_000;

const FAILURE_ACTIONS = ['upload_refused', 'validation_failed', 'reservation_abandoned'] as const;

function emptyStatusCounts(): Record<MemoriesMediaStatus, number> {
	return Object.fromEntries(MEMORIES_MEDIA_STATUSES.map((status) => [status, 0])) as Record<
		MemoriesMediaStatus,
		number
	>;
}

function summarizeRows(rows: readonly MediaStatusRow[], nowMs: number) {
	const statusCounts = emptyStatusCounts();
	const stalled = { uploading: 0, validating: 0 };
	let lastAcceptedAt: string | null = null;
	for (const row of rows) {
		statusCounts[row.status] += 1;
		if (
			row.status === 'uploading' &&
			nowMs - Date.parse(row.created_at) >= MEMORIES_RESERVATION_TTL_SECONDS * 1000
		)
			stalled.uploading += 1;
		if (
			row.status === 'validating' &&
			nowMs - Date.parse(row.updated_at) >= MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000
		)
			stalled.validating += 1;
		if (row.accepted_at && (!lastAcceptedAt || row.accepted_at > lastAcceptedAt))
			lastAcceptedAt = row.accepted_at;
	}
	return { statusCounts, stalled, lastAcceptedAt };
}

function readReason(metadata: unknown): MemoriesUploadFailureReason | null {
	if (typeof metadata !== 'object' || metadata === null) return null;
	const reason = (metadata as { reason?: unknown }).reason;
	return isMemoriesUploadFailureReason(reason) ? reason : null;
}

function summarizeFailures(rows: readonly DiagnosticAuditRow[]) {
	const failures: Partial<Record<MemoriesUploadFailureReason, number>> = {};
	let failuresWithoutReason = 0;
	let abandoned = 0;
	for (const row of rows) {
		if (row.action === 'reservation_abandoned') {
			abandoned += 1;
			continue;
		}
		const reason = readReason(row.metadata);
		if (reason) failures[reason] = (failures[reason] ?? 0) + 1;
		else if (row.action === 'validation_failed') failuresWithoutReason += 1;
	}
	return { failures, failuresWithoutReason, abandoned };
}

/**
 * Production checks the printed apex QR and the canonical `www` app; Preview and
 * local runs check the origin that served the admin request.
 */
export function resolveLiveCheckOrigins(requestOrigin: string): {
	appOrigin: string;
	qrOrigin: string | null;
} {
	if (getEnv('VERCEL_ENV').trim().toLowerCase() === 'production') {
		return { appOrigin: MEMORIES_CANONICAL_APP_ORIGIN, qrOrigin: MEMORIES_PUBLIC_ORIGIN };
	}
	return { appOrigin: new URL(requestOrigin).origin, qrOrigin: null };
}

export async function buildMemorySpaceDiagnostics(
	space: MemoriesSpaceRecord,
	options: {
		live: boolean;
		requestOrigin: string;
		now?: Date;
		fetchImpl?: typeof fetch;
	},
): Promise<MemoriesSpaceDiagnostics> {
	const now = options.now ?? new Date();
	const [rows, auditRows] = await Promise.all([
		listMediaStatusRows(space.eventId),
		listDiagnosticAuditRows(space.eventId, FAILURE_ACTIONS, MEMORIES_DIAGNOSTICS_AUDIT_CAP),
	]);
	const uploadOrigin = resolveMemoriesWorkerUrl(MEMORIES_ENV.uploadOrigin, '/');
	const liveChecks = options.live
		? await runMemoriesLiveChecks(
				{
					slug: space.publicSlug,
					...resolveLiveCheckOrigins(options.requestOrigin),
					uploadOrigin: uploadOrigin ? uploadOrigin.origin : null,
				},
				options.fetchImpl,
			)
		: null;
	return {
		eventId: space.eventId,
		...summarizeRows(rows, now.getTime()),
		...summarizeFailures(auditRows),
		auditTruncated: auditRows.length >= MEMORIES_DIAGNOSTICS_AUDIT_CAP,
		liveChecks,
		generatedAt: now.toISOString(),
	};
}
