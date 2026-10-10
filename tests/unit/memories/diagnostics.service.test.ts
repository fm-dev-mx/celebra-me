jest.mock('@/lib/memories/server/catalog.repository', () => ({
	listMediaStatusRows: jest.fn(),
	listDiagnosticAuditRows: jest.fn(),
}));

jest.mock('@/lib/server/env', () => ({
	getEnv: jest.fn(),
}));

import { getEnv } from '@/lib/server/env';
import {
	listDiagnosticAuditRows,
	listMediaStatusRows,
	type MediaStatusRow,
} from '@/lib/memories/server/catalog.repository';
import {
	MEMORIES_DIAGNOSTICS_AUDIT_CAP,
	buildMemorySpaceDiagnostics,
	resolveLiveCheckOrigins,
} from '@/lib/memories/server/diagnostics.service';
import { EVENT_ID, PUBLIC_SLUG, buildSpace } from './fixtures';

const mockRows = listMediaStatusRows as jest.MockedFunction<typeof listMediaStatusRows>;
const mockAudit = listDiagnosticAuditRows as jest.MockedFunction<typeof listDiagnosticAuditRows>;
const mockEnv = getEnv as jest.MockedFunction<typeof getEnv>;

const NOW = new Date('2026-10-24T12:00:00.000Z');
const LOCAL_ORIGIN = 'http://localhost:4321';
const UPLOAD_ORIGIN = 'https://memories-sign.example.workers.dev';

function row(overrides: Partial<MediaStatusRow>): MediaStatusRow {
	return {
		id: 'item',
		status: 'accepted',
		created_at: '2026-10-24T11:00:00.000Z',
		updated_at: '2026-10-24T11:00:00.000Z',
		accepted_at: null,
		...overrides,
	};
}

function env(values: Record<string, string>) {
	mockEnv.mockImplementation((name: string) => values[name] ?? '');
}

beforeEach(() => {
	jest.clearAllMocks();
	env({});
	mockRows.mockResolvedValue([]);
	mockAudit.mockResolvedValue([]);
});

