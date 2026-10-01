import { createHmac } from 'node:crypto';
import { DISPOSABLE_TEST, resolveDbUrl } from '../../scripts/db/db-target-config.ts';
import { runCommand } from '../../scripts/db/db-workflow-lib.ts';
import { disposablePostgrestFetch } from '../helpers/disposable-postgrest-fetch.ts';
import { isApiError } from '../../src/lib/rsvp/core/errors.ts';
import { softDeleteGuestById } from '../../src/lib/rsvp/repositories/guest.repository.ts';
import { supabaseRestRequest } from '../../src/lib/rsvp/repositories/supabase.ts';
import { mapSupabaseErrorToApiError } from '../../src/lib/rsvp/repositories/supabase-errors.ts';
import { deleteDashboardGuest } from '../../src/lib/rsvp/services/dashboard-guests.service.ts';

/**
 * Dashboard guest soft-delete contracts against disposable PostgREST.
 * Executed only by `pnpm test:db:rsvp-contracts` (excluded from no-DB Jest).
 */
const dbUrl = resolveDbUrl('disposable-test');
const harnessEnabled = process.env.CELEBRA_RSVP_DB_CONTRACTS === '1';

// Public Supabase local-development JWT secret used by the disposable PostgREST.
const DISPOSABLE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

const OWNER_ID = 'd1000000-0000-4000-8000-000000000001';
const OUTSIDER_ID = 'd1000000-0000-4000-8000-000000000002';
const EVENT_ID = 'd2000000-0000-4000-8000-000000000001';
const GUEST_RPC = 'd3000000-0000-4000-8000-000000000001';
const GUEST_PROTECTED = 'd3000000-0000-4000-8000-000000000002';
const GUEST_DIRECT_PATCH = 'd3000000-0000-4000-8000-000000000003';
const GUEST_SERVICE_FLOW = 'd3000000-0000-4000-8000-000000000004';

function base64Url(value: string | Buffer): string {
	return Buffer.from(value).toString('base64url');
}

function signUserJwt(userId: string): string {
	const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64Url(
		JSON.stringify({
			sub: userId,
			role: 'authenticated',
			aud: 'authenticated',
			exp: Math.floor(Date.now() / 1000) + 600,
		}),
	);
	const signature = base64Url(
		createHmac('sha256', DISPOSABLE_JWT_SECRET).update(`${header}.${payload}`).digest(),
	);
	return `${header}.${payload}.${signature}`;
}

