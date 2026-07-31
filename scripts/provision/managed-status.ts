/**
 * managed-status.ts — Compact read-only managed invitation status
 *
 * Composes existing dbs-status / schema-lifecycle classifiers into a single
 * CONTENT + SCHEMA surface. Does not introduce a parallel divergence model.
 *
 * Vocabulary (unchanged from dbs-status / schema-lifecycle-state):
 *   CONTENT: MATCH_CANONICAL | BEHIND_CANONICAL | DIVERGED | IDENTITY_CONFLICT |
 *            NOT_PRESENT | UNREACHABLE | CREDENTIALS_REQUIRED | UNVERIFIED
 *   SCHEMA:  CURRENT | BEHIND | SCHEMA_DRIFT | UNVERIFIED
 */

import {
	evaluateGeneralStatus,
	evaluateInvitationStatus,
	withStatusProbeTimeout,
	type EnvTargetStatus,
	type PerInvitationTargetStatus,
	type StatusVocabulary,
	type TargetEnv,
} from './dbs-status.ts';
import type { SchemaLifecycleState } from '../db/schema-lifecycle-state.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';

/** Default remote probe budget for routine CLI use (ms). */
export const MANAGED_STATUS_DEFAULT_TIMEOUT_MS = 8_000;
/** Per-psql spawnSync budget inside a compact probe (ms). */
export const MANAGED_STATUS_PER_QUERY_TIMEOUT_MS = 2_000;

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

const CONTENT_SEVERITY: Record<StatusVocabulary, number> = {
	MATCH_CANONICAL: 0,
	NOT_PRESENT: 1,
	CREDENTIALS_REQUIRED: 2,
	UNREACHABLE: 3,
	UNVERIFIED: 4,
	BEHIND_CANONICAL: 5,
	DIVERGED: 6,
	IDENTITY_CONFLICT: 7,
};

export interface CompactEnvContentStatus {
	environment: TargetEnv;
	status: StatusVocabulary;
	detail?: string;
}

export interface CompactEnvSchemaStatus {
	environment: TargetEnv;
	status: SchemaLifecycleState;
	detail?: string;
}

export interface CompactManagedStatus {
	content: Record<TargetEnv, CompactEnvContentStatus>;
	schema: Record<TargetEnv, CompactEnvSchemaStatus>;
	/** Slug used for CONTENT, or null when CONTENT is connectivity-/aggregate-derived. */
	contentSlug: string | null;
	contentMode: 'slug' | 'aggregate' | 'connectivity';
	readOnly: true;
}

function schemaFromEnv(envStatus: EnvTargetStatus): CompactEnvSchemaStatus {
	if (!envStatus.configured) {
		return {
			environment: envStatus.environment,
			status: 'UNVERIFIED',
			detail: envStatus.errorDetail ?? 'Credentials not configured',
		};
	}
	if (!envStatus.reachable) {
		return {
			environment: envStatus.environment,
			status: 'UNVERIFIED',
			detail: envStatus.errorDetail ?? 'Unreachable',
		};
	}
	return {
		environment: envStatus.environment,
		status: envStatus.schemaLifecycle ?? 'UNVERIFIED',
	};
}

function contentFromConnectivity(envStatus: EnvTargetStatus): CompactEnvContentStatus {
	if (!envStatus.configured) {
		return {
			environment: envStatus.environment,
			status: 'CREDENTIALS_REQUIRED',
			detail: envStatus.errorDetail ?? 'Credentials not configured',
		};
	}
	if (!envStatus.reachable) {
		return {
			environment: envStatus.environment,
			status: 'UNREACHABLE',
			detail: envStatus.errorDetail ?? 'Unreachable',
		};
	}
	return {
		environment: envStatus.environment,
		status: 'UNVERIFIED',
		detail: 'Pass pnpm dbs --compact <slug> for package-hash content classification',
	};
}

function contentFromTarget(target: PerInvitationTargetStatus): CompactEnvContentStatus {
	return {
		environment: target.environment,
		status: target.status,
		detail: target.detail,
	};
}

function worstContent(
	left: CompactEnvContentStatus,
	right: CompactEnvContentStatus,
): CompactEnvContentStatus {
	return CONTENT_SEVERITY[right.status] > CONTENT_SEVERITY[left.status] ? right : left;
}

/**
 * Build compact status by composing existing classifiers only.
 *
 * - with slug: CONTENT from evaluateInvitationStatus
 * - aggregateContent: worst-of all definitions (slower; explicit)
 * - default no slug: CONTENT from connectivity only (fast; Git-hook safe)
 */
