/**
 * Runtime mutation environment guard.
 *
 * Distinguishes Local runtime, local Preview runtime (CELEBRA_RUNTIME_TARGET),
 * Vercel Preview, and Production. Worktree path alone is never authorization.
 */

import {
	SUPABASE_PROJECT_REFS,
	assertMutationEnvironmentIdentity,
	decodeJwtProjectRef,
	extractApiProjectRef,
	type InvitationMutationEnvironment,
	type MutationEnvironmentIdentity,
} from '@/lib/intake/mutations/environment-identity';
import { getEnv } from '@/lib/server/env';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/server/supabase-credentials';

let cachedVerification: Promise<MutationEnvironmentIdentity> | null = null;
let cachedFingerprint = '';

function inferRuntimeEnvironment(apiUrl: string): InvitationMutationEnvironment {
	const vercelEnvironment = getEnv('VERCEL_ENV').trim().toLowerCase();
	if (vercelEnvironment === 'production') return 'production';
	if (vercelEnvironment === 'preview') return 'preview';

	const apiRef = extractApiProjectRef(apiUrl);
	const celebraTarget = getEnv('CELEBRA_RUNTIME_TARGET').trim().toLowerCase();

	if (celebraTarget === 'preview') {
		if (apiRef !== SUPABASE_PROJECT_REFS.preview) {
			throw new Error(
				'CELEBRA_RUNTIME_TARGET=preview requires the dedicated Preview Supabase project.',
			);
		}
		return 'preview';
	}

	if (celebraTarget === 'local') {
		if (apiRef !== SUPABASE_PROJECT_REFS.local) {
			throw new Error('CELEBRA_RUNTIME_TARGET=local requires Local Supabase.');
		}
		return 'local';
	}

	if (apiRef === SUPABASE_PROJECT_REFS.local && !vercelEnvironment) return 'local';

	throw new Error(
		'Runtime mutation environment is ambiguous. Local execution must use Local Supabase with CELEBRA_RUNTIME_TARGET=local (or omit it), Preview runtime must set CELEBRA_RUNTIME_TARGET=preview against the Preview project, and deployed execution must declare VERCEL_ENV.',
	);
}

async function verifyOpaqueCredential(apiUrl: string, serviceRoleKey: string): Promise<void> {
	const response = await fetch(`${apiUrl}/rest/v1/`, {
		method: 'GET',
		headers: {
			apikey: serviceRoleKey,
			Authorization: `Bearer ${serviceRoleKey}`,
			Accept: 'application/openapi+json',
		},
		signal: AbortSignal.timeout(5_000),
	});
	if (!response.ok) {
		throw new Error(
			`Supabase credential could not be verified for the configured project (HTTP ${response.status}).`,
		);
	}
	if (typeof response.body?.cancel === 'function') await response.body.cancel();
}

/** Fail closed before an authenticated runtime mutation can reach Supabase. */
export async function assertRuntimeMutationEnvironment(): Promise<MutationEnvironmentIdentity> {
	const apiUrl = getSupabaseUrl();
	const serviceRoleKey = getSupabaseServiceRoleKey();
	const runtimeEnvironment = inferRuntimeEnvironment(apiUrl);
	const projectRef = extractApiProjectRef(apiUrl);
	const fingerprint = `${runtimeEnvironment}:${projectRef}:${serviceRoleKey.slice(0, 12)}`;

	if (cachedVerification && cachedFingerprint === fingerprint) return cachedVerification;
	cachedFingerprint = fingerprint;
	cachedVerification = (async () => {
		const encodedRef = decodeJwtProjectRef(serviceRoleKey);
		if (encodedRef && encodedRef !== projectRef) {
			throw new Error('Supabase service credential belongs to a different project.');
		}
		if (!encodedRef) await verifyOpaqueCredential(apiUrl, serviceRoleKey);

		return assertMutationEnvironmentIdentity({
			environment: runtimeEnvironment,
			projectRef,
			apiUrl,
			storageUrl: `${apiUrl}/storage/v1/object/invitation-assets`,
			credentialProjectRef: encodedRef ?? projectRef,
			runtimeEnvironment,
		});
	})();

	try {
		return await cachedVerification;
	} catch (error) {
		cachedVerification = null;
		cachedFingerprint = '';
		throw error;
	}
}

export function resetRuntimeMutationEnvironmentCacheForTests(): void {
	cachedVerification = null;
	cachedFingerprint = '';
}
