import {
	getSupabaseUrl,
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
} from '@/lib/server/supabase-credentials';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const DEFAULT_TIMEOUT_MS = 10_000;

export class SupabaseHttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
		public readonly code: string | null,
	) {
		super(`Supabase error (${status}): ${body || String(status)}`);
		this.name = 'SupabaseHttpError';
	}
}

function postgrestErrorCode(body: string): string | null {
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'code' in parsed &&
			typeof parsed.code === 'string'
		) {
			return parsed.code;
		}
	} catch {
		// The original response remains available to callers for diagnostics.
	}
	return null;
}

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
		throw new SupabaseHttpError(
			response.status,
			raw || response.statusText,
			postgrestErrorCode(raw),
		);
	}

	// Read body once so we can safely attempt JSON parsing
	const text = await response.text();

	// Some Supabase endpoints (e.g. with Prefer: return=minimal) return
	// 2xx with an empty body. Return an empty array rather than crashing.
	if (!text.trim()) {
		return [] as T;
	}

	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(
			`Supabase response parse error (${response.status} ${options.method ?? 'GET'} /rest/v1/${options.pathWithQuery}): invalid JSON body`,
		);
	}
}
