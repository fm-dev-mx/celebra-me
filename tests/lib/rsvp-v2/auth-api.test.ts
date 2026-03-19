import {
	findAuthUserByEmail,
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

	it('sends magic link and finds auth user by email', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ message_id: 'msg-1' }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					users: [{ id: 'u-admin', email: 'admin@test.com' }],
				}),
			}) as typeof fetch;

		const magic = await sendMagicLink({
			email: 'admin@test.com',
			redirectTo: 'http://localhost/dashboard/invitados',
		});
		const user = await findAuthUserByEmail({
			email: 'admin@test.com',
		});

		expect(magic.message_id).toBe('msg-1');
		expect(user?.id).toBe('u-admin');
	});
});
