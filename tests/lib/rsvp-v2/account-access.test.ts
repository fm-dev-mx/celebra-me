import { verifyUserRoleSynchronization } from '@/lib/rsvp/services/account-access.service';
import { getAuthUserAdminById } from '@/lib/rsvp/auth/auth-api';
import { AuthRequestError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({ getAuthUserAdminById: jest.fn() }));

it.each([undefined, 'super_admin', 'unknown'])(
	'rejects missing or mismatched Auth role %s',
	async (role) => {
		jest.mocked(getAuthUserAdminById).mockResolvedValueOnce({
			id: 'synthetic-user',
			app_metadata: { role },
		});
		await expect(
			verifyUserRoleSynchronization('synthetic-user', 'host_client'),
		).rejects.toMatchObject({ status: 409, code: 'account_access_incomplete' });
	},
);

it('preserves transient provider errors instead of declaring the role missing', async () => {
	const failure = new AuthRequestError({ kind: 'timeout', operation: 'get_user_admin' });
	jest.mocked(getAuthUserAdminById).mockRejectedValueOnce(failure);
	await expect(verifyUserRoleSynchronization('synthetic-user', 'host_client')).rejects.toBe(
		failure,
	);
});
