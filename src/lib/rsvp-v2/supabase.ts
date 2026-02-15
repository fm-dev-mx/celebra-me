import { getEnv } from '@/utils/env';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface SupabaseRequestOptions {
	pathWithQuery: string;
	method?: HttpMethod;
	body?: unknown;
	prefer?: string;
	authToken?: string;
	useServiceRole?: boolean;
}

function getBaseUrl(): string {
	const supabaseUrl = getEnv('SUPABASE_URL');
	if (!supabaseUrl) {
		throw new Error('SUPABASE_URL no configurada.');
	}
	return `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
}

function getAnonKey(): string {
	const anon = getEnv('SUPABASE_ANON_KEY');
	if (!anon) throw new Error('SUPABASE_ANON_KEY no configurada.');
	return anon;
}

function getServiceRoleKey(): string {
	const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
	return key;
}

export async function supabaseRestRequest<T>(options: SupabaseRequestOptions): Promise<T> {
	const method = options.method ?? 'GET';
	const apiKey = options.useServiceRole ? getServiceRoleKey() : getAnonKey();
	const bearer =
		options.authToken?.trim() || (options.useServiceRole ? getServiceRoleKey() : getAnonKey());

	const response = await fetch(`${getBaseUrl()}/${options.pathWithQuery}`, {
		method,
		headers: {
			apikey: apiKey,
			Authorization: `Bearer ${bearer}`,
			'Content-Type': 'application/json',
			...(options.prefer ? { Prefer: options.prefer } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});

	if (!response.ok) {
		const raw = await response.text();
		throw new Error(`Supabase error (${response.status}): ${raw || response.statusText}`);
	}

	if (response.status === 204) {
		return [] as T;
	}

	return (await response.json()) as T;
}