describe('buildMemorySpaceDiagnostics', () => {
	it('counts every row by status and finds the latest accepted upload', async () => {
		mockRows.mockResolvedValue([
			row({ id: 'a', status: 'accepted', accepted_at: '2026-10-24T10:00:00.000Z' }),
			row({ id: 'b', status: 'accepted', accepted_at: '2026-10-24T11:30:00.000Z' }),
			row({ id: 'c', status: 'rejected' }),
			row({ id: 'd', status: 'deleted' }),
			row({ id: 'e', status: 'duplicate' }),
		]);

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: false,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
		});

		expect(result.statusCounts).toEqual({
			uploading: 0,
			validating: 0,
			accepted: 2,
			rejected: 1,
			deleted: 1,
			duplicate: 1,
		});
		expect(result.lastAcceptedAt).toBe('2026-10-24T11:30:00.000Z');
		expect(result.liveChecks).toBeNull();
		expect(result.generatedAt).toBe(NOW.toISOString());
	});

	it('flags in-flight rows only after the cleanup would re-check them', async () => {
		mockRows.mockResolvedValue([
			row({ id: 'young', status: 'uploading', created_at: '2026-10-24T11:58:00.000Z' }),
			row({ id: 'old', status: 'uploading', created_at: '2026-10-24T11:00:00.000Z' }),
			row({ id: 'fresh', status: 'validating', updated_at: '2026-10-24T11:59:30.000Z' }),
			row({ id: 'stuck', status: 'validating', updated_at: '2026-10-24T11:50:00.000Z' }),
		]);

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: false,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
		});

		expect(result.stalled).toEqual({ uploading: 1, validating: 1 });
	});

	it('groups failures by recorded cause and keeps older causeless rejections apart', async () => {
		mockAudit.mockResolvedValue([
			{ id: 6, action: 'upload_refused', metadata: { reason: 'session_files' } },
			{ id: 5, action: 'upload_refused', metadata: { reason: 'session_files' } },
			{ id: 4, action: 'validation_failed', metadata: { reason: 'size_mismatch' } },
			{ id: 3, action: 'validation_failed', metadata: {} },
			{ id: 2, action: 'reservation_abandoned', metadata: {} },
			{ id: 1, action: 'upload_refused', metadata: { reason: 'not-a-reason' } },
		]);

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: false,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
		});

		expect(mockAudit).toHaveBeenCalledWith(
			EVENT_ID,
			['upload_refused', 'validation_failed', 'reservation_abandoned'],
			MEMORIES_DIAGNOSTICS_AUDIT_CAP,
		);
		expect(result.failures).toEqual({ session_files: 2, size_mismatch: 1 });
		expect(result.failuresWithoutReason).toBe(1);
		expect(result.abandoned).toBe(1);
		expect(result.auditTruncated).toBe(false);
	});

	it('reports the audit scan as truncated when it reaches its cap', async () => {
		mockAudit.mockResolvedValue(
			Array.from({ length: MEMORIES_DIAGNOSTICS_AUDIT_CAP }, (_, index) => ({
				id: index,
				action: 'upload_refused',
				metadata: { reason: 'event_capacity' },
			})),
		);

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: false,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
		});

		expect(result.auditTruncated).toBe(true);
	});

	it('carries no session ids, object keys or captions', async () => {
		mockRows.mockResolvedValue([row({ id: 'item-1', status: 'accepted' })]);

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: false,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
		});

		const serialized = JSON.stringify(result);
		expect(serialized).not.toMatch(/session|object_key|objectKey|caption|alias|item-1/);
	});

	it('runs the live checks against the serving origin outside Production', async () => {
		env({ MEMORIES_PRIVATE_UPLOAD_ORIGIN: UPLOAD_ORIGIN });
		const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
			const origin = new Headers(init?.headers).get('origin');
			if (url.endsWith(`/r/${PUBLIC_SLUG}`))
				return new Response('<main data-page="memories"></main>', {
					status: 200,
					headers: { 'cache-control': 'no-store' },
				});
			if (url.endsWith('/r/preflight-no-such-space'))
				return new Response('', { status: 404 });
			if (url.endsWith('/session'))
				return new Response(JSON.stringify({ profile: null }), { status: 200 });
			if (url === `${UPLOAD_ORIGIN}/upload`)
				return origin === LOCAL_ORIGIN
					? new Response(null, {
							status: 204,
							headers: { 'access-control-allow-origin': LOCAL_ORIGIN },
						})
					: new Response(null, { status: 403 });
			return new Response('', { status: 500 });
		});

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: true,
			requestOrigin: `${LOCAL_ORIGIN}/api/dashboard/admin/memories/x/diagnostics`,
			now: NOW,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(result.liveChecks?.map((check) => [check.check, check.status])).toEqual([
			['guest_page', 'PASS'],
			['unknown_slug_fails_closed', 'PASS'],
			['guest_api', 'PASS'],
			['upload_worker_accepts_app_origin', 'PASS'],
			['upload_worker_rejects_other_origins', 'PASS'],
		]);
		expect(fetchImpl.mock.calls.map(([url]) => url)).not.toContain(
			`https://celebra-me.com/r/${PUBLIC_SLUG}`,
		);
	});

	it('skips the upload checks when the Sign Worker origin is not configured', async () => {
		const fetchImpl = jest.fn(async () => new Response('', { status: 500 }));

		const result = await buildMemorySpaceDiagnostics(buildSpace(), {
			live: true,
			requestOrigin: LOCAL_ORIGIN,
			now: NOW,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(result.liveChecks?.find((check) => check.check === 'upload_worker')).toMatchObject({
			status: 'SKIPPED',
		});
		expect(result.liveChecks?.find((check) => check.check === 'guest_page')).toMatchObject({
			status: 'FAIL',
		});
	});
});

describe('resolveLiveCheckOrigins', () => {
	it('checks the printed apex QR and the canonical app in Production', () => {
		env({ VERCEL_ENV: 'production' });
		expect(resolveLiveCheckOrigins('https://celebra-me-abc.vercel.app')).toEqual({
			appOrigin: 'https://www.celebra-me.com',
			qrOrigin: 'https://celebra-me.com',
		});
	});

	it('checks only the serving origin elsewhere', () => {
		env({ VERCEL_ENV: 'preview' });
		expect(resolveLiveCheckOrigins('https://preview.example.test/path')).toEqual({
			appOrigin: 'https://preview.example.test',
			qrOrigin: null,
		});
	});
});
