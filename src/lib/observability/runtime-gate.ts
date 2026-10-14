/**
 * Local-only gate for the Observability Dashboard.
 * Worktree path alone is never authorization.
 */

import { isLocalProcess, isLocalSupabaseUrl } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

/**
 * Injectable env view for tests and API gates.
 * Accepts both process-style keys and camelCase aliases.
 */
export interface ObservabilityRuntimeEnv {
	SUPABASE_URL?: string;
	CELEBRA_RUNTIME_TARGET?: string;
	/** Alias fields */
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

/**
 * Approved Local observability runtime:
 * - a positively local deploy identity (never hosted, missing or invalid)
 * - reject CELEBRA_RUNTIME_TARGET=preview
 * - Local Supabase URL (http://127.0.0.1|localhost:54321)
 */
export function isLocalObservabilityRuntime(env?: ObservabilityRuntimeEnv): boolean {
	if (!isLocalProcess()) return false;

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
		SUPABASE_URL: source.SUPABASE_URL ?? source.PUBLIC_SUPABASE_URL,
		CELEBRA_RUNTIME_TARGET: source.CELEBRA_RUNTIME_TARGET,
		supabaseUrl: source.SUPABASE_URL ?? source.PUBLIC_SUPABASE_URL,
		celebraRuntimeTarget: source.CELEBRA_RUNTIME_TARGET,
	};
}
