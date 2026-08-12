/**
 * managed-status.ts — Compact read-only managed invitation status
 *
 * Composes status-core probes + dbs-status classifiers into a single
 * CONTENT + SCHEMA surface. Fresh evidence only — no dashboard cache,
 * persistent snapshots, or historical healthy fallback.
 *
 * Vocabulary:
 *   CONTENT: MATCH_CANONICAL | BEHIND_CANONICAL | DIVERGED | IDENTITY_CONFLICT |
 *            NOT_PRESENT | UNREACHABLE | CREDENTIALS_REQUIRED | UNVERIFIED
 *   SCHEMA:  CURRENT | BEHIND | SCHEMA_DRIFT | UNVERIFIED
 *
 * UNVERIFIED uses structured { status, domain, reason, evidenceClass? }.
 * Operator labels (CONTENT_UNVERIFIED / SCHEMA_UNVERIFIED) are formatter-only.
 *
 * SCHEMA evidence class is always migration_history_parity here — never equate
 * to object_audit_readiness from pnpm db:*:audit.
 */

import {
	evaluateGeneralStatus,
	evaluateInvitationStatus,
	getOrCreateStatusProbeSession,
	resetStatusProbeSession,
	type EnvTargetStatus,
	type PerInvitationTargetStatus,
	type StatusVocabulary,
	type TargetEnv,
} from './dbs-status.ts';
import {
	DEFAULT_STATUS_SCHEMA_EVIDENCE,
	domainUnverified,
	type SchemaEvidenceClass,
	type SchemaLifecycleState,
	type StatusEvidenceDomain,
} from '../db/schema-lifecycle-state.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { StatusProbeDebugCounters } from '../status-core/index.ts';

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
	/** Present when status is UNVERIFIED. */
	domain?: StatusEvidenceDomain;
	reason?: string;
	detail?: string;
	timeoutDegraded?: boolean;
	durationMs?: number;
}

export interface CompactEnvSchemaStatus {
	environment: TargetEnv;
	status: SchemaLifecycleState;
	/** Present when status is UNVERIFIED. */
	domain?: StatusEvidenceDomain;
	reason?: string;
	evidenceClass: SchemaEvidenceClass;
	detail?: string;
	timeoutDegraded?: boolean;
	durationMs?: number;
}

export interface CompactManagedStatus {
	content: Record<TargetEnv, CompactEnvContentStatus>;
	schema: Record<TargetEnv, CompactEnvSchemaStatus>;
	/** Slug used for CONTENT, or null when CONTENT is connectivity-/aggregate-derived. */
	contentSlug: string | null;
	contentMode: 'slug' | 'aggregate' | 'connectivity';
	/** Per-environment corpus interpretation, available only for aggregate content mode. */
	aggregateSummary?: Record<TargetEnv, AggregateContentSummary>;
	readOnly: true;
	/** True when overall budget forced incomplete probes. */
	timeoutDegraded?: boolean;
	debugCounters?: StatusProbeDebugCounters;
	/** Per-environment durations from this execution (ms). */
	environmentDurationsMs?: Record<TargetEnv, number | undefined>;
}

export interface AggregateContentSummary {
	classification:
		| 'ALL_ALIGNED'
		| 'DRAFT_DIVERGENCE_ONLY'
		| 'BEHIND_OR_CONFLICTED'
		| 'UNVERIFIABLE'
		| 'NO_DEFINITIONS';
	total: number;
	aligned: number;
	draftDiverged: number;
}

function schemaFromEnv(envStatus: EnvTargetStatus): CompactEnvSchemaStatus {
	const lifecycle: SchemaLifecycleState = !envStatus.configured
		? 'UNVERIFIED'
		: !envStatus.reachable
			? 'UNVERIFIED'
			: (envStatus.schemaLifecycle ?? 'UNVERIFIED');
	const detail = !envStatus.configured
		? (envStatus.errorDetail ?? 'Credentials not configured')
		: !envStatus.reachable
			? (envStatus.errorDetail ?? 'Unreachable')
			: undefined;
	const unverified =
		lifecycle === 'UNVERIFIED'
			? domainUnverified(
					'schema',
					detail ??
						'Schema evidence unavailable or not probed; fail-closed (do not infer healthy state).',
					DEFAULT_STATUS_SCHEMA_EVIDENCE,
				)
			: undefined;
	return {
		environment: envStatus.environment,
		status: lifecycle,
		domain: unverified?.domain,
		reason: unverified?.reason,
		evidenceClass: DEFAULT_STATUS_SCHEMA_EVIDENCE,
		detail: unverified?.reason ?? detail,
		timeoutDegraded: envStatus.timeoutDegraded,
		durationMs: envStatus.durationMs,
	};
}

