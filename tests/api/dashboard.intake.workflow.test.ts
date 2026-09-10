import { createMockRequest } from '../helpers/api-mocks';
jest.mock('@/lib/rsvp/auth/authorization', () => ({ requireAdminMutationAccess: jest.fn() }));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

import { PATCH } from '@/pages/api/dashboard/intake/[id]/workflow';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const auth = jest.mocked(requireAdminMutationAccess);
const db = jest.mocked(supabaseRestRequest);
const id = '11111111-1111-4111-8111-111111111111';
const expectedUpdatedAt = '2026-09-10T12:00:00.000Z';

function invoke(body: unknown) {
	return PATCH({
		request: createMockRequest(body),
		params: { id },
		cookies: {},
	} as unknown as Parameters<typeof PATCH>[0]);
}

describe('workflow mutations', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		auth.mockResolvedValue({
			userId: id,
			email: 'celebra.me.com@gmail.com',
			isSuperAdmin: true,
		} as Awaited<ReturnType<typeof requireAdminMutationAccess>>);
		db.mockResolvedValue([{ id }]);
	});
	it.each(['confirm_review', 'clear_review'])(
		'rejects %s from another administrator',
		async (action) => {
			auth.mockResolvedValue({
				userId: id,
				email: 'preview@preview.com',
				isSuperAdmin: true,
			} as Awaited<ReturnType<typeof requireAdminMutationAccess>>);
			expect((await invoke({ action, expectedUpdatedAt })).status).toBe(403);
			expect(db).not.toHaveBeenCalled();
		},
	);
	it('clears both review fields without changing work', async () => {
		expect((await invoke({ action: 'clear_review', expectedUpdatedAt })).status).toBe(200);
		expect(db).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { owner_reviewed_at: null, owner_reviewed_by: null },
			}),
		);
	});
	it('allows administrative work changes without review or CI', async () => {
		expect(
			(
				await invoke({
					action: 'set_work_status',
					workStatus: 'completed',
					expectedUpdatedAt,
				})
			).status,
		).toBe(200);
		expect(db).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { work_status: 'completed' },
				pathWithQuery: expect.stringContaining('updated_at=eq.'),
			}),
		);
	});
	it('attributes review to the authenticated owner on the server', async () => {
		expect((await invoke({ action: 'confirm_review', expectedUpdatedAt })).status).toBe(200);
		expect(db).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { owner_reviewed_by: id, owner_reviewed_at: expect.any(String) },
			}),
		);
	});
	it('does not silently succeed when the row has changed', async () => {
		db.mockResolvedValue([]);
		expect((await invoke({ action: 'clear_review', expectedUpdatedAt })).status).toBe(409);
	});
	it('rejects forged attribution before writing', async () => {
		expect(
			(
				await invoke({
					action: 'confirm_review',
					expectedUpdatedAt,
					ownerReviewedAt: expectedUpdatedAt,
				})
			).status,
		).toBe(400);
		expect(db).not.toHaveBeenCalled();
	});
});
