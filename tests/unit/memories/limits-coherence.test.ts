/**
 * One place that fails when a limit stops agreeing with the layer next to it:
 * browser, app server, database, Workers and the hosting plans around them.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	CLOUDFLARE_FREE_TIER,
	MEMORIES_APP_RATE_LIMITS,
	MEMORIES_ARCHIVE_MAX_BYTES,
	MEMORIES_CLEANUP_SETTLE_BUDGET_MS,
	MEMORIES_CLEANUP_TIME_BUDGET_MS,
	MEMORIES_INSPECTION_BYTES,
	MEMORIES_LATE_UPLOAD_GRACE_SECONDS,
	MEMORIES_LIMIT_PROFILES,
	MEMORIES_PRESIGN_TTL_SECONDS,
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_SESSION_MAX_IN_FLIGHT,
	MEMORIES_SIGN_RATE_LIMIT,
	MEMORIES_UPLOAD_ABANDON_SECONDS,
} from '@/lib/memories/contract/limits';
import {
	MEMORIES_ALLOWED_EXTENSIONS,
	MEMORIES_ALLOWED_MIME_TYPES,
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	MEMORIES_VIDEO_DURATION_DECIMALS,
	roundMemoriesVideoDurationSeconds,
} from '@/lib/memories/contract/media-policy';
import { MEMORIES_PRIVATE_REQUEST_TTL_SECONDS } from '@/lib/memories/contract/private-request';
import {
	buildMemoriesUploadLimitsCopy,
	buildMemoriesUploadSummaryCopy,
	buildMemoriesVideoTooLongCopy,
} from '@/lib/memories/copy';

function readRepositoryFile(...segments: string[]): string {
	return readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

const MIB = 1024 * 1024;
/** Cloudflare caps a request body at 100 MB on the Free plan (workers/platform/limits). */
const CLOUDFLARE_FREE_REQUEST_BODY_BYTES = 100_000_000;

