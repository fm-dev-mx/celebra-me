/**
 * Local-only gate for the Observability Dashboard.
 * Worktree path alone is never authorization.
 */

import { readDeployEnvironment } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

/**
 * Injectable env view for tests and API gates.
 * Accepts both process-style keys and camelCase aliases.
 */
export interface ObservabilityRuntimeEnv {
	NODE_ENV?: string;
	SUPABASE_URL?: string;
	CELEBRA_RUNTIME_TARGET?: string;
	/** Test-only declared deploy identity; omitted means the real one. */
	deployEnv?: string;
	/** Test / alias fields */
	nodeEnv?: string;
	supabaseUrl?: string;
	celebraRuntimeTarget?: string;
}

function fromInput(
	input: ObservabilityRuntimeEnv | undefined,
	processKey: string,
	aliases: string[],
): string {
	if (input) {
		const record = input as Record<string, string | undefined>;
		for (const key of aliases) {
			if (Object.prototype.hasOwnProperty.call(record, key)) {
				const value = record[key];
				return typeof value === 'string' ? value.trim() : '';
			}
		}
		// Explicit env object provided but key absent → do not fall back to process.
		return '';
	}
	return getEnv(processKey).trim();
}

function isLocalSupabaseUrl(url: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
		const isLoopback = host === '127.0.0.1' || host === 'localhost';
		return isLoopback && port === '54321';
	} catch {
		return /https?:\/\/(127\.0\.0\.1|localhost):54321\b/i.test(url);
	}
}

/**
 * Approved Local observability runtime:
 * - a positively local deploy identity (never hosted, missing or invalid)
 * - reject CELEBRA_RUNTIME_TARGET=preview
 * - Local Supabase URL (127.0.0.1|localhost:54321)
 */
export function isLocalObservabilityRuntime(env?: ObservabilityRuntimeEnv): boolean {
	const declaredDeployEnv =
		env && Object.prototype.hasOwnProperty.call(env, 'deployEnv')
			? (env.deployEnv ?? '')
			: undefined;
	const deployEnvironment = readDeployEnvironment(
		declaredDeployEnv === undefined
			? undefined
			: { deployEnv: declaredDeployEnv, isDevServer: true },
	);
	if (deployEnvironment !== 'local') return false;

	const celebraTarget = fromInput(env, 'CELEBRA_RUNTIME_TARGET', [
		'CELEBRA_RUNTIME_TARGET',
		'celebraRuntimeTarget',
	]).toLowerCase();
	if (celebraTarget === 'preview') return false;

	const supabaseUrl = fromInput(env, 'SUPABASE_URL', ['SUPABASE_URL', 'supabaseUrl']);
	return isLocalSupabaseUrl(supabaseUrl);
}

/** Snapshot of process env for Astro pages that prefer an explicit env object. */
export function readObservabilityRuntimeEnv(
	source: NodeJS.ProcessEnv = process.env,
): ObservabilityRuntimeEnv {
	return {
		NODE_ENV: source.NODE_ENV,
		SUPABASE_URL: source.SUPABASE_URL ?? source.PUBLIC_SUPABASE_URL,
		CELEBRA_RUNTIME_TARGET: source.CELEBRA_RUNTIME_TARGET,
		nodeEnv: source.NODE_ENV,
		supabaseUrl: source.SUPABASE_URL ?? source.PUBLIC_SUPABASE_URL,
		celebraRuntimeTarget: source.CELEBRA_RUNTIME_TARGET,
	};
}
