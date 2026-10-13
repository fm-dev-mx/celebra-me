/**
 * Deploy identity: the only reader of `CELEBRA_DEPLOY_ENV`.
 *
 * Hosted runtimes declare `production` or `preview` explicitly. A local process
 * declares nothing and is recognized positively: the Astro dev server, or a built
 * bundle that talks to Local Supabase. Any other combination is ambiguous and
 * fails closed, so a hosted bundle that lost its declaration can never pass for a
 * local one (which would unlock local-only bypasses).
 */

import { isDevEnvironment } from '@/lib/environment';
import { getEnv } from '@/lib/server/env';

export type DeployEnvironment = 'production' | 'preview' | 'local';
export type HostedDeployEnvironment = Exclude<DeployEnvironment, 'local'>;

const DEPLOY_ENVIRONMENT_VARIABLE = 'CELEBRA_DEPLOY_ENV';

export class DeployIdentityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DeployIdentityError';
	}
}

export interface DeployIdentityInput {
	deployEnv?: string;
	supabaseUrl?: string;
	isDevServer?: boolean;
}

function isLocalSupabaseUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === 'http:' &&
			(url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
			url.port === '54321' &&
			!url.username &&
			!url.password
		);
	} catch {
		return false;
	}
}

/** Strict resolution for security and data decisions. Throws when identity is ambiguous. */
export function resolveDeployEnvironment(input: DeployIdentityInput = {}): DeployEnvironment {
	// Exact values only: a padded or differently cased value is a misconfiguration, not an alias.
	const declared = input.deployEnv ?? getEnv('CELEBRA_DEPLOY_ENV');
	if (declared === 'production' || declared === 'preview') return declared;
	if (declared !== '') {
		throw new DeployIdentityError(
			`${DEPLOY_ENVIRONMENT_VARIABLE} must be exactly "production" or "preview" when set.`,
		);
	}
	if (input.isDevServer ?? isDevEnvironment()) return 'local';
	if (isLocalSupabaseUrl(input.supabaseUrl ?? getEnv('SUPABASE_URL'))) return 'local';
	throw new DeployIdentityError(
		`A built server bundle must declare ${DEPLOY_ENVIRONMENT_VARIABLE} unless it uses Local Supabase.`,
	);
}

/** Resolved environment, or null when identity is missing or invalid. Never throws. */
export function readDeployEnvironment(input?: DeployIdentityInput): DeployEnvironment | null {
	try {
		return resolveDeployEnvironment(input);
	} catch {
		return null;
	}
}

/** Hosted environment, or null for local and for missing or invalid identity. Never throws. */
export function readHostedDeployEnvironment(
	input?: DeployIdentityInput,
): HostedDeployEnvironment | null {
	const environment = readDeployEnvironment(input);
	return environment === 'local' ? null : environment;
}

/** True only for a declared Production deployment. Never throws. */
export function isProductionDeployment(input?: DeployIdentityInput): boolean {
	return readHostedDeployEnvironment(input) === 'production';
}

/** True only for a positively recognized local process. Never throws. */
export function isLocalProcess(input?: DeployIdentityInput): boolean {
	return readDeployEnvironment(input) === 'local';
}

/**
 * Cookies carry `Secure` everywhere except a positively local process served over plain
 * http. Hosted and ambiguous runtimes always get it: the hosting platform may inject any
 * NODE_ENV at runtime, so NODE_ENV never decides transport security.
 */
export function requiresSecureCookies(input?: DeployIdentityInput): boolean {
	return !isLocalProcess(input);
}
