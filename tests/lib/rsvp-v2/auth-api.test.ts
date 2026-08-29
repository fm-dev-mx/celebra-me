import {
	AUTH_REQUEST_TIMEOUT_MS,
	adminResetAuthUserPassword,
	adminSetUserMustChangePassword,
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	getAuthUserByAccessToken,
	refreshAccessToken,
	sendMagicLink,
	signInWithPassword,
	signUpWithPassword,
} from '@/lib/rsvp/auth/auth-api';
import { AuthRequestError } from '@/lib/rsvp/core/errors';

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
			}) as unknown as typeof fetch;

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
			}) as unknown as typeof fetch;

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
					app_metadata: {
						must_change_password: true,
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

	it('preserves unrelated app_metadata when resetting password and clearing must_change_password', async () => {
		const existingUser = {
			id: 'u-existing',
			email: 'existing@test.com',
			app_metadata: {
				role: 'host_client',
				custom_flag: 'keep-me',
				must_change_password: false,
			},
		};

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => existingUser,
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					user: {
						id: 'u-existing',
						email: 'existing@test.com',
						app_metadata: {
							role: 'host_client',
							custom_flag: 'keep-me',
							must_change_password: true,
						},
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					...existingUser,
					app_metadata: {
						role: 'host_client',
						custom_flag: 'keep-me',
						must_change_password: true,
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					user: {
						id: 'u-existing',
						email: 'existing@test.com',
					},
				}),
			}) as typeof fetch;

		await adminResetAuthUserPassword({
			userId: 'u-existing',
			password: 'TempSecurePass!234',
			mustChangePassword: true,
		});

		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'https://project.supabase.co/auth/v1/admin/users/u-existing',
			expect.objectContaining({
				method: 'PUT',
				body: JSON.stringify({
					app_metadata: {
						role: 'host_client',
						custom_flag: 'keep-me',
						must_change_password: true,
					},
					password: 'TempSecurePass!234',
				}),
			}),
		);

		await adminSetUserMustChangePassword({
			userId: 'u-existing',
			mustChangePassword: false,
		});

		expect(global.fetch).toHaveBeenNthCalledWith(
			4,
			'https://project.supabase.co/auth/v1/admin/users/u-existing',
			expect.objectContaining({
				method: 'PUT',
				body: JSON.stringify({
					app_metadata: {
						role: 'host_client',
						custom_flag: 'keep-me',
						must_change_password: false,
					},
				}),
			}),
		);
	});

	describe('transport failures and observability', () => {
		it.each([400, 401, 403, 429, 500, 502, 503])(
			'classifies HTTP %s without reading its body',
			async (status) => {
				const text = jest.fn();
				global.fetch = jest
					.fn()
					.mockResolvedValue({ ok: false, status, text }) as typeof fetch;

				await expect(
					signInWithPassword({ email: 'safe@test.com', password: 'Password123!' }),
				).rejects.toMatchObject({
					name: 'AuthRequestError',
					kind: 'http',
					operation: 'password_sign_in',
					status,
					retryable: status === 429 || status >= 500,
				});
				expect(text).not.toHaveBeenCalled();
			},
		);

		it.each([
			['empty body', () => Promise.reject(new SyntaxError('Unexpected end'))],
			['malformed body', () => Promise.resolve({ access_token: 'missing-fields' })],
		])('classifies a successful %s as invalid_response', async (_label, json) => {
			global.fetch = jest
				.fn()
				.mockResolvedValue({ ok: true, status: 200, json }) as typeof fetch;

			await expect(
				signInWithPassword({ email: 'safe@test.com', password: 'Password123!' }),
			).rejects.toMatchObject({
				kind: 'invalid_response',
				operation: 'password_sign_in',
				status: 200,
				retryable: true,
			});
		});

		it('classifies network and externally aborted requests without leaking their causes', async () => {
			for (const failure of [
				new TypeError('getaddrinfo ENOTFOUND secret-host.example'),
				new DOMException('aborted with secret-token', 'AbortError'),
			]) {
				global.fetch = jest.fn().mockRejectedValue(failure) as typeof fetch;
				await expect(getAuthUserByAccessToken('secret-token')).rejects.toMatchObject({
					kind: 'network',
					operation: 'validate_access_token',
					retryable: true,
					message: 'Auth request failed.',
				});
			}
		});

		it('aborts a stalled request at 5,000 ms and clears its timer', async () => {
			jest.useFakeTimers();
			global.fetch = jest.fn((_url, init) => {
				return new Promise((_resolve, reject) => {
					(init?.signal as AbortSignal).addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'));
					});
				});
			}) as typeof fetch;

			const pending = refreshAccessToken({ refreshToken: 'refresh-secret' });
			const rejection = expect(pending).rejects.toMatchObject({
				kind: 'timeout',
				operation: 'refresh_session',
				retryable: true,
			});
			await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS - 1);
			expect(global.fetch).toHaveBeenCalledTimes(1);
			await jest.advanceTimersByTimeAsync(1);

			await rejection;
			expect(jest.getTimerCount()).toBe(0);
			jest.useRealTimers();
		});

		it('aborts when response-body consumption stalls', async () => {
			jest.useFakeTimers();
			global.fetch = jest.fn((_url, init) => {
				const signal = init?.signal as AbortSignal;
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						new Promise((_resolve, reject) => {
							signal.addEventListener('abort', () => {
								reject(new DOMException('Aborted', 'AbortError'));
							});
						}),
				});
			}) as unknown as typeof fetch;

			const pending = signInWithPassword({
				email: 'safe@test.com',
				password: 'Password123!',
			});
			const rejection = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
			await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

			await rejection;
			expect(jest.getTimerCount()).toBe(0);
			jest.useRealTimers();
		});

		it('does not accept a body that resolves after the deadline', async () => {
			jest.useFakeTimers();
			let resolveBody!: (value: unknown) => void;
			global.fetch = jest.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => new Promise((resolve) => (resolveBody = resolve)),
			}) as unknown as typeof fetch;

			const pending = signInWithPassword({
				email: 'safe@test.com',
				password: 'Password123!',
			});
			const rejection = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
			await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
			resolveBody({
				access_token: 'late-access',
				refresh_token: 'late-refresh',
				user: { id: 'late-user' },
			});

			await rejection;
			jest.useRealTimers();
		});

		it('emits exactly one sanitized event for success and failure', async () => {
			const log = jest.spyOn(console, 'info').mockImplementation(() => {});
			global.fetch = jest
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: async () => ({
						access_token: 'secret-access',
						refresh_token: 'secret-refresh',
						user: { id: 'secret-user-id', email: 'private@example.com' },
					}),
				})
				.mockResolvedValueOnce({ ok: false, status: 503 }) as typeof fetch;

			await signInWithPassword({ email: 'private@example.com', password: 'SecretPassword!' });
			await expect(sendMagicLink({ email: 'private@example.com' })).rejects.toBeInstanceOf(
				AuthRequestError,
			);

			expect(log).toHaveBeenCalledTimes(2);
			const events = log.mock.calls.map(([entry]) => JSON.parse(String(entry)));
			expect(events).toEqual([
				expect.objectContaining({
					event: 'auth_upstream_request',
					operation: 'password_sign_in',
					outcome: 'success',
					status: 200,
					errorKind: null,
					vercelRegion: 'unknown',
				}),
				expect.objectContaining({
					event: 'auth_upstream_request',
					operation: 'send_magic_link',
					outcome: 'failure',
					status: 503,
					errorKind: 'http',
				}),
			]);
			expect(events.every((event) => typeof event.durationMs === 'number')).toBe(true);
			const serialized = JSON.stringify(events);
			expect(serialized).not.toMatch(
				/secret-access|secret-refresh|secret-user-id|private@example\.com|SecretPassword|supabase\.co/,
			);
		});

		it('fails missing configuration before starting an upstream request', async () => {
			delete process.env.SUPABASE_ANON_KEY;
			global.fetch = jest.fn() as typeof fetch;

			await expect(
				signInWithPassword({ email: 'safe@test.com', password: 'Password123!' }),
			).rejects.toThrow('SUPABASE_ANON_KEY no configurada.');
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('keeps the worst two-call middleware path nominally below 11 seconds', () => {
			expect(AUTH_REQUEST_TIMEOUT_MS * 2).toBeLessThan(11_000);
		});
	});
});
