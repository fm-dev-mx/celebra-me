/**
 * Environment profiles for the platform usage console. Local shows both
 * environments and may load each profile's credentials from Local-only
 * suffixed variables, falling back to the shared plain names; deployments
 * read only their own plain names. Names only ever leave this layer as
 * `PlatformMissingVar` entries - values stay in server memory.
 */

import type {
	PlatformEnvironmentId,
	PlatformMissingVar,
	PlatformScope,
} from '@/lib/platform/contract/types';
import { getEnv } from '@/lib/server/env';
import { PLATFORM_ENV, PLATFORM_ENV_BY_ENVIRONMENT } from './config';

/** Environment-keyed variables that Local can override per profile. */
type ProfileVarKey = keyof typeof PLATFORM_ENV_BY_ENVIRONMENT;

export interface ResolvedProfileVar {
	/** Name actually consulted; also the name reported when missing or invalid. */
	name: string;
	value: string | null;
	missing: PlatformMissingVar | null;
}

export function isLocalPanel(): boolean {
	const vercelEnv = getEnv(PLATFORM_ENV.vercelEnv).trim();
	return vercelEnv !== 'preview' && vercelEnv !== 'production';
}

/** Environments this panel is scoped to; Local shows both. */
export function resolvePanelEnvironments(): PlatformEnvironmentId[] {
	const vercelEnv = getEnv(PLATFORM_ENV.vercelEnv).trim();
	if (vercelEnv === 'production') return ['production'];
	if (vercelEnv === 'preview') return ['preview'];
	return ['preview', 'production'];
}

function evaluate(
	name: string,
	value: string,
	scope: PlatformScope,
	validate?: (value: string) => boolean,
): ResolvedProfileVar {
	if (validate && !validate(value)) {
		return { name, value: null, missing: { name, state: 'invalid', scope } };
	}
	return { name, value, missing: null };
}

/**
 * Resolve one per-environment variable. Local prefers `NAME_PREVIEW` /
 * `NAME_PRODUCTION`; `allowPlainFallback: false` stops Local from falling back
 * to the shared `NAME` (the R2 bucket: the plain name is the Local bucket).
 * Deployments always read their own plain name.
 */
export function readProfileVar(
	key: ProfileVarKey,
	environment: PlatformEnvironmentId,
	options: { validate?: (value: string) => boolean; allowPlainFallback?: boolean } = {},
): ResolvedProfileVar {
	const suffixedName = PLATFORM_ENV_BY_ENVIRONMENT[key][environment];
	const plainName = PLATFORM_ENV[key];
	if (isLocalPanel()) {
		const suffixed = getEnv(suffixedName).trim();
		if (suffixed) return evaluate(suffixedName, suffixed, environment, options.validate);
		if (options.allowPlainFallback === false) {
			return {
				name: suffixedName,
				value: null,
				missing: { name: suffixedName, state: 'absent', scope: environment },
			};
		}
	}
	const plain = getEnv(plainName).trim();
	if (plain) return evaluate(plainName, plain, environment, options.validate);
	return {
		name: isLocalPanel() ? suffixedName : plainName,
		value: null,
		missing: {
			name: isLocalPanel() ? suffixedName : plainName,
			state: 'absent',
			scope: environment,
		},
	};
}

/** Resolve one shared variable (one account, project or cloud for every environment). */
export function readSharedVar(
	name: string,
	scope: PlatformScope,
	validate?: (value: string) => boolean,
): ResolvedProfileVar {
	const value = getEnv(name).trim();
	if (value) return evaluate(name, value, scope, validate);
	return { name, value: null, missing: { name, state: 'absent', scope } };
}
