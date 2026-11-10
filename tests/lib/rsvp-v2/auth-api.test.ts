import {
	AUTH_REQUEST_TIMEOUT_MS,
	adminResetAuthUserPassword,
	adminSetUserMustChangePassword,
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	getAuthUserByAccessToken,
	refreshAccessToken,
	revokeAuthSessions,
	signInWithPassword,
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
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it.each(['global', 'others'] as const)(
		'revokes %s sessions with a bodyless 204 response',
		async (scope) => {
			global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
			await expect(
				revokeAuthSessions({ accessToken: 'session-token', scope }),
			).resolves.toBeUndefined();
			expect(global.fetch).toHaveBeenCalledWith(
				`https://project.supabase.co/auth/v1/logout?scope=${scope}`,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: 'Bearer session-token',
						apikey: 'anon',
					}),
					signal: expect.any(AbortSignal),
				}),
			);
		},
	);

	it('reports revocation failures without retrying', async () => {
		global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 503 }));
		await expect(
			revokeAuthSessions({ accessToken: 'session-token', scope: 'others' }),
		).rejects.toMatchObject({ operation: 'sign_out', status: 503, retryable: true });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('signs in with the expected auth payload', async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'token',
				refresh_token: 'refresh',
				user: { id: 'u1', email: 'a@b.com' },
			}),
		}) as unknown as typeof fetch;

		const login = await signInWithPassword({
			email: 'a@b.com',
			password: 'Pass123!',
		});

		expect(login.user.id).toBe('u1');
	});

	it('finds auth users by email or login alias', async () => {
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					users: [
						{
							id: 'u-admin',
							email: 'admin@test.com',
							app_metadata: { login_alias: 'admin' },
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
							app_metadata: { login_alias: 'admin' },
						},
					],
				}),
			}) as unknown as typeof fetch;

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				id: 'u-admin',
				email: 'admin@test.com',
				app_metadata: { login_alias: 'admin' },
			}),
		});
		const user = await findAuthUserByEmail({
			email: 'admin@test.com',
		});
		const userByAlias = await findAuthUserByLoginIdentifier({
			identifier: 'admin',
		});

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
					app_metadata: { login_alias: 'ximena_meza' },
				},
			}),
		}) as typeof fetch;

		jest.useFakeTimers({ now: new Date('2026-04-01T12:00:00.000Z') });
		const user = await createAuthUserByAdmin({
			email: 'created@test.com',
			password: 'TempPass123!',
			loginAlias: 'ximena_meza',
		});
		jest.useRealTimers();

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
					app_metadata: {
						login_alias: 'ximena_meza',
						must_change_password: true,
						temp_password_expires_at: '2026-04-02T12:00:00.000Z',
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

	it('ignores user-controlled aliases, shares misses, and expires the directory cache', async () => {
		process.env.SUPABASE_URL = 'https://cache.example.test';
		jest.useFakeTimers();
		global.fetch = jest.fn().mockImplementation(async () => ({
			ok: true,
			json: async () => ({
				users: [{ id: 'attacker', user_metadata: { login_alias: 'victim' } }],
			}),
		}));
		await expect(findAuthUserByLoginIdentifier({ identifier: 'victim' })).resolves.toBeNull();
		await expect(findAuthUserByLoginIdentifier({ identifier: 'random' })).resolves.toBeNull();
		expect(global.fetch).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(30_001);
		await findAuthUserByLoginIdentifier({ identifier: 'victim' });
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('rejects duplicate aliases for login and blocks administrative allocation', async () => {
		process.env.SUPABASE_URL = 'https://duplicates.example.test';
		global.fetch = jest.fn().mockImplementation(async () => ({
			ok: true,
			json: async () => ({
				users: ['first', 'second'].map((id) => ({
					id,
					app_metadata: { login_alias: 'alice' },
				})),
			}),
		}));
		await expect(findAuthUserByLoginIdentifier({ identifier: 'alice' })).resolves.toBeNull();
		await expect(
			findAuthUserByLoginIdentifier({ identifier: 'alice', fresh: true }),
		).rejects.toThrow('Ambiguous login identifier');
	});

	it('paginates past 100 users and rejects a renamed cached alias', async () => {
		process.env.SUPABASE_URL = 'https://pagination.example.test';
		const target = {
			id: 'owner',
			email: 'owner@example.test',
			app_metadata: { login_alias: 'alice' },
		};
		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					users: Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` })),
				}),
			})
			.mockResolvedValueOnce({ ok: true, json: async () => ({ users: [target] }) })
			.mockResolvedValueOnce({ ok: true, json: async () => target })
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ ...target, app_metadata: { login_alias: 'bob' } }),
			});
		await expect(findAuthUserByLoginIdentifier({ identifier: 'alice' })).resolves.toMatchObject(
			{ id: 'owner' },
		);
		await expect(findAuthUserByLoginIdentifier({ identifier: 'alice' })).resolves.toBeNull();
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining('page=2&per_page=100'),
			expect.anything(),
		);
		expect(global.fetch).toHaveBeenCalledTimes(4);
	});

	it('bounds ignored pagination, rejects partial matches, and retries after a failed cache load', async () => {
		process.env.SUPABASE_URL = 'https://pagination-limit.example.test';
		global.fetch = jest.fn().mockImplementation(async () => ({
			ok: true,
			json: async () => ({
				users: Array.from({ length: 100 }, (_, i) => ({
					id: `u${i}`,
					app_metadata: { login_alias: i === 0 ? 'alice' : `alias${i}` },
				})),
			}),
		}));
		await expect(findAuthUserByLoginIdentifier({ identifier: 'alice' })).rejects.toThrow(
			'Auth user directory exceeded the pagination limit.',
		);
		expect(global.fetch).toHaveBeenCalledTimes(100);
		expect(global.fetch).toHaveBeenLastCalledWith(
			expect.stringContaining('page=100&per_page=100'),
			expect.anything(),
		);
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ users: [] }),
		});
		await expect(findAuthUserByLoginIdentifier({ identifier: 'alice' })).resolves.toBeNull();
		expect(global.fetch).toHaveBeenCalledTimes(101);
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

		jest.useFakeTimers({ now: new Date('2026-04-01T12:00:00.000Z') });
		await adminResetAuthUserPassword({
			userId: 'u-existing',
			password: 'TempSecurePass!234',
			mustChangePassword: true,
		});
		jest.useRealTimers();

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
						temp_password_expires_at: '2026-04-02T12:00:00.000Z',
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

	describe('where the login alias is stored', () => {
		const directoryOf = (user: Record<string, unknown>) =>
			jest.fn().mockImplementation(async (url: string) => ({
				ok: true,
				json: async () => (url.includes('/admin/users?') ? { users: [user] } : user),
			})) as unknown as typeof fetch;

		it('finds an account whose alias is in app_metadata', async () => {
			process.env.SUPABASE_URL = 'https://alias-protected.example.test';
			global.fetch = directoryOf({
				id: 'owner',
				email: 'owner@example.test',
				app_metadata: { login_alias: 'alice' },
			});
			await expect(
				findAuthUserByLoginIdentifier({ identifier: 'alice' }),
			).resolves.toMatchObject({ id: 'owner', login_alias: 'alice' });
		});

		// The state of the 28 accounts of the 2026-11-09 incident. The application refuses it on
		// purpose (user_metadata is user-writable), so the data must be migrated before release:
		// see the "auth-login-alias-app-metadata" entry in supabase/data-prerequisites.json.
		it('does not find an account whose alias is only in user_metadata', async () => {
			process.env.SUPABASE_URL = 'https://alias-legacy.example.test';
			global.fetch = directoryOf({
				id: 'owner',
				email: 'owner@example.test',
				app_metadata: { role: 'host_client' },
				user_metadata: { login_alias: 'alice' },
			});
			await expect(
				findAuthUserByLoginIdentifier({ identifier: 'alice' }),
			).resolves.toBeNull();
		});

		it('uses the app_metadata alias when user_metadata holds a different one', async () => {
			process.env.SUPABASE_URL = 'https://alias-both.example.test';
			global.fetch = directoryOf({
				id: 'owner',
				email: 'owner@example.test',
				app_metadata: { login_alias: 'alice' },
				user_metadata: { login_alias: 'mallory' },
			});
			await expect(
				findAuthUserByLoginIdentifier({ identifier: 'alice' }),
			).resolves.toMatchObject({ id: 'owner', login_alias: 'alice' });
			await expect(
				findAuthUserByLoginIdentifier({ identifier: 'mallory' }),
			).resolves.toBeNull();
		});

		const resetBody = async (existingUser: Record<string, unknown>) => {
			global.fetch = jest
				.fn()
				.mockResolvedValueOnce({ ok: true, json: async () => existingUser })
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ user: existingUser }),
				}) as unknown as typeof fetch;
			await adminResetAuthUserPassword({
				userId: 'owner',
				password: 'TempSecurePass!234',
				mustChangePassword: true,
			});
			const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
			expect(url).toBe('https://project.supabase.co/auth/v1/admin/users/owner');
			expect(init.method).toBe('PUT');
			return JSON.parse(init.body);
		};

		it('keeps the app_metadata alias when an administrator resets the password', async () => {
			const body = await resetBody({
				id: 'owner',
				email: 'owner@example.test',
				app_metadata: { role: 'host_client', login_alias: 'alice' },
			});
			expect(body.app_metadata).toMatchObject({
				role: 'host_client',
				login_alias: 'alice',
				must_change_password: true,
			});
		});

		it('does not promote a user_metadata alias when an administrator resets the password', async () => {
			const body = await resetBody({
				id: 'owner',
				email: 'owner@example.test',
				app_metadata: { role: 'host_client' },
				user_metadata: { login_alias: 'alice' },
			});
			expect(body.app_metadata).not.toHaveProperty('login_alias');
			expect(body.app_metadata).toMatchObject({ role: 'host_client' });
			expect(body).not.toHaveProperty('user_metadata');
		});
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
			await expect(
				refreshAccessToken({ refreshToken: 'secret-refresh' }),
			).rejects.toBeInstanceOf(AuthRequestError);

			expect(log).toHaveBeenCalledTimes(2);
			const events = log.mock.calls.map(([entry]) => JSON.parse(String(entry)));
			expect(events).toEqual([
				expect.objectContaining({
					event: 'auth_upstream_request',
					operation: 'password_sign_in',
					outcome: 'success',
					status: 200,
					errorKind: null,
				}),
				expect.objectContaining({
					event: 'auth_upstream_request',
					operation: 'refresh_session',
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

		it('isolates 20 concurrent successful requests resolved out of order', async () => {
			jest.useFakeTimers();
			const log = jest.spyOn(console, 'info').mockImplementation(() => {});
			const responders = new Map<string, (response: Response) => void>();
			global.fetch = jest.fn((_url, init) => {
				const body = JSON.parse(String(init?.body)) as { email: string };
				return new Promise<Response>((resolve) => responders.set(body.email, resolve));
			}) as typeof fetch;

			const requests = Array.from({ length: 20 }, (_, index) =>
				signInWithPassword({
					email: `parallel-${index}@test.invalid`,
					password: `ConcurrentPassword-${index}!`,
				}),
			);
			expect(global.fetch).toHaveBeenCalledTimes(20);

			for (let index = 19; index >= 0; index -= 1) {
				responders.get(`parallel-${index}@test.invalid`)?.({
					ok: true,
					status: 200,
					json: async () => ({
						access_token: `parallel-access-${index}`,
						refresh_token: `parallel-refresh-${index}`,
						user: { id: `parallel-user-${index}` },
					}),
				} as Response);
			}

			const settled = await Promise.allSettled(requests);
			expect(settled).toHaveLength(20);
			for (const [index, result] of settled.entries()) {
				expect(result.status).toBe('fulfilled');
				if (result.status !== 'fulfilled') continue;
				expect(result.value).toMatchObject({
					access_token: `parallel-access-${index}`,
					refresh_token: `parallel-refresh-${index}`,
					user: { id: `parallel-user-${index}` },
				});
			}
			expect(log).toHaveBeenCalledTimes(20);
			expect(jest.getTimerCount()).toBe(0);
			const serializedLogs = JSON.stringify(log.mock.calls);
			expect(serializedLogs).not.toMatch(
				/parallel-access|parallel-refresh|parallel-user|parallel-\d+@test\.invalid|ConcurrentPassword/,
			);
		});

		it('isolates mixed concurrent failures and clears every request timer', async () => {
			jest.useFakeTimers();
			const log = jest.spyOn(console, 'info').mockImplementation(() => {});
			global.fetch = jest.fn((_url, init) => {
				const body = JSON.parse(String(init?.body)) as { email: string };
				const index = Number(body.email.match(/mixed-(\d+)/)?.[1]);
				if (index < 5) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: async () => ({
							access_token: `mixed-access-${index}`,
							refresh_token: `mixed-refresh-${index}`,
							user: { id: `mixed-user-${index}` },
						}),
					} as Response);
				}
				if (index < 10) {
					return Promise.resolve({ ok: false, status: 401 } as Response);
				}
				if (index < 15) {
					return Promise.resolve({ ok: false, status: 503 } as Response);
				}
				return new Promise<Response>((_resolve, reject) => {
					(init?.signal as AbortSignal).addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'));
					});
				});
			}) as typeof fetch;

			const requests = Array.from({ length: 20 }, (_, index) =>
				signInWithPassword({
					email: `mixed-${index}@test.invalid`,
					password: `MixedPassword-${index}!`,
				}),
			);
			const settledPromise = Promise.allSettled(requests);
			await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
			const settled = await settledPromise;

			expect(settled.slice(0, 5).every((result) => result.status === 'fulfilled')).toBe(true);
			for (const result of settled.slice(5, 10)) {
				expect(result).toMatchObject({
					status: 'rejected',
					reason: { kind: 'http', status: 401, retryable: false },
				});
			}
			for (const result of settled.slice(10, 15)) {
				expect(result).toMatchObject({
					status: 'rejected',
					reason: { kind: 'http', status: 503, retryable: true },
				});
			}
			for (const result of settled.slice(15)) {
				expect(result).toMatchObject({
					status: 'rejected',
					reason: { kind: 'timeout', retryable: true },
				});
			}
			expect(log).toHaveBeenCalledTimes(20);
			expect(jest.getTimerCount()).toBe(0);
			const serializedLogs = JSON.stringify(log.mock.calls);
			expect(serializedLogs).not.toMatch(
				/mixed-access|mixed-refresh|mixed-user|mixed-\d+@test\.invalid|MixedPassword/,
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