function contentFromConnectivity(envStatus: EnvTargetStatus): CompactEnvContentStatus {
	if (!envStatus.configured) {
		return {
			environment: envStatus.environment,
			status: 'CREDENTIALS_REQUIRED',
			detail: envStatus.errorDetail ?? 'Credentials not configured',
			timeoutDegraded: envStatus.timeoutDegraded,
			durationMs: envStatus.durationMs,
		};
	}
	if (!envStatus.reachable) {
		return {
			environment: envStatus.environment,
			status: 'UNREACHABLE',
			detail: envStatus.errorDetail ?? 'Unreachable',
			timeoutDegraded: envStatus.timeoutDegraded,
			durationMs: envStatus.durationMs,
		};
	}
	const unverified = domainUnverified(
		'content',
		'CONTENT is connectivity only; not publication state. Use pnpm dbs for canonical publication status.',
	);
	return {
		environment: envStatus.environment,
		status: 'UNVERIFIED',
		domain: unverified.domain,
		reason: unverified.reason,
		detail: unverified.reason,
		timeoutDegraded: envStatus.timeoutDegraded,
		durationMs: envStatus.durationMs,
	};
}

function contentFromTarget(target: PerInvitationTargetStatus): CompactEnvContentStatus {
	if (target.status !== 'UNVERIFIED') {
		return {
			environment: target.environment,
			status: target.status,
			detail: target.detail,
			timeoutDegraded: target.timeoutDegraded,
			durationMs: target.durationMs,
		};
	}
	const unverified = domainUnverified(
		'content',
		target.detail ??
			'Content evidence unavailable or not probed; fail-closed (do not infer healthy state).',
	);
	return {
		environment: target.environment,
		status: 'UNVERIFIED',
		domain: unverified.domain,
		reason: unverified.reason,
		detail: unverified.reason,
		timeoutDegraded: target.timeoutDegraded,
		durationMs: target.durationMs,
	};
}

function worstContent(
	left: CompactEnvContentStatus,
	right: CompactEnvContentStatus,
): CompactEnvContentStatus {
	return CONTENT_SEVERITY[right.status] > CONTENT_SEVERITY[left.status] ? right : left;
}

function summarizeAggregateContent(statuses: CompactEnvContentStatus[]): AggregateContentSummary {
	const total = statuses.length;
	const aligned = statuses.filter((status) => status.status === 'MATCH_CANONICAL').length;
	const draftDiverged = statuses.filter((status) => status.status === 'DIVERGED').length;
	if (total === 0) {
		return { classification: 'NO_DEFINITIONS', total, aligned, draftDiverged };
	}
	if (
		statuses.some((status) =>
			['CREDENTIALS_REQUIRED', 'UNREACHABLE', 'UNVERIFIED'].includes(status.status),
		)
	) {
		return { classification: 'UNVERIFIABLE', total, aligned, draftDiverged };
	}
	if (aligned === total) {
		return { classification: 'ALL_ALIGNED', total, aligned, draftDiverged };
	}
	if (aligned + draftDiverged === total && draftDiverged > 0) {
		return { classification: 'DRAFT_DIVERGENCE_ONLY', total, aligned, draftDiverged };
	}
	return { classification: 'BEHIND_OR_CONFLICTED', total, aligned, draftDiverged };
}

