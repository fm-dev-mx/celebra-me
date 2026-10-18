/**
 * Environment profiles for the platform usage console. Local shows both
 * environments; a deployment shows only its own. Every profile reads the plain
 * variable names. Names only ever leave this layer as `PlatformMissingVar`
 * entries - values stay in server memory.
 */

import type {
	PlatformEnvironmentId,
	PlatformMissingVar,
	PlatformScope,
} from '@/lib/platform/contract/types';
import { isLocalProcess, readHostedDeployEnvironment } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

export interface ResolvedProfileVar {
	/** Name consulted; also the name reported when missing or invalid. */
	name: string;
	value: string | null;
	missing: PlatformMissingVar | null;
}

export function isLocalPanel(): boolean {
	return isLocalProcess();
}

/** Environments this panel is scoped to; Local shows both, an unverified deployment none. */
export function resolvePanelEnvironments(): PlatformEnvironmentId[] {
	const hosted = readHostedDeployEnvironment();
	if (hosted) return [hosted];
	return isLocalProcess() ? ['preview', 'production'] : [];
}

/** Resolve one variable by its plain name, reporting gaps against `scope`. */
export function readProfileVar(
	name: string,
	scope: PlatformScope,
	validate?: (value: string) => boolean,
): ResolvedProfileVar {
	const value = getEnv(name).trim();
	if (!value) return { name, value: null, missing: { name, state: 'absent', scope } };
	if (validate && !validate(value)) {
		return { name, value: null, missing: { name, state: 'invalid', scope } };
	}
	return { name, value, missing: null };
}
