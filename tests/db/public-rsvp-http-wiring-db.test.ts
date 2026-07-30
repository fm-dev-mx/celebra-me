import http from 'node:http';
import { resolveDbUrl } from '../../scripts/db/db-target-config.ts';
import { runCommand } from '../../scripts/db/db-workflow-lib.ts';

// Real HTTP fetch implementation using node:http to reach local PostgREST/Supabase
function realHttpFetch(urlStr: string | URL, options: any = {}): Promise<any> {
	return new Promise((resolve, reject) => {
		const url = typeof urlStr === 'string' ? new URL(urlStr) : urlStr;
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

// Set up local environment variables before loading API routes
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY =
	process.env.SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

import { POST as rsvpPost } from '../../src/pages/api/invitacion/[inviteId]/rsvp.ts';
import { POST as viewPost } from '../../src/pages/api/invitacion/[inviteId]/view.ts';

const dbUrl = resolveDbUrl('persistent-local');

describe('public rsvp & view HTTP API wiring (real DB)', () => {
	if (!dbUrl) {
		it.skip('skips real DB tests when persistent-local DB is unavailable', () => {});
		return;
	}

	beforeEach(() => {
		// Use realHttpFetch to route API repository calls to local Supabase PostgREST
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
		// Seed dummy user, event, and guest invitations in clean database
		runSql(
			"insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000000', 'httpdb@example.com') on conflict (id) do nothing;",
		);
		runSql(
			`insert into public.events (id, owner_user_id, slug, event_type, title, status) values ('${testEventId}', '00000000-0000-0000-0000-000000000000', 'http-test-event', 'boda', 'HTTP Test Event', 'published') on conflict (id) do nothing;`,
		);
		runSql(
			`insert into public.guest_invitations (id, event_id, invite_id, full_name, max_allowed_attendees, attendance_status, attendee_count, short_id) values ('${testGuestId}', '${testEventId}', '${testInviteId}', 'Juan Perez HTTP', 4, 'pending', 0, 'short456') on conflict (id) do update set attendance_status = 'pending', attendee_count = 0;`,
		);
	});

	it('submits RSVP via HTTP API route and atomically updates DB without 42501 permission error', async () => {
		const request = new Request(`http://localhost/api/invitacion/${testInviteId}/rsvp`, {
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

		// Reverify database row updated correctly
		const dbCheck = runSql(
			`select attendance_status, attendee_count from public.guest_invitations where invite_id = '${testInviteId}';`,
		);
		expect(dbCheck.status).toBe(0);
		expect(dbCheck.stdout).toContain('confirmed|2');

		// Reverify guest audit log inserted
		const auditCheck = runSql(
			`select count(*) from public.guest_invitation_audit where guest_invitation_id = '${testGuestId}' and event_type = 'status_changed';`,
		);
		expect(auditCheck.status).toBe(0);
		expect(parseInt(auditCheck.stdout.trim(), 10)).toBeGreaterThanOrEqual(1);
	});

	it('tracks invitation view via HTTP API route and updates DB telemetry', async () => {
		const request = new Request(`http://localhost/api/invitacion/${testInviteId}/view`, {
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

		// Reverify database telemetry fields updated
		const dbCheck = runSql(
			`select is_viewed, view_percentage from public.guest_invitations where invite_id = '${testInviteId}';`,
		);
		expect(dbCheck.status).toBe(0);
		expect(dbCheck.stdout).toContain('t|95');
	});
});
