import http from 'node:http';
import { Request as NodeRequest } from 'undici';
import { DISPOSABLE_TEST, resolveDbUrl } from '../../scripts/db/db-target-config.ts';
import { runCommand } from '../../scripts/db/db-workflow-lib.ts';

/** Use undici Request so body is a proper ReadableStream under the jsdom test environment. */
function nodeRequest(input: string, init?: ConstructorParameters<typeof NodeRequest>[1]): Request {
	return new NodeRequest(input, init) as unknown as Request;
}

/**
 * HTTP → service → RPC wiring contracts against disposable PostgREST.
 * Executed only by `pnpm test:db:rsvp-contracts` (excluded from no-DB Jest).
 */
function realHttpFetch(urlStr: string | URL, options: any = {}): Promise<any> {
	return new Promise((resolve, reject) => {
		const url = typeof urlStr === 'string' ? new URL(urlStr) : new URL(urlStr.toString());
		// Disposable PostgREST serves the API at `/` (not Kong's `/rest/v1` prefix).
		if (url.pathname.startsWith('/rest/v1/')) {
			url.pathname = url.pathname.slice('/rest/v1'.length);
		}
		const req = http.request(
			{
				hostname: url.hostname,
				port: url.port,
				path: url.pathname + url.search,
				method: options.method || 'GET',
				headers: options.headers || {},
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					const statusCode = res.statusCode || 200;
					resolve({
						ok: statusCode >= 200 && statusCode < 300,
						status: statusCode,
						headers: {
							get: (h: string) => res.headers[h.toLowerCase()],
						},
						text: async () => data,
						json: async () => (data ? JSON.parse(data) : {}),
					});
				});
			},
		);
		req.on('error', reject);
		if (options.body) req.write(options.body);
		req.end();
	});
}

const disposableApi = `http://127.0.0.1:${DISPOSABLE_TEST.apiPort}`;
process.env.SUPABASE_URL = process.env.SUPABASE_URL || disposableApi;
process.env.PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || disposableApi;
process.env.SUPABASE_ANON_KEY =
	process.env.SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

import { POST as rsvpPost } from '../../src/pages/api/invitacion/[inviteId]/rsvp.ts';
import { POST as viewPost } from '../../src/pages/api/invitacion/[inviteId]/view.ts';

const dbUrl = resolveDbUrl('disposable-test');
const harnessEnabled = process.env.CELEBRA_RSVP_DB_CONTRACTS === '1';

describe('public rsvp & view HTTP API wiring (real DB)', () => {
	if (!harnessEnabled) {
		it('must run through the disposable RSVP DB contract harness', () => {
			throw new Error(
				'Public RSVP HTTP wiring contracts require CELEBRA_RSVP_DB_CONTRACTS=1 ' +
					`(pnpm test:db:rsvp-contracts). Expected disposable PostgREST on port ${DISPOSABLE_TEST.apiPort}.`,
			);
		});
		return;
	}

	beforeEach(() => {
		global.fetch = realHttpFetch as any;
	});

	function runSql(sql: string): { stdout: string; stderr: string; status: number } {
		const res = runCommand(
			'psql',
			[
				'--set',
				'ON_ERROR_STOP=1',
				'--tuples-only',
				'--no-align',
				'--dbname',
				dbUrl,
				'--command',
				sql,
			],
			{ redact: [dbUrl], throwOnError: false },
		);
		return {
			stdout: res.stdout,
			stderr: res.stderr,
			status: res.status ?? 1,
		};
	}

	const testInviteId = '44444444-4444-4444-4444-444444444444';
	const testGuestId = '55555555-5555-5555-5555-555555555555';
	const testEventId = '66666666-6666-6666-6666-666666666666';

	beforeAll(() => {
		const seedUser = runSql(
			"insert into auth.users (id, aud, role, email, created_at, updated_at) values ('00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'httpdb@example.com', now(), now()) on conflict (id) do nothing;",
		);
		expect(seedUser.status).toBe(0);
		const seedEvent = runSql(
			`insert into public.events (id, owner_user_id, slug, event_type, title, status) values ('${testEventId}', '00000000-0000-0000-0000-000000000010', 'http-test-event', 'boda', 'HTTP Test Event', 'published') on conflict (id) do nothing;`,
		);
		expect(seedEvent.status).toBe(0);
		const seedGuest = runSql(
			`insert into public.guest_invitations (id, event_id, invite_id, full_name, max_allowed_attendees, attendance_status, attendee_count, short_id) values ('${testGuestId}', '${testEventId}', '${testInviteId}', 'Juan Perez HTTP', 4, 'pending', 0, 'short456') on conflict (id) do update set attendance_status = 'pending', attendee_count = 0;`,
		);
		expect(seedGuest.status).toBe(0);
	});

	it('submits RSVP via HTTP API route and atomically updates DB without 42501 permission error', async () => {
		const request = nodeRequest(`http://localhost/api/invitacion/${testInviteId}/rsvp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: 'Nos vemos pronto!',
			}),
		});

		const response = await rsvpPost({
			params: { inviteId: testInviteId },
			request,
		} as any);

		const json = await response.json();
		expect(response.status).toBe(200);
		expect(json.success).toBe(true);
		expect(json.data.attendanceStatus).toBe('confirmed');
		expect(json.data.attendeeCount).toBe(2);
		expect(json.data.inviteId).toBe(testInviteId);

		const dbCheck = runSql(
			`select attendance_status, attendee_count from public.guest_invitations where invite_id = '${testInviteId}';`,
		);
		expect(dbCheck.status).toBe(0);
		expect(dbCheck.stdout).toContain('confirmed|2');

		const auditCheck = runSql(
			`select count(*) from public.guest_invitation_audit where guest_invitation_id = '${testGuestId}' and event_type = 'status_changed';`,
		);
		expect(auditCheck.status).toBe(0);
		expect(parseInt(auditCheck.stdout.trim(), 10)).toBeGreaterThanOrEqual(1);
	});

	it('tracks invitation view via HTTP API route and updates DB telemetry', async () => {
		const request = nodeRequest(`http://localhost/api/invitacion/${testInviteId}/view`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				viewPercentage: 95,
			}),
		});

		const response = await viewPost({
			params: { inviteId: testInviteId },
			request,
		} as any);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.message).toBe('View recorded.');

		const dbCheck = runSql(
			`select is_viewed, view_percentage from public.guest_invitations where invite_id = '${testInviteId}';`,
		);
		expect(dbCheck.status).toBe(0);
		expect(dbCheck.stdout).toContain('t|95');
	});
});