function degradedCompactStatus(reason: string): CompactManagedStatus {
	const content = Object.fromEntries(
		ENVS.map((env) => [
			env,
			{
				environment: env,
				status: 'UNREACHABLE' as const,
				detail: reason,
				timeoutDegraded: true,
			},
		]),
	) as Record<TargetEnv, CompactEnvContentStatus>;
	const schema = Object.fromEntries(
		ENVS.map((env) => {
			const unverified = domainUnverified('schema', reason, DEFAULT_STATUS_SCHEMA_EVIDENCE);
			return [
				env,
				{
					environment: env,
					status: 'UNVERIFIED' as const,
					domain: unverified.domain,
					reason: unverified.reason,
					evidenceClass: DEFAULT_STATUS_SCHEMA_EVIDENCE,
					detail: reason,
					timeoutDegraded: true,
				},
			];
		}),
	) as Record<TargetEnv, CompactEnvSchemaStatus>;
	return {
		content,
		schema,
		contentSlug: null,
		contentMode: 'connectivity',
		readOnly: true,
		timeoutDegraded: true,
	};
}

function emitDebugCounters(counters: StatusProbeDebugCounters | undefined, wallMs: number): void {
	const raw = process.env.CELEBRA_MANAGED_STATUS_DEBUG?.trim().toLowerCase();
	if (raw !== '1' && raw !== 'true' && raw !== 'yes') return;
	const payload = {
		invocations: counters?.invocations ?? 0,
		memoHits: counters?.memoHits ?? 0,
		timeoutDegraded: counters?.timeoutDegraded ?? false,
		durationMs: wallMs,
	};
	process.stderr.write(`[managed-status:debug] ${JSON.stringify(payload)}\n`);
}

/**
 * Build compact status by composing status-core probes + existing classifiers.
 *
 * - with slug: CONTENT from evaluateInvitationStatus
 * - aggregateContent: worst-of all definitions (slower; explicit)
 * - default no slug: CONTENT from connectivity only (fast; Git-hook safe)
 */
export async function evaluateCompactManagedStatus(options?: {
	slug?: string;
	aggregateContent?: boolean;
	probeTimeoutMs?: number;
	overallTimeoutMs?: number;
}): Promise<CompactManagedStatus> {
	const wallStart = performance.now();
	resetStatusProbeSession();
	const perQueryTimeout = options?.probeTimeoutMs ?? MANAGED_STATUS_PER_QUERY_TIMEOUT_MS;
	const session = getOrCreateStatusProbeSession(perQueryTimeout);

	const general = await evaluateGeneralStatus({
		includeManagedCounts: false,
		concurrency: 3,
		session,
		overallTimeoutMs: options?.overallTimeoutMs,
	});

	const schema = {
		local: schemaFromEnv(general.environments.local),
		preview: schemaFromEnv(general.environments.preview),
		production: schemaFromEnv(general.environments.production),
	} as Record<TargetEnv, CompactEnvSchemaStatus>;

	const environmentDurationsMs = Object.fromEntries(
		ENVS.map((env) => [env, general.environments[env].durationMs]),
	) as Record<TargetEnv, number | undefined>;

	const slug = options?.slug?.trim() || null;
	if (slug) {
		const invitation = await evaluateInvitationStatus(slug, {
			session,
			concurrency: 3,
			overallTimeoutMs: options?.overallTimeoutMs,
		});
		const status: CompactManagedStatus = {
			content: {
				local: contentFromTarget(invitation.environments.local),
				preview: contentFromTarget(invitation.environments.preview),
				production: contentFromTarget(invitation.environments.production),
			},
			schema,
			contentSlug: slug,
			contentMode: 'slug',
			readOnly: true,
			timeoutDegraded: session.timeoutDegraded,
			debugCounters: session.debugCounters,
			environmentDurationsMs,
		};
		emitDebugCounters(status.debugCounters, Math.round(performance.now() - wallStart));
		return status;
	}

	if (!options?.aggregateContent) {
		const status: CompactManagedStatus = {
			content: {
				local: contentFromConnectivity(general.environments.local),
				preview: contentFromConnectivity(general.environments.preview),
				production: contentFromConnectivity(general.environments.production),
			},
			schema,
			contentSlug: null,
			contentMode: 'connectivity',
			readOnly: true,
			timeoutDegraded: session.timeoutDegraded,
			debugCounters: session.debugCounters,
			environmentDurationsMs,
		};
		emitDebugCounters(status.debugCounters, Math.round(performance.now() - wallStart));
		return status;
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
		const aggregateSummary = Object.fromEntries(
			ENVS.map((env) => [env, summarizeAggregateContent([])]),
		) as Record<TargetEnv, AggregateContentSummary>;
		return {
			content,
			schema,
			contentSlug: null,
			contentMode: 'aggregate',
			aggregateSummary,
			readOnly: true,
			timeoutDegraded: session.timeoutDegraded,
			debugCounters: session.debugCounters,
			environmentDurationsMs,
		};
	}

	const aggregateEntries = {
		local: [] as CompactEnvContentStatus[],
		preview: [] as CompactEnvContentStatus[],
		production: [] as CompactEnvContentStatus[],
	};
	let first = true;
	for (const definition of definitions) {
		const invitation = await evaluateInvitationStatus(definition.slug, {
			session,
			concurrency: 3,
			overallTimeoutMs: options?.overallTimeoutMs,
		});
		for (const env of ENVS) {
			const next = contentFromTarget(invitation.environments[env]);
			aggregateEntries[env].push(next);
			content[env] = first ? next : worstContent(content[env], next);
		}
		first = false;
	}

	const aggregateSummary = {
		local: summarizeAggregateContent(aggregateEntries.local),
		preview: summarizeAggregateContent(aggregateEntries.preview),
		production: summarizeAggregateContent(aggregateEntries.production),
	};
	const status: CompactManagedStatus = {
		content,
		schema,
		contentSlug: null,
		contentMode: 'aggregate',
		aggregateSummary,
		readOnly: true,
		timeoutDegraded: session.timeoutDegraded,
		debugCounters: session.debugCounters,
		environmentDurationsMs,
	};
	emitDebugCounters(status.debugCounters, Math.round(performance.now() - wallStart));
	return status;
}