describe('limits agree across layers', () => {
	const migration = readRepositoryFile(
		'supabase',
		'migrations',
		'20260930180000_event_memories_catalog.sql',
	);

	it('stores the video duration at the scale the app rounds to before reserving', () => {
		const scale = /duration_seconds numeric\(\d+, (\d+)\)/.exec(migration)?.[1];
		expect(Number(scale)).toBe(MEMORIES_VIDEO_DURATION_DECIMALS);
		// A value at that scale survives the round trip unchanged, so a replay compares equal.
		const stored = roundMemoriesVideoDurationSeconds(59.999499);
		expect(stored).toBe(59.999);
		expect(roundMemoriesVideoDurationSeconds(stored)).toBe(stored);
		expect(String(stored).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(
			MEMORIES_VIDEO_DURATION_DECIMALS,
		);
	});

	it('leaves quotas to the space row: the database fixes no per-guest or per-event number', () => {
		for (const column of [
			'max_event_objects',
			'max_event_bytes',
			'max_session_files',
			'max_session_bytes',
		]) {
			expect(migration).toMatch(
				new RegExp(`${column} \\w+ not null check \\(${column} > 0\\)`),
			);
		}
		expect(migration).toContain(
			'max_session_videos integer not null check (max_session_videos >= 0)',
		);
	});

	it('checks every quota the app has a guest message for, in the reservation function', () => {
		for (const token of [
			'memories_session_file_quota',
			'memories_session_video_quota',
			'memories_session_byte_quota',
			'memories_session_concurrency_quota',
			'memories_event_object_quota',
			'memories_event_byte_quota',
			'memories_upload_window_closed',
			'memories_space_unavailable',
			'memories_session_unavailable',
			'memories_idempotency_conflict',
		]) {
			expect(migration).toContain(`message = '${token}'`);
		}
		const service = readRepositoryFile(
			'src',
			'lib',
			'memories',
			'server',
			'guest-media.service.ts',
		);
		const raised = [...migration.matchAll(/message = '(memories_[a-z_]+)'/g)].map(
			(match) => match[1],
		);
		const unmapped = [...new Set(raised)].filter(
			(token) =>
				!token.startsWith('memories_invalid_finalize') && !service.includes(`${token}:`),
		);
		expect(unmapped).toEqual([]);
	});

	it('tells the guest the same numbers the upload policy enforces', () => {
		const summary = buildMemoriesUploadSummaryCopy(3);
		const details = buildMemoriesUploadLimitsCopy(3);
		for (const text of [summary, details]) {
			expect(text).toContain(String(MEMORIES_MAX_IMAGE_BYTES / MIB));
			expect(text).toContain(String(MEMORIES_MAX_VIDEO_BYTES / MIB));
			expect(text).toContain(`${MEMORIES_MAX_VIDEO_DURATION_SECONDS} segundos`);
			expect(text).toContain('3 videos');
		}
		expect(buildMemoriesVideoTooLongCopy()).toContain(
			String(MEMORIES_MAX_VIDEO_DURATION_SECONDS),
		);
		for (const extension of MEMORIES_ALLOWED_EXTENSIONS) {
			expect(details).toContain(extension.toUpperCase());
		}
	});

	it('gives every accepted format one size cap per category', () => {
		for (const policy of Object.values(MEMORIES_ALLOWED_MIME_TYPES)) {
			expect(policy.maxBytes).toBe(
				policy.category === 'video' ? MEMORIES_MAX_VIDEO_BYTES : MEMORIES_MAX_IMAGE_BYTES,
			);
		}
	});
});

describe('limits fit the platform', () => {
	it('keeps the largest upload under the request body Cloudflare Free accepts', () => {
		// The file travels in one PUT through the Sign Worker.
		expect(MEMORIES_MAX_VIDEO_BYTES).toBeLessThan(CLOUDFLARE_FREE_REQUEST_BODY_BYTES);
		expect(MEMORIES_MAX_IMAGE_BYTES).toBeLessThan(MEMORIES_MAX_VIDEO_BYTES);
	});

	it('lets a guest use every video slot inside the per-guest storage, in both presets', () => {
		for (const profile of Object.values(MEMORIES_LIMIT_PROFILES)) {
			expect(profile.maxSessionVideos * MEMORIES_MAX_VIDEO_BYTES).toBeLessThanOrEqual(
				profile.maxSessionBytes,
			);
			expect(profile.maxSessionFiles).toBeLessThanOrEqual(profile.maxEventObjects);
			expect(profile.maxSessionBytes).toBeLessThanOrEqual(profile.maxEventBytes);
			expect(profile.maxSessionVideos).toBeLessThanOrEqual(profile.maxSessionFiles);
		}
	});

	it('fits two standard spaces, or one extended, in the R2 free allowance', () => {
		expect(2 * MEMORIES_LIMIT_PROFILES.standard.maxEventBytes).toBeLessThanOrEqual(
			CLOUDFLARE_FREE_TIER.r2StorageBytes,
		);
		expect(MEMORIES_LIMIT_PROFILES.extended.maxEventBytes).toBeLessThanOrEqual(
			CLOUDFLARE_FREE_TIER.r2StorageBytes,
		);
	});

	it('fits the largest file in one export batch', () => {
		expect(MEMORIES_ARCHIVE_MAX_BYTES).toBeGreaterThanOrEqual(MEMORIES_MAX_VIDEO_BYTES);
	});

	it('gives the app the same reservation rate as the deployed Sign Worker limiter', () => {
		const wrangler = JSON.parse(
			readRepositoryFile('workers', 'celebra-memories-sign', 'wrangler.json'),
		) as { ratelimits: Array<{ simple: { limit: number; period: number } }> };
		expect(wrangler.ratelimits[0].simple).toEqual({
			limit: MEMORIES_SIGN_RATE_LIMIT.limit,
			period: MEMORIES_SIGN_RATE_LIMIT.periodSeconds,
		});
		expect(MEMORIES_APP_RATE_LIMITS.register.maxHits).toBe(MEMORIES_SIGN_RATE_LIMIT.limit);
		// A guest with every slot busy can still retry each of them within a minute.
		expect(MEMORIES_SIGN_RATE_LIMIT.limit).toBeGreaterThanOrEqual(
			MEMORIES_SESSION_MAX_IN_FLIGHT * 2,
		);
	});

	it('orders the upload timers so a slow venue upload is never released while it can still land', () => {
		expect(MEMORIES_RESERVATION_TTL_SECONDS).toBeGreaterThan(MEMORIES_PRESIGN_TTL_SECONDS);
		expect(MEMORIES_UPLOAD_ABANDON_SECONDS).toBeGreaterThan(MEMORIES_RESERVATION_TTL_SECONDS);
		expect(MEMORIES_LATE_UPLOAD_GRACE_SECONDS).toBeGreaterThanOrEqual(
			MEMORIES_UPLOAD_ABANDON_SECONDS,
		);
		expect(MEMORIES_PRIVATE_REQUEST_TTL_SECONDS).toBeLessThanOrEqual(
			MEMORIES_PRESIGN_TTL_SECONDS,
		);
	});

	it('budgets the daily cleanup inside the function time Vercel gives it', () => {
		const maxDurationSeconds = Number(
			/maxDuration: (\d+)/.exec(readRepositoryFile('astro.config.mjs'))?.[1],
		);
		expect(maxDurationSeconds).toBeGreaterThan(0);
		expect(MEMORIES_CLEANUP_TIME_BUDGET_MS).toBeLessThan(maxDurationSeconds * 1000);
		expect(MEMORIES_CLEANUP_SETTLE_BUDGET_MS).toBeLessThan(MEMORIES_CLEANUP_TIME_BUDGET_MS);
	});

	it('reads a bounded window per inspection step, far below the Worker memory limit', () => {
		expect(MEMORIES_INSPECTION_BYTES).toBe(64 * 1024);
	});
});