export async function evaluateCompactManagedStatus(options?: {
	slug?: string;
	aggregateContent?: boolean;
	probeTimeoutMs?: number;
}): Promise<CompactManagedStatus> {
	const perQueryTimeout = options?.probeTimeoutMs ?? MANAGED_STATUS_PER_QUERY_TIMEOUT_MS;
	const general = withStatusProbeTimeout(perQueryTimeout, () => evaluateGeneralStatus());
	const schema = {
		local: schemaFromEnv(general.environments.local),
		preview: schemaFromEnv(general.environments.preview),
		production: schemaFromEnv(general.environments.production),
	} as Record<TargetEnv, CompactEnvSchemaStatus>;

	const slug = options?.slug?.trim() || null;
	if (slug) {
		const invitation = await withStatusProbeTimeout(perQueryTimeout, () =>
			evaluateInvitationStatus(slug),
		);
		return {
			content: {
				local: contentFromTarget(invitation.environments.local),
				preview: contentFromTarget(invitation.environments.preview),
				production: contentFromTarget(invitation.environments.production),
			},
			schema,
			contentSlug: slug,
			contentMode: 'slug',
			readOnly: true,
		};
	}

	if (!options?.aggregateContent) {
		return {
			content: {
				local: contentFromConnectivity(general.environments.local),
				preview: contentFromConnectivity(general.environments.preview),
				production: contentFromConnectivity(general.environments.production),
			},
			schema,
			contentSlug: null,
			contentMode: 'connectivity',
			readOnly: true,
		};
	}

	const definitions = listInvitationDefinitions();
	const content: Record<TargetEnv, CompactEnvContentStatus> = {
		local: { environment: 'local', status: 'NOT_PRESENT', detail: 'No managed definitions' },
		preview: {
			environment: 'preview',
			status: 'NOT_PRESENT',
			detail: 'No managed definitions',
		},
		production: {
			environment: 'production',
			status: 'NOT_PRESENT',
			detail: 'No managed definitions',
		},
	};

	if (definitions.length === 0) {
		return { content, schema, contentSlug: null, contentMode: 'aggregate', readOnly: true };
	}

	let first = true;
	for (const definition of definitions) {
		const invitation = await withStatusProbeTimeout(perQueryTimeout, () =>
			evaluateInvitationStatus(definition.slug),
		);
		for (const env of ENVS) {
			const next = contentFromTarget(invitation.environments[env]);
			content[env] = first ? next : worstContent(content[env], next);
		}
		first = false;
	}

	return { content, schema, contentSlug: null, contentMode: 'aggregate', readOnly: true };
}

function padLabel(label: string, width = 12): string {
	return label.padEnd(width, ' ');
}

function envLabel(env: TargetEnv): string {
	if (env === 'local') return 'Local';
	if (env === 'preview') return 'Preview';
	return 'Production';
}

/** Human compact formatter matching the operational CONTENT/SCHEMA layout. */
export function formatCompactManagedStatus(status: CompactManagedStatus): string {
	const lines: string[] = ['CONTENT'];
	for (const env of ENVS) {
		lines.push(`${padLabel(envLabel(env))}${status.content[env].status}`);
	}
	lines.push('', 'SCHEMA');
	for (const env of ENVS) {
		lines.push(`${padLabel(envLabel(env))}${status.schema[env].status}`);
	}
	return `${lines.join('\n')}\n`;
}

/**
 * Run compact status for Git hooks / CLI. Never throws for expected unavailable
 * remotes; returns a printable string and exit-safe result.
 */
export async function runCompactManagedStatusSafe(options?: {
	slug?: string;
	timeoutMs?: number;
	aggregateContent?: boolean;
}): Promise<
	{ ok: true; text: string; status: CompactManagedStatus } | { ok: false; text: string }
> {
	const timeoutMs = options?.timeoutMs ?? MANAGED_STATUS_DEFAULT_TIMEOUT_MS;
	const perQueryTimeout = Math.max(
		500,
		Math.min(MANAGED_STATUS_PER_QUERY_TIMEOUT_MS, Math.floor(timeoutMs / 3)),
	);
	const previousConnect = process.env.PGCONNECT_TIMEOUT;
	process.env.PGCONNECT_TIMEOUT = String(Math.max(1, Math.ceil(perQueryTimeout / 1000)));

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const status = await Promise.race([
			evaluateCompactManagedStatus({
				slug: options?.slug,
				aggregateContent: options?.aggregateContent,
				probeTimeoutMs: perQueryTimeout,
			}),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('MANAGED_STATUS_TIMEOUT')), timeoutMs);
			}),
		]);
		return { ok: true, text: formatCompactManagedStatus(status), status };
	} catch (error) {
		const message =
			error instanceof Error && error.message === 'MANAGED_STATUS_TIMEOUT'
				? 'Managed status timed out waiting for remote environments (read-only; ignored).'
				: `Managed status unavailable: ${error instanceof Error ? error.message : String(error)}`;
		return { ok: false, text: `${message}\n` };
	} finally {
		if (timer) clearTimeout(timer);
		if (previousConnect === undefined) delete process.env.PGCONNECT_TIMEOUT;
		else process.env.PGCONNECT_TIMEOUT = previousConnect;
	}
}
