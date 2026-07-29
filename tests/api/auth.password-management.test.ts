import { generateTemporaryPassword } from '@/lib/rsvp/services/user-admin.service';
import { POST as resetPasswordAdmin } from '@/pages/api/dashboard/admin/users/reset-password';
import { POST as changePassword } from '@/pages/api/auth/change-password';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as authorization from '@/lib/rsvp/auth/authorization';
import * as auth from '@/lib/rsvp/auth/auth';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	signInWithPassword: jest.fn(),
	updateUserPasswordUserAuth: jest.fn(),
	adminSetUserMustChangePassword: jest.fn(),
	adminResetAuthUserPassword: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn(),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireSessionContext: jest.fn(),
}));

describe('Password Management & Recovery', () => {
	const signInWithPasswordMock = authApi.signInWithPassword as jest.MockedFunction<
		typeof authApi.signInWithPassword
	>;
	const updateUserPasswordUserAuthMock = authApi.updateUserPasswordUserAuth as jest.MockedFunction<
		typeof authApi.updateUserPasswordUserAuth
	>;
	const adminSetUserMustChangePasswordMock = authApi.adminSetUserMustChangePassword as jest.MockedFunction<
		typeof authApi.adminSetUserMustChangePassword
	>;
	const adminResetAuthUserPasswordMock = authApi.adminResetAuthUserPassword as jest.MockedFunction<
		typeof authApi.adminResetAuthUserPassword
	>;
	const requireAdminMutationAccessMock = authorization.requireAdminMutationAccess as jest.MockedFunction<
		typeof authorization.requireAdminMutationAccess
	>;
	const requireSessionContextMock = auth.requireSessionContext as jest.MockedFunction<
		typeof auth.requireSessionContext
	>;

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('1. Temporary Password Generator Contract', () => {
		it('generates short memorable Word-####! temporary passwords', () => {
			const passwords = new Set<string>();
			const pattern = /^[A-Z][a-z]+-\d{4}[!@#$%*]$/;

			for (let i = 0; i < 20; i += 1) {
				const password = generateTemporaryPassword();
				passwords.add(password);

				expect(password).toMatch(pattern);
				expect(password.length).toBeLessThanOrEqual(16);
				expect(password).not.toContain('client2026');
				expect(password).not.toContain('celebra2026');
			}

			expect(passwords.size).toBe(20);
		});
	});

	describe('2. SuperAdmin Reset Password API (/api/dashboard/admin/users/reset-password)', () => {
		it('resets user password when invoked by an authorized SuperAdmin', async () => {
			requireAdminMutationAccessMock.mockResolvedValue({
				userId: 'super-admin-1',
				email: 'admin@celebra.me',
				accessToken: 'admin-token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			adminResetAuthUserPasswordMock.mockResolvedValue({
				id: 'target-user-1',
				email: 'client@example.com',
			});

			const response = await resetPasswordAdmin({
				request: createMockRequest(
					{ userId: '550e8400-e29b-41d4-a716-446655440000' },
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/dashboard/admin/users/reset-password',
				),
				cookies: {} as never,
			} as never);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.userId).toBe('target-user-1');
			expect(body.credentials.temporaryPassword).toBeDefined();
			expect(body.credentials.temporaryPassword).toMatch(
				/^[A-Z][a-z]+-\d{4}[!@#$%*]$/,
			);
			expect(adminResetAuthUserPasswordMock).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: '550e8400-e29b-41d4-a716-446655440000',
					mustChangePassword: true,
				}),
			);
		});

		it('rejects reset attempts when authorization fails', async () => {
			requireAdminMutationAccessMock.mockRejectedValue(
				new ApiError(401, 'unauthorized', 'Unauthorized.'),
			);

			const response = await resetPasswordAdmin({
				request: createMockRequest(
					{ userId: '550e8400-e29b-41d4-a716-446655440000' },
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/dashboard/admin/users/reset-password',
				),
				cookies: {} as never,
			} as never);

			expect(response.status).toBe(401);
		});
	});

	describe('3. Authenticated Password Change API (/api/auth/change-password)', () => {
		it('successfully changes password and clears must_change_password flag', async () => {
			requireSessionContextMock.mockResolvedValue({
				userId: 'user-123',
				email: 'client@example.com',
				accessToken: 'current-token',
				role: 'host_client',
				isSuperAdmin: false,
				mustChangePassword: true,
			});

			signInWithPasswordMock
				.mockResolvedValueOnce({
					access_token: 'valid-current-token',
					refresh_token: 'refresh-token',
					user: { id: 'user-123', email: 'client@example.com' },
				})
				.mockResolvedValueOnce({
					access_token: 'fresh-new-token',
					refresh_token: 'fresh-refresh-token',
					user: { id: 'user-123', email: 'client@example.com' },
				});

			updateUserPasswordUserAuthMock.mockResolvedValue({
				id: 'user-123',
				email: 'client@example.com',
			});

			adminSetUserMustChangePasswordMock.mockResolvedValue({
				id: 'user-123',
				email: 'client@example.com',
			});

			const response = await changePassword({
				request: createMockRequest(
					{
						currentPassword: 'CurrentTempPass123!',
						newPassword: 'NewSecurePassword2026!',
						confirmPassword: 'NewSecurePassword2026!',
					},
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/auth/change-password',
				),
				url: new URL('http://localhost:4321/api/auth/change-password'),
			} as never);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.ok).toBe(true);
			expect(body.next).toBe('/dashboard/invitados');

			expect(updateUserPasswordUserAuthMock).toHaveBeenCalledWith({
				accessToken: 'current-token',
				password: 'NewSecurePassword2026!',
			});

			expect(adminSetUserMustChangePasswordMock).toHaveBeenCalledWith({
				userId: 'user-123',
				mustChangePassword: false,
			});
		});

		it('rejects password change when current password is incorrect', async () => {
			requireSessionContextMock.mockResolvedValue({
				userId: 'user-123',
				email: 'client@example.com',
				accessToken: 'current-token',
				role: 'host_client',
				isSuperAdmin: false,
				mustChangePassword: true,
			});

			signInWithPasswordMock.mockRejectedValue(new Error('Supabase auth error (401).'));

			const response = await changePassword({
				request: createMockRequest(
					{
						currentPassword: 'WrongPassword!',
						newPassword: 'NewSecurePassword2026!',
						confirmPassword: 'NewSecurePassword2026!',
					},
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/auth/change-password',
				),
				url: new URL('http://localhost:4321/api/auth/change-password'),
			} as never);

			expect(response.status).toBe(401);
			const body = await response.json();
			expect(body.error.message).toBe('La contraseña actual es incorrecta.');
		});

		it('rejects password change when password confirmation does not match', async () => {
			requireSessionContextMock.mockResolvedValue({
				userId: 'user-123',
				email: 'client@example.com',
				accessToken: 'current-token',
				role: 'host_client',
				isSuperAdmin: false,
				mustChangePassword: true,
			});

			const response = await changePassword({
				request: createMockRequest(
					{
						currentPassword: 'CurrentTempPass123!',
						newPassword: 'NewSecurePassword2026!',
						confirmPassword: 'DifferentPassword2026!',
					},
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/auth/change-password',
				),
				url: new URL('http://localhost:4321/api/auth/change-password'),
			} as never);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.message).toBe('Las contraseñas no coinciden');
		});

		it('fails closed when password updates but must_change_password cleanup fails', async () => {
			requireSessionContextMock.mockResolvedValue({
				userId: 'user-123',
				email: 'client@example.com',
				accessToken: 'current-token',
				role: 'host_client',
				isSuperAdmin: false,
				mustChangePassword: true,
			});

			signInWithPasswordMock.mockResolvedValue({
				access_token: 'valid-current-token',
				refresh_token: 'refresh-token',
				user: { id: 'user-123', email: 'client@example.com' },
			});
			updateUserPasswordUserAuthMock.mockResolvedValue({
				id: 'user-123',
				email: 'client@example.com',
			});
			adminSetUserMustChangePasswordMock.mockRejectedValue(
				new Error('Supabase auth error (500).'),
			);

			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			const response = await changePassword({
				request: createMockRequest(
					{
						currentPassword: 'CurrentTempPass123!',
						newPassword: 'NewSecurePassword2026!',
						confirmPassword: 'NewSecurePassword2026!',
					},
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/auth/change-password',
				),
				url: new URL('http://localhost:4321/api/auth/change-password'),
			} as never);

			expect(response.status).toBe(500);
			const body = await response.json();
			expect(body.error.code).toBe('metadata_update_failed');
			expect(body.error.message).toContain('desbloquear');
			expect(JSON.stringify(body)).not.toMatch(/CurrentTempPass|NewSecurePassword/);
			expect(updateUserPasswordUserAuthMock).toHaveBeenCalled();
			expect(adminSetUserMustChangePasswordMock).toHaveBeenCalledWith({
				userId: 'user-123',
				mustChangePassword: false,
			});
			// No unlock re-auth / session cookies after partial failure.
			expect(signInWithPasswordMock).toHaveBeenCalledTimes(1);

			consoleErrorSpy.mockRestore();
		});

		it('does not mutate credentials when current password verification fails', async () => {
			requireSessionContextMock.mockResolvedValue({
				userId: 'user-123',
				email: 'client@example.com',
				accessToken: 'current-token',
				role: 'host_client',
				isSuperAdmin: false,
				mustChangePassword: true,
			});

			signInWithPasswordMock.mockRejectedValue(new Error('Supabase auth error (401).'));

			const response = await changePassword({
				request: createMockRequest(
					{
						currentPassword: 'WrongPassword!',
						newPassword: 'NewSecurePassword2026!',
						confirmPassword: 'NewSecurePassword2026!',
					},
					{ Origin: 'http://localhost:4321', Host: 'localhost:4321' },
					'http://localhost:4321/api/auth/change-password',
				),
				url: new URL('http://localhost:4321/api/auth/change-password'),
			} as never);

			expect(response.status).toBe(401);
			expect(updateUserPasswordUserAuthMock).not.toHaveBeenCalled();
			expect(adminSetUserMustChangePasswordMock).not.toHaveBeenCalled();
		});
	});
});
