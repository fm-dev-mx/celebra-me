import { getEnv } from '@/utils/env';

interface AuthApiOptions {
	path: string;
	method?: 'GET' | 'POST';
	body?: unknown;
	authToken?: string;
	useServiceRole?: boolean;
}

function getSupabaseUrl(): string {
	const value = getEnv('SUPABASE_URL');
	if (!value) throw new Error('SUPABASE_URL no configurada.');
	return value.replace(/\/+$/, '');
}

function getAnonKey(): string {
	const value = getEnv('SUPABASE_ANON_KEY');
	if (!value) throw new Error('SUPABASE_ANON_KEY no configurada.');
	return value;
}

function getServiceRoleKey(): string {
	const value = getEnv('SUPABASE_SERVICE_ROLE_KEY');
	if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
	return value;
}

async function authRequest<T>(options: AuthApiOptions): Promise<T> {
	const method = options.method ?? 'POST';
	const apiKey = options.useServiceRole ? getServiceRoleKey() : getAnonKey();
	const response = await fetch(`${getSupabaseUrl()}/auth/v1/${options.path}`, {
		method,
		headers: {
			apikey: apiKey,
			Authorization: `Bearer ${options.authToken || apiKey}`,
			'Content-Type': 'application/json',
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	if (!response.ok) {
		throw new Error(`Supabase auth error (${response.status}).`);
	}
	return (await response.json()) as T;
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

export async function findAuthUserByEmail(input: {
	email: string;
}): Promise<{ id: string; email?: string } | null> {
	const response = await authRequest<{ users?: Array<{ id: string; email?: string }> }>({
		path: 'admin/users?page=1&per_page=1000',
		method: 'GET',
		useServiceRole: true,
	});
	const wanted = input.email.trim().toLowerCase();
	const user = (response.users || []).find(
		(item) => (item.email || '').trim().toLowerCase() === wanted,
	);
	return user ? { id: user.id, email: user.email } : null;
}

export async function listAuthUsers(input?: {
	page?: number;
	perPage?: number;
}): Promise<Array<{ id: string; email?: string; created_at?: string }>> {
	const page = input?.page && input.page > 0 ? input.page : 1;
	const perPage = input?.perPage && input.perPage > 0 ? Math.min(input.perPage, 1000) : 200;
	const response = await authRequest<{
		users?: Array<{ id: string; email?: string; created_at?: string }>;
	}>({
		path: `admin/users?page=${page}&per_page=${perPage}`,
		method: 'GET',
		useServiceRole: true,
	});
	return response.users || [];
}
