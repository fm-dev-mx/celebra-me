import { DISPOSABLE_TEST, resolveDbUrl } from '../../scripts/db/db-target-config.ts';
import { runCommand } from '../../scripts/db/db-workflow-lib.ts';

/**
 * Real PostgreSQL security-boundary contracts for public guest RSVP.
 * Executed only by the disposable DB harness (`pnpm test:db:rsvp-contracts`).
 * Excluded from the generic no-DB Jest suite via jest.config.cjs.
 */
const dbUrl = resolveDbUrl('disposable-test');
const harnessEnabled = process.env.CELEBRA_RSVP_DB_CONTRACTS === '1';

describe('public guest rsvp postgresql security boundary (real DB)', () => {
	if (!harnessEnabled) {
		it('must run through the disposable RSVP DB contract harness', () => {
			throw new Error(
				'Public RSVP DB boundary contracts require CELEBRA_RSVP_DB_CONTRACTS=1 ' +
					`(pnpm test:db:rsvp-contracts). Expected disposable DB on port ${DISPOSABLE_TEST.dbPort}.`,
			);
		});
		return;
	}

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

	function runSqlAsRole(
		role: string,
		sql: string,
	): { stdout: string; stderr: string; status: number } {
		return runSql(`set role ${role}; ${sql}`);
	}

	it('denies direct service_role INSERT and UPDATE on guest_invitations and guest_invitation_audit', () => {
		const insertRes = runSqlAsRole(
			'service_role',
			"insert into public.guest_invitations (event_id, full_name, short_id) values ('00000000-0000-0000-0000-000000000000', 'Test', 'test');",
		);
		expect(insertRes.status).not.toBe(0);
		expect(insertRes.stderr).toMatch(/permission denied|42501/i);

		const updateRes = runSqlAsRole(
			'service_role',
			"update public.guest_invitations set attendance_status = 'confirmed' where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(updateRes.status).not.toBe(0);
		expect(updateRes.stderr).toMatch(/permission denied|42501/i);

		const auditInsertRes = runSqlAsRole(
			'service_role',
			"insert into public.guest_invitation_audit (guest_invitation_id, actor_type, event_type) values ('00000000-0000-0000-0000-000000000000', 'guest', 'rsvp_submitted');",
		);
		expect(auditInsertRes.status).not.toBe(0);
		expect(auditInsertRes.stderr).toMatch(/permission denied|42501/i);
	});

	it('allows service_role to execute submit_guest_rsvp_public and atomically update guest + insert audit', () => {
		const seedUser = runSql(
			"insert into auth.users (id, aud, role, email, created_at, updated_at) values ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dbtest@example.com', now(), now()) on conflict (id) do nothing;",
		);
		expect(seedUser.status).toBe(0);

		const seedEvent = runSql(
			"insert into public.events (id, owner_user_id, slug, event_type, title, status) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'db-test-event', 'boda', 'Test Wedding', 'published') on conflict (id) do nothing;",
		);
		expect(seedEvent.status).toBe(0);

		const seedGuest = runSql(
			"insert into public.guest_invitations (id, event_id, invite_id, full_name, max_allowed_attendees, attendance_status, attendee_count, short_id, guest_comment) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Maria DB Test', 4, 'pending', 0, 'short123', 'Existing note') on conflict (id) do update set attendance_status = 'pending', attendee_count = 0, guest_comment = 'Existing note';",
		);
		expect(seedGuest.status).toBe(0);

		const auditBefore = runSql(
			"select count(*) from public.guest_invitation_audit where guest_invitation_id = '22222222-2222-2222-2222-222222222222' and event_type = 'status_changed';",
		);
		expect(auditBefore.status).toBe(0);
		const auditBeforeCount = parseInt(auditBefore.stdout.trim(), 10);

		const rsvpRes = runSqlAsRole(
			'service_role',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed', p_attendee_count => 3, p_guest_comment => 'Looking forward to it!', p_response_source => 'link');",
		);
		expect(rsvpRes.status).toBe(0);
		expect(rsvpRes.stdout).toContain('confirmed');
		expect(rsvpRes.stdout).toContain('33333333-3333-3333-3333-333333333333');

		const commentCheck = runSql(
			"select guest_comment from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(commentCheck.status).toBe(0);
		expect(commentCheck.stdout.trim()).toBe('Looking forward to it!');

		const auditAfter = runSql(
			"select count(*) from public.guest_invitation_audit where guest_invitation_id = '22222222-2222-2222-2222-222222222222' and event_type = 'status_changed';",
		);
		expect(auditAfter.status).toBe(0);
		expect(parseInt(auditAfter.stdout.trim(), 10)).toBe(auditBeforeCount + 1);
	});

	it('allows service_role to execute track_guest_invitation_view_public', () => {
		const viewRes = runSqlAsRole(
			'service_role',
			"select public.track_guest_invitation_view_public('33333333-3333-3333-3333-333333333333', 85);",
		);
		expect(viewRes.status).toBe(0);
		expect(viewRes.stdout).toContain('t');

		const guestCheck = runSql(
			"select is_viewed, view_percentage from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(guestCheck.status).toBe(0);
		expect(guestCheck.stdout).toContain('t|85');
	});

	it('denies authenticated and anon execution on submit and track public RPCs', () => {
		const anonSubmit = runSqlAsRole(
			'anon',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed');",
		);
		expect(anonSubmit.status).not.toBe(0);
		expect(anonSubmit.stderr).toMatch(/permission denied|42501/i);

		const authSubmit = runSqlAsRole(
			'authenticated',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed');",
		);
		expect(authSubmit.status).not.toBe(0);
		expect(authSubmit.stderr).toMatch(/permission denied|42501/i);

		const anonTrack = runSqlAsRole(
			'anon',
			"select public.track_guest_invitation_view_public('33333333-3333-3333-3333-333333333333', 10);",
		);
		expect(anonTrack.status).not.toBe(0);
		expect(anonTrack.stderr).toMatch(/permission denied|42501/i);

		const authTrack = runSqlAsRole(
			'authenticated',
			"select public.track_guest_invitation_view_public('33333333-3333-3333-3333-333333333333', 10);",
		);
		expect(authTrack.status).not.toBe(0);
		expect(authTrack.stderr).toMatch(/permission denied|42501/i);
	});

	it('retries the same confirmed RSVP without regressing status or inventing extra guests', () => {
		const first = runSqlAsRole(
			'service_role',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed', p_attendee_count => 2, p_guest_comment => 'Retry me', p_response_source => 'link');",
		);
		expect(first.status).toBe(0);

		const second = runSqlAsRole(
			'service_role',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed', p_attendee_count => 2, p_guest_comment => 'Retry me', p_response_source => 'link');",
		);
		expect(second.status).toBe(0);

		const guestCount = runSql(
			"select count(*) from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(guestCount.status).toBe(0);
		expect(guestCount.stdout.trim()).toBe('1');

		const state = runSql(
			"select attendance_status, attendee_count, guest_comment from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(state.status).toBe(0);
		expect(state.stdout.trim()).toBe('confirmed|2|Retry me');
	});

	it('rolls back guest mutation when capacity validation fails', () => {
		const before = runSql(
			"select attendance_status, attendee_count, guest_comment from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(before.status).toBe(0);
		const beforeRow = before.stdout.trim();

		const overCapacity = runSqlAsRole(
			'service_role',
			"select public.submit_guest_rsvp_public(p_invite_id => '33333333-3333-3333-3333-333333333333', p_attendance_status => 'confirmed', p_attendee_count => 99, p_guest_comment => 'Should not persist', p_response_source => 'link');",
		);
		expect(overCapacity.status).not.toBe(0);
		expect(overCapacity.stderr).toMatch(/attendee_count_exceeds_limit/i);

		const after = runSql(
			"select attendance_status, attendee_count, guest_comment from public.guest_invitations where invite_id = '33333333-3333-3333-3333-333333333333';",
		);
		expect(after.status).toBe(0);
		expect(after.stdout.trim()).toBe(beforeRow);
	});
});
