import { createMockRequest } from '../helpers/api-mocks';
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));
jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

import { GET, PATCH } from '@/pages/api/dashboard/intake/[id]/access';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { ApiError } from '@/lib/rsvp/core/errors';

const mutationAuth = jest.mocked(requireAdminMutationAccess);
const readAuth = jest.mocked(requireAdminStrongSession);
const db = jest.mocked(supabaseRestRequest);
const id = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

const row = {
	invitation_id: id,
	payment_status: 'paid',
	public_access: 'enabled',
	internal_note: null,
	version: 3,
	updated_at: '2026-10-10T12:00:00Z',
	updated_by: adminId,
};

function patch(body: unknown, invitationId = id) {
	return PATCH({
		request: createMockRequest(body),
		params: { id: invitationId },
		cookies: {},
	} as unknown as Parameters<typeof PATCH>[0]);
}

function get(invitationId = id) {
	return GET({
		request: createMockRequest(
			undefined,
			undefined,
			`http://localhost/api/dashboard/intake/${invitationId}/access`,
		),
		params: { id: invitationId },
	} as unknown as Parameters<typeof GET>[0]);
}

describe('PATCH /api/dashboard/intake/[id]/access', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mutationAuth.mockResolvedValue({
			userId: adminId,
			isSuperAdmin: true,
		} as Awaited<ReturnType<typeof requireAdminMutationAccess>>);
		db.mockResolvedValue(row);
	});

	it('marks an invitation paid through the audited RPC with the session actor', async () => {
		const response = await patch({
			action: 'set_payment_status',
			paymentStatus: 'paid',
			expectedVersion: 2,
		});

		expect(response.status).toBe(200);
		expect(mutationAuth).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			'intake:access',
		);
		expect(db).toHaveBeenCalledWith({
			pathWithQuery: 'rpc/set_invitation_access_control',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_invitation_id: id,
				p_expected_version: 2,
				p_actor_id: adminId,
				p_payment_status: 'paid',
				p_public_access: null,
				p_internal_note: null,
			},
		});
		await expect(response.json()).resolves.toEqual({
			item: {
				invitationId: id,
				paymentStatus: 'paid',
				publicAccess: 'enabled',
				internalNote: null,
				version: 3,
				updatedAt: '2026-10-10T12:00:00Z',
				updatedBy: adminId,
			},
		});
	});

	it('disables with a trimmed internal note', async () => {
		await patch({
			action: 'set_public_access',
			publicAccess: 'disabled',
			internalNote: '  Cliente pidió ocultarla ',
			expectedVersion: 3,
		});

		expect(db).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					p_payment_status: null,
					p_public_access: 'disabled',
					p_internal_note: 'Cliente pidió ocultarla',
				}),
			}),
		);
	});

	it('rejects non-administrators before reading the body or touching the database', async () => {
		mutationAuth.mockRejectedValue(new ApiError(403, 'forbidden', 'Solo administradores.'));

		const response = await patch({
			action: 'set_payment_status',
			paymentStatus: 'paid',
			expectedVersion: 1,
		});

		expect(response.status).toBe(403);
		expect(db).not.toHaveBeenCalled();
	});

	it.each([
		[{ action: 'set_payment_status', paymentStatus: 'free', expectedVersion: 1 }],
		[{ action: 'set_payment_status', paymentStatus: 'paid' }],
		[{ action: 'set_payment_status', paymentStatus: 'paid', expectedVersion: 1, version: 9 }],
		[
			{
				action: 'set_public_access',
				publicAccess: 'disabled',
				expectedVersion: 1,
				internalNote: 'x'.repeat(281),
			},
		],
		[{ action: 'set_owner', expectedVersion: 1 }],
	])('rejects an invalid command (%#) before writing', async (body) => {
		const response = await patch(body);
		expect(response.status).toBe(400);
		expect(db).not.toHaveBeenCalled();
	});

	it('rejects an invalid invitation id', async () => {
		const response = await patch(
			{ action: 'set_payment_status', paymentStatus: 'paid', expectedVersion: 1 },
			'not-a-uuid',
		);
		expect(response.status).toBe(400);
		expect(db).not.toHaveBeenCalled();
	});

	it.each([
		['invitation_access_stale', 409],
		['invitation_access_not_found', 404],
		['invitation_access_no_change', 400],
	])('maps %s to %i', async (reason, status) => {
		db.mockRejectedValue(new Error(`Supabase error: {"code":"P0001","message":"${reason}"}`));

		const response = await patch({
			action: 'set_payment_status',
			paymentStatus: 'paid',
			expectedVersion: 1,
		});

		expect(response.status).toBe(status);
		await expect(response.json()).resolves.toMatchObject({ error: { details: { reason } } });
	});
});

describe('GET /api/dashboard/intake/[id]/access', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		readAuth.mockResolvedValue({ userId: adminId, isSuperAdmin: true } as Awaited<
			ReturnType<typeof requireAdminStrongSession>
		>);
	});

	it('returns the access record to an administrator', async () => {
		db.mockResolvedValue([row]);

		const response = await get();

		expect(response.status).toBe(200);
		expect(requireAdminRateLimit).toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			item: { invitationId: id, paymentStatus: 'paid', version: 3 },
		});
	});

	it('answers 404 when the invitation has no access row', async () => {
		db.mockResolvedValue([]);
		expect((await get()).status).toBe(404);
	});

	it('rejects non-administrators', async () => {
		readAuth.mockRejectedValue(new ApiError(403, 'forbidden', 'Solo administradores.'));
		expect((await get()).status).toBe(403);
		expect(db).not.toHaveBeenCalled();
	});
});
