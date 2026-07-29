import {
	getSupabaseUrl,
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
} from '@/lib/server/supabase-credentials';

interface AuthApiOptions {
	path: string;
	method?: 'GET' | 'POST' | 'PUT';
	body?: unknown;
	authToken?: string;
	useServiceRole?: boolean;
}

export interface AuthAdminUser {
	id: string;
	email?: string;
	created_at?: string;
	login_alias?: string;
}

async function authRequest<T>(options: AuthApiOptions): Promise<T> {
	const method = options.method ?? 'POST';
	const apiKey = options.useServiceRole ? getSupabaseServiceRoleKey() : getSupabaseAnonKey();
	const supabaseUrl = getSupabaseUrl();
	const requestUrl = `${supabaseUrl}/auth/v1/${options.path}`;

	let response: Response;
	try {
		response = await fetch(requestUrl, {
			method,
			headers: {
				apikey: apiKey,
				Authorization: `Bearer ${options.authToken || apiKey}`,
				'Content-Type': 'application/json',
			},
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
	} catch (cause) {
		const causeCode =
			cause instanceof Error
				? ((cause.cause as Record<string, unknown> | undefined)?.code as string | undefined)
				: undefined;
		console.error(
			'[auth] fetch failed',
			JSON.stringify({
				stage: 'fetch',
				errorName: cause instanceof Error ? cause.name : typeof cause,
				errorMessage: cause instanceof Error ? cause.message : String(cause),
				causeCode,
			}),
		);
		throw Object.assign(new Error('auth-request-failed'), { _stage: 'fetch' });
	}

	if (!response.ok) {
		const status = response.status;
		const bodyText = await response.text().catch(() => '');
		let supabaseCode: string | undefined;
		try {
			const parsed = JSON.parse(bodyText) as Record<string, unknown>;
			supabaseCode =
				(typeof parsed.error === 'string' ? parsed.error : undefined) ??
				(typeof parsed.error_code === 'string' ? parsed.error_code : undefined) ??
				(typeof parsed.message === 'string' && parsed.message !== 'Invalid API key'
					? parsed.message
					: undefined);
		} catch {
			/* ignore parse failure */
		}

		console.error(
			'[auth] upstream error',
			JSON.stringify({
				stage: 'response',
				status,
				supabaseCode,
			}),
		);
		throw Object.assign(new Error(`Supabase auth error (${status}).`), {
			_stage: 'response',
			_status: status,
			_supabaseCode: supabaseCode,
		});
	}
	return (await response.json()) as T;
}

function mapAuthAdminUser(user: {
	id: string;
	email?: string;
	created_at?: string;
	user_metadata?: Record<string, unknown>;
}): AuthAdminUser {
	const rawAlias = user.user_metadata?.login_alias;
	return {
		id: user.id,
		email: user.email,
		created_at: user.created_at,
		login_alias: typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : undefined,
	};
}

export async function signInWithPassword(input: { email: string; password: string }): Promise<{
	access_token: string;
	refresh_token: string;
	user: { id: string; email?: string };
}> {
	return authRequest({
		path: 'token?grant_type=password',
		body: {
			email: input.email,
			password: input.password,
		},
	});
}

export async function refreshAccessToken(input: { refreshToken: string }): Promise<{
	access_token: string;
	refresh_token: string;
	user: { id: string; email?: string };
}> {
	return authRequest({
		path: 'token?grant_type=refresh_token',
		body: {
			refresh_token: input.refreshToken,
		},
	});
}

export async function signUpWithPassword(input: { email: string; password: string }): Promise<{
	access_token?: string;
	refresh_token?: string;
	user?: { id?: string; email?: string };
}> {
	return authRequest({
		path: 'signup',
		body: {
			email: input.email,
			password: input.password,
		},
	});
}

export async function sendMagicLink(input: {
	email: string;
	redirectTo?: string;
}): Promise<{ message_id?: string }> {
	return authRequest({
		path: 'otp',
		body: {
			email: input.email,
			create_user: true,
			email_redirect_to: input.redirectTo,
		},
	});
}

export async function findAuthUserByEmail(input: { email: string }): Promise<AuthAdminUser | null> {
	const response = await authRequest<{
		users?: Array<{
			id: string;
			email?: string;
			created_at?: string;
			user_metadata?: Record<string, unknown>;
		}>;
	}>({
		path: 'admin/users?page=1&per_page=1000',
		method: 'GET',
		useServiceRole: true,
	});
	const wanted = input.email.trim().toLowerCase();
	const user = (response.users || []).find(
		(item) => (item.email || '').trim().toLowerCase() === wanted,
	);
	return user ? mapAuthAdminUser(user) : null;
}

export async function findAuthUserByLoginIdentifier(input: {
	identifier: string;
}): Promise<AuthAdminUser | null> {
	const response = await authRequest<{
		users?: Array<{
			id: string;
			email?: string;
			created_at?: string;
			user_metadata?: Record<string, unknown>;
		}>;
	}>({
		path: 'admin/users?page=1&per_page=1000',
		method: 'GET',
		useServiceRole: true,
	});
	const wanted = input.identifier.trim().toLowerCase();
	const user = (response.users || []).find((item) => {
		const mapped = mapAuthAdminUser(item);
		return (
			mapped.login_alias === wanted || (mapped.email || '').trim().toLowerCase() === wanted
		);
	});
	return user ? mapAuthAdminUser(user) : null;
}

export async function listAuthUsers(input?: {
	page?: number;
	perPage?: number;
}): Promise<AuthAdminUser[]> {
	const page = input?.page && input.page > 0 ? input.page : 1;
	const perPage = input?.perPage && input.perPage > 0 ? Math.min(input.perPage, 1000) : 200;
	const response = await authRequest<{
		users?: Array<{
			id: string;
			email?: string;
			created_at?: string;
			user_metadata?: Record<string, unknown>;
		}>;
	}>({
		path: `admin/users?page=${page}&per_page=${perPage}`,
		method: 'GET',
		useServiceRole: true,
	});
	return (response.users || []).map(mapAuthAdminUser);
}

type CreateAuthUserResponse =
	| {
			user:
				| {
						id: string;
						email?: string;
						created_at?: string;
						user_metadata?: Record<string, unknown>;
				  }
				| undefined;
	  }
	| {
			id: string;
			email?: string;
			created_at?: string;
			user_metadata?: Record<string, unknown>;
	  };

export async function createAuthUserByAdmin(input: {
	email: string;
	password: string;
	loginAlias?: string;
}): Promise<AuthAdminUser> {
	const response = await authRequest<CreateAuthUserResponse>({
		path: 'admin/users',
		method: 'POST',
		useServiceRole: true,
		body: {
			email: input.email,
			password: input.password,
			email_confirm: true,
			user_metadata: input.loginAlias
				? {
						login_alias: input.loginAlias,
					}
				: undefined,
			app_metadata: {
				must_change_password: true,
			},
		},
	});
	const user = 'user' in response ? response.user : response;
	if (!user || !user.id) {
		throw new Error('Supabase auth error: created user id was not returned.');
	}
	return mapAuthAdminUser(user);
}

type AuthAdminUserRecord = {
	id: string;
	email?: string;
	user_metadata?: Record<string, unknown>;
	app_metadata?: Record<string, unknown>;
};

export async function getAuthUserAdminById(userId: string): Promise<AuthAdminUserRecord> {
	const user = await authRequest<AuthAdminUserRecord>({
		path: `admin/users/${userId}`,
		method: 'GET',
		useServiceRole: true,
	});
	if (!user?.id) {
		throw new Error('Supabase auth error: user was not returned.');
	}
	return user;
}

async function updateAuthUserAdmin(input: {
	userId: string;
	password?: string;
	mustChangePassword: boolean;
}): Promise<AuthAdminUser> {
	const existingUser = await getAuthUserAdminById(input.userId);
	const body: {
		password?: string;
		app_metadata: Record<string, unknown>;
	} = {
		app_metadata: {
			...(existingUser.app_metadata || {}),
			must_change_password: input.mustChangePassword,
		},
	};
	if (input.password !== undefined) {
		body.password = input.password;
	}

	const response = await authRequest<CreateAuthUserResponse>({
		path: `admin/users/${input.userId}`,
		method: 'PUT',
		useServiceRole: true,
		body,
	});
	const user = 'user' in response ? response.user : response;
	if (!user || !user.id) {
		throw new Error('Supabase auth error: update user id was not returned.');
	}
	return mapAuthAdminUser(user);
}

export async function adminResetAuthUserPassword(input: {
	userId: string;
	password: string;
	mustChangePassword?: boolean;
}): Promise<AuthAdminUser> {
	return updateAuthUserAdmin({
		userId: input.userId,
		password: input.password,
		mustChangePassword: input.mustChangePassword ?? true,
	});
}

export async function updateUserPasswordUserAuth(input: {
	accessToken: string;
	password: string;
}): Promise<{ id: string; email?: string }> {
	return authRequest<{ id: string; email?: string }>({
		path: 'user',
		method: 'PUT',
		authToken: input.accessToken,
		body: {
			password: input.password,
		},
	});
}

export async function adminSetUserMustChangePassword(input: {
	userId: string;
	mustChangePassword: boolean;
}): Promise<AuthAdminUser> {
	return updateAuthUserAdmin({
		userId: input.userId,
		mustChangePassword: input.mustChangePassword,
	});
}

