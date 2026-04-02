import {
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	sendMagicLink,
	signInWithPassword,
	signUpWithPassword,
} from '@/lib/rsvp/auth/auth-api';

describe('rsvp authApi', () => {
	const originalFetch = global.fetch;
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env.SUPABASE_URL = 'https://project.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
	});

	afterEach(() => {
		global.fetch = originalFetch;
		process.env = { ...originalEnv };
		jest.restoreAllMocks();
	});

	it('signs in and signs up with expected auth payloads', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: 'token',
					refresh_token: 'refresh',
					user: { id: 'u1', email: 'a@b.com' },
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					user: { id: 'u2', email: 'c@d.com' },
				}),
			}) as typeof fetch;

		const login = await signInWithPassword({
			email: 'a@b.com',
			password: 'Pass123!',
		});
		const signup = await signUpWithPassword({
			email: 'c@d.com',
			password: 'Pass456!',
		});

		expect(login.user.id).toBe('u1');
		expect(signup.user?.id).toBe('u2');
	});

	it('sends magic link and finds auth users by email or login alias', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ message_id: 'msg-1' }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					users: [
						{
							id: 'u-admin',
							email: 'admin@test.com',
							user_metadata: { login_alias: 'admin' },
						},
					],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					users: [
						{
							id: 'u-admin',
							email: 'admin@test.com',
							user_metadata: { login_alias: 'admin' },
						},
					],
				}),
			}) as typeof fetch;

		const magic = await sendMagicLink({
			email: 'admin@test.com',
			redirectTo: 'http://localhost/dashboard/invitados',
		});
		const user = await findAuthUserByEmail({
			email: 'admin@test.com',
		});
		const userByAlias = await findAuthUserByLoginIdentifier({
			identifier: 'admin',
		});

		expect(magic.message_id).toBe('msg-1');
		expect(user?.id).toBe('u-admin');
		expect(userByAlias?.login_alias).toBe('admin');
	});

	it('creates auth users through the admin API with the service role key', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				user: {
					id: 'u-created',
					email: 'created@test.com',
					created_at: '2026-04-01T00:00:00.000Z',
					user_metadata: { login_alias: 'ximena_meza' },
				},
			}),
		}) as typeof fetch;

		const user = await createAuthUserByAdmin({
			email: 'created@test.com',
			password: 'TempPass123!',
			loginAlias: 'ximena_meza',
		});

		expect(global.fetch).toHaveBeenCalledWith(
			'https://project.supabase.co/auth/v1/admin/users',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					apikey: 'service',
					Authorization: 'Bearer service',
				}),
				body: JSON.stringify({
					email: 'created@test.com',
					password: 'TempPass123!',
					email_confirm: true,
					user_metadata: {
						login_alias: 'ximena_meza',
					},
				}),
			}),
		);
		expect(user).toEqual({
			id: 'u-created',
			email: 'created@test.com',
			created_at: '2026-04-01T00:00:00.000Z',
			login_alias: 'ximena_meza',
		});
	});
});
