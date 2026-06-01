import {
	getSupabaseUrl,
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
} from '@/lib/server/supabase-credentials';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface SupabaseRequestOptions {
	pathWithQuery: string;
	method?: HttpMethod;
	body?: unknown;
	prefer?: string;
	authToken?: string;
	useServiceRole?: boolean;
	timeoutMs?: number;
}

export async function supabaseRestRequest<T>(options: SupabaseRequestOptions): Promise<T> {
	const method = options.method ?? 'GET';
	const apiKey = options.useServiceRole ? getSupabaseServiceRoleKey() : getSupabaseAnonKey();
	const bearer = options.authToken?.trim() ?? apiKey;

	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const response = await fetch(`${getSupabaseUrl()}/rest/v1/${options.pathWithQuery}`, {
		signal: AbortSignal.timeout(timeoutMs),
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