function padLabel(label: string, width = 12): string {
	return label.padEnd(width, ' ');
}

function envLabel(env: TargetEnv): string {
	if (env === 'local') return 'Local';
	if (env === 'preview') return 'Preview';
	return 'Production';
}

/** Formatter-only operator label for structured UNVERIFIED results. */
function formatUnverifiedOperatorLabel(domain: StatusEvidenceDomain): string {
	return `${domain.toUpperCase()}_UNVERIFIED`;
}

function formatContentLabel(content: CompactEnvContentStatus): string {
	if (content.status === 'UNVERIFIED' && content.domain) {
		return formatUnverifiedOperatorLabel(content.domain);
	}
	return content.status;
}

function formatSchemaLabel(schema: CompactEnvSchemaStatus): string {
	if (schema.status === 'UNVERIFIED') {
		return formatUnverifiedOperatorLabel(schema.domain ?? 'schema');
	}
	return schema.status;
}

/** Human compact formatter matching the operational CONTENT/SCHEMA layout. */
export function formatCompactManagedStatus(status: CompactManagedStatus): string {
	const lines: string[] = ['CONTENT'];
	if (status.contentMode === 'connectivity') {
		lines.push('(connectivity only; not publication state — use pnpm dbs)');
	}
	for (const env of ENVS) {
		const content = status.content[env];
		lines.push(`${padLabel(envLabel(env))}${formatContentLabel(content)}`);
	}
	lines.push('', 'SCHEMA');
	for (const env of ENVS) {
		const schema = status.schema[env];
		lines.push(`${padLabel(envLabel(env))}${formatSchemaLabel(schema)}`);
	}
	if (status.aggregateSummary) {
		lines.push('', 'CORPUS');
		for (const env of ENVS) {
			const summary = status.aggregateSummary[env];
			lines.push(
				`${padLabel(envLabel(env))}${summary.classification} (${summary.aligned}/${summary.total} aligned; ${summary.draftDiverged} draft divergence)`,
			);
		}
	}
	return `${lines.join('\n')}\n`;
}

/**
 * Run compact status for Git hooks / CLI. Never throws for expected unavailable
 * remotes; returns a printable string and exit-safe result.
 * On overall timeout: emits UNREACHABLE/UNVERIFIED with timeoutDegraded — never healthy.
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
				overallTimeoutMs: timeoutMs,
			}),
			new Promise<CompactManagedStatus>((resolve) => {
				timer = setTimeout(() => {
					resolve(
						degradedCompactStatus(
							'Managed status timed out waiting for remote environments (timeout degraded; not a proven outage).',
						),
					);
				}, timeoutMs);
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
		resetStatusProbeSession();
	}
}