describe('dashboard guest soft delete (real DB + PostgREST)', () => {
	if (!harnessEnabled) {
		it('must run through the disposable RSVP DB contract harness', () => {
			throw new Error(
				'Dashboard guest soft-delete contracts require CELEBRA_RSVP_DB_CONTRACTS=1 ' +
					`(pnpm test:db:rsvp-contracts). Expected disposable PostgREST on port ${DISPOSABLE_TEST.apiPort}.`,
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
		return { stdout: res.stdout, stderr: res.stderr, status: res.status ?? 1 };
	}

	function isDeleted(guestId: string): boolean {
		const res = runSql(
			`select deleted_at is not null from public.guest_invitations where id = '${guestId}';`,
		);
		expect(res.status).toBe(0);
		return res.stdout.trim() === 't';
	}

	beforeEach(() => {
		global.fetch = disposablePostgrestFetch as unknown as typeof fetch;
	});

	beforeAll(() => {
		const seed = runSql(`
			insert into auth.users (id, aud, role, email, created_at, updated_at) values
				('${OWNER_ID}', 'authenticated', 'authenticated', 'soft-delete-owner@example.test', now(), now()),
				('${OUTSIDER_ID}', 'authenticated', 'authenticated', 'soft-delete-outsider@example.test', now(), now())
			on conflict (id) do nothing;
			insert into public.events (id, owner_user_id, slug, event_type, title, status)
			values ('${EVENT_ID}', '${OWNER_ID}', 'soft-delete-event', 'boda', 'Soft delete event', 'published')
			on conflict (id) do nothing;
			insert into public.guest_invitations (id, event_id, full_name, max_allowed_attendees) values
				('${GUEST_RPC}', '${EVENT_ID}', 'Invitado RPC', 2),
				('${GUEST_PROTECTED}', '${EVENT_ID}', 'Invitado protegido', 2),
				('${GUEST_DIRECT_PATCH}', '${EVENT_ID}', 'Invitado PATCH directo', 2),
				('${GUEST_SERVICE_FLOW}', '${EVENT_ID}', 'Invitado servicio', 2)
			on conflict (id) do update set deleted_at = null;
		`);
		expect(seed.status).toBe(0);
	});

	it('rejects a direct host PATCH of deleted_at with 42501 (SELECT policy hides deleted rows)', async () => {
		const error = await supabaseRestRequest({
			pathWithQuery: `guest_invitations?id=eq.${GUEST_DIRECT_PATCH}&deleted_at=is.null`,
			method: 'PATCH',
			body: { deleted_at: new Date().toISOString() },
			authToken: signUserJwt(OWNER_ID),
			prefer: 'return=minimal',
		}).catch((caught: unknown) => caught);

		expect(error).toMatchObject({ status: 403, code: '42501' });
		expect(mapSupabaseErrorToApiError(error)).toMatchObject({ status: 403, code: 'forbidden' });
		expect(isDeleted(GUEST_DIRECT_PATCH)).toBe(false);
	});

	it('soft-deletes through the service-role RPC and reports repeated deletes', async () => {
		await expect(softDeleteGuestById(GUEST_RPC, OWNER_ID)).resolves.toBe(true);
		expect(isDeleted(GUEST_RPC)).toBe(true);
		await expect(softDeleteGuestById(GUEST_RPC, OWNER_ID)).resolves.toBe(false);
	});

	it('denies an actor without event access inside the RPC and redacts the error', async () => {
		const error = await softDeleteGuestById(GUEST_PROTECTED, OUTSIDER_ID).catch(
			(caught: unknown) => caught,
		);
		expect(error).toMatchObject({ status: 403, code: '42501' });

		const mapped = mapSupabaseErrorToApiError(error);
		expect(mapped).toMatchObject({ status: 403, code: 'forbidden' });
		expect(mapped.message).not.toContain('guest_invitation_access_denied');
		expect(isDeleted(GUEST_PROTECTED)).toBe(false);
	});

	it('client roles cannot call the RPC directly', async () => {
		const error = await supabaseRestRequest({
			pathWithQuery: 'rpc/soft_delete_guest_invitation_v1',
			method: 'POST',
			body: { p_guest_id: GUEST_PROTECTED, p_actor_user_id: OWNER_ID },
			authToken: signUserJwt(OWNER_ID),
		}).catch((caught: unknown) => caught);

		expect(error).toMatchObject({ code: '42501' });
		expect(isDeleted(GUEST_PROTECTED)).toBe(false);
	});

	it('deleteDashboardGuest deletes for the owner and hides the guest afterwards', async () => {
		const ownerJwt = signUserJwt(OWNER_ID);
		await expect(
			deleteDashboardGuest({
				guestId: GUEST_SERVICE_FLOW,
				hostAccessToken: ownerJwt,
				actorUserId: OWNER_ID,
			}),
		).resolves.toBeUndefined();
		expect(isDeleted(GUEST_SERVICE_FLOW)).toBe(true);

		const visible = await supabaseRestRequest<unknown[]>({
			pathWithQuery: `guest_invitations?select=id&id=eq.${GUEST_SERVICE_FLOW}`,
			authToken: ownerJwt,
		});
		expect(visible).toEqual([]);
	});

	it('deleteDashboardGuest returns 403 for a host without access to the event', async () => {
		const error = await deleteDashboardGuest({
			guestId: GUEST_PROTECTED,
			hostAccessToken: signUserJwt(OUTSIDER_ID),
			actorUserId: OUTSIDER_ID,
		}).catch((caught: unknown) => caught);

		expect(isApiError(error)).toBe(true);
		expect(error).toMatchObject({ status: 403, code: 'forbidden' });
		expect(isDeleted(GUEST_PROTECTED)).toBe(false);
	});
});
