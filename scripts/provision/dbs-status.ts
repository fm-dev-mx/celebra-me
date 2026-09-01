/**
 * dbs-status.ts — Unified Read-Only Environment Status Engine
 *
 * Evaluates Local, Preview, and Production environment status, DB connectivity,
 * optional managed invitation counts, and per-invitation parity across targets.
 *
 * Vocabulary:
 *   MATCH_CANONICAL, BEHIND_CANONICAL, DIVERGED, IDENTITY_CONFLICT, NOT_PRESENT, UNREACHABLE, CREDENTIALS_REQUIRED, UNVERIFIED
 *
 * Schema lifecycle (separate vocabulary): CURRENT | BEHIND | SCHEMA_DRIFT | UNVERIFIED
 *
 * Probe I/O is owned by scripts/status-core (execution-local memoization).
 */

import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	getProdDbUrl,
} from '../db/db-workflow-lib.ts';
import { LOCAL_DB_URL, classifyDbTarget, redactDbUrl } from '../db/db-guard.ts';
import { assertCurrentDisposableMigrationProof } from '../db/disposable-migration-proof.ts';
import type { SchemaLifecycleState } from '../db/schema-lifecycle-state.ts';
import {
	StatusProbeSession,
	mapPool,
	listExpectedMigrationVersions,
	readMigrationLifecycleForUrl,
	readMigrationLifecycleForUrlSync,
	readManagedInvitationMeta,
	readManagedInvitationMetaSync,
	classifyManagedInvitationMeta,
	createLiveFreshness,
	type FreshnessMeta,
	type StatusProbeDebugCounters,
} from '../status-core/index.ts';
import { listInvitationDefinitions, getInvitationDefinition } from './invitations/registry.ts';
import { buildNormalizedInvitationRelease } from './normalized-invitation-release.ts';
import { serializeInvitationPackage } from './invitation-package.ts';

export { listExpectedMigrationVersions };

/** Per-psql wall clock used by compact/Git-hook probes when set. */
let statusProbeTimeoutMs: number | undefined;

/** Active execution-local session (set by withStatusProbeSession / evaluate* helpers). */
let activeSession: StatusProbeSession | undefined;

export function withStatusProbeTimeout<T>(timeoutMs: number | undefined, run: () => T): T {
	const previous = statusProbeTimeoutMs;
	statusProbeTimeoutMs = timeoutMs;
	try {
		return run();
	} finally {
		statusProbeTimeoutMs = previous;
	}
}

export function getOrCreateStatusProbeSession(
	timeoutMs: number | undefined = statusProbeTimeoutMs,
): StatusProbeSession {
	if (activeSession && activeSession.timeoutMs === timeoutMs) return activeSession;
	activeSession = new StatusProbeSession({ timeoutMs, readOnly: true });
	return activeSession;
}

export function resetStatusProbeSession(): void {
	activeSession = undefined;
}

export function getStatusProbeDebugCounters(): StatusProbeDebugCounters | null {
	return activeSession?.debugCounters ?? null;
}

export type StatusVocabulary =
	| 'MATCH_CANONICAL'
	| 'BEHIND_CANONICAL'
	| 'DIVERGED'
	| 'IDENTITY_CONFLICT'
	| 'NOT_PRESENT'
	| 'UNREACHABLE'
	| 'CREDENTIALS_REQUIRED'
	| 'UNVERIFIED';

export type TargetEnv = 'local' | 'preview' | 'production';

export type SchemaOperationReadiness =
	| 'READY'
	| 'NEEDS_DISPOSABLE_PROOF'
	| 'PENDING_MIGRATIONS'
	| 'SCHEMA_DRIFT'
	| 'UNREACHABLE'
	| 'NOT_CONFIGURED'
	| 'UNVERIFIED';

export interface EnvTargetStatus {
	environment: TargetEnv;
	configured: boolean;
	reachable: boolean;
	dbUrlRedacted: string;
	targetClassification: string;
	activeManagedCount: number;
	identityConflictsCount: number;
	schemaLifecycle?: SchemaLifecycleState;
	migrationHead?: string | null;
	pendingMigrationsCount?: number;
	/** Pending migration version identities (shared with observability migration health). */
	pendingMigrations?: string[];
	extraMigrations?: string[];
	/** Count of migration versions applied on the remote target. */
	appliedMigrationCount?: number | null;
	/**
	 * Operation readiness for schema migrate (distinct from history-parity CURRENT).
	 * CURRENT history alone is not sufficient when disposable proof is missing.
	 */
	schemaOperationReadiness?: SchemaOperationReadiness;
	/** Exact next schema action for this environment, when actionable. */
	schemaNextAction?: string | null;
	errorDetail?: string;
	freshness?: FreshnessMeta;
	/** Wall duration for this environment probe (ms), when measured. */
	durationMs?: number;
	timeoutDegraded?: boolean;
}

export interface GeneralStatusSummary {
	environments: Record<TargetEnv, EnvTargetStatus>;
	totalDefinitionsCount: number;
	/** First incomplete lifecycle action across disposable proof → local → preview → production. */
	schemaNextAction?: string | null;
	disposableProofOk?: boolean;
	disposableProofDetail?: string;
	debugCounters?: StatusProbeDebugCounters;
}

function schemaAuditCommand(env: TargetEnv): string {
	if (env === 'local') return 'pnpm db:local:audit';
	if (env === 'preview') return 'pnpm db:preview:audit';
	return 'pnpm db:prod:audit';
}

function availabilityVerifyCommand(env: TargetEnv): string {
	return `pnpm db:availability:verify -- --targets ${env}`;
}

function deriveSchemaOperationFields(
	env: TargetEnv,
	status: Pick<
		EnvTargetStatus,
		| 'configured'
		| 'reachable'
		| 'schemaLifecycle'
		| 'pendingMigrationsCount'
		| 'extraMigrations'
	>,
	disposableProofOk: boolean,
): Pick<EnvTargetStatus, 'schemaOperationReadiness' | 'schemaNextAction'> {
	if (!status.configured) {
		return {
			schemaOperationReadiness: 'NOT_CONFIGURED',
			schemaNextAction: availabilityVerifyCommand(env),
		};
	}
	if (!status.reachable) {
		return {
			schemaOperationReadiness: 'UNREACHABLE',
			schemaNextAction: availabilityVerifyCommand(env),
		};
	}
	if (status.schemaLifecycle === 'SCHEMA_DRIFT' || (status.extraMigrations?.length ?? 0) > 0) {
		return {
			schemaOperationReadiness: 'SCHEMA_DRIFT',
			schemaNextAction: schemaAuditCommand(env),
		};
	}
	if (status.schemaLifecycle === 'UNVERIFIED' || status.schemaLifecycle === undefined) {
		return { schemaOperationReadiness: 'UNVERIFIED', schemaNextAction: 'pnpm dbs' };
	}
	const pending = status.pendingMigrationsCount ?? 0;
	if (pending > 0) {
		if (!disposableProofOk) {
			return {
				schemaOperationReadiness: 'NEEDS_DISPOSABLE_PROOF',
				schemaNextAction: 'pnpm db:migrate -- --target disposable-test --apply',
			};
		}
		const targetFlag =
			env === 'production' ? 'production' : env === 'preview' ? 'preview' : 'local';
		return {
			schemaOperationReadiness: 'PENDING_MIGRATIONS',
			schemaNextAction: `pnpm db:migrate -- --target ${targetFlag}`,
		};
	}
	return { schemaOperationReadiness: 'READY', schemaNextAction: null };
}

function deriveGlobalSchemaNextAction(
	environments: Record<TargetEnv, EnvTargetStatus>,
	disposableProofOk: boolean,
): string | null {
	if (!disposableProofOk) {
		const anyPending = (['local', 'preview', 'production'] as const).some(
			(env) => (environments[env].pendingMigrationsCount ?? 0) > 0,
		);
		if (anyPending) {
			return 'pnpm db:migrate -- --target disposable-test --apply';
		}
	}
	for (const env of ['local', 'preview', 'production'] as const) {
		const action = environments[env].schemaNextAction;
		if (action && environments[env].schemaOperationReadiness === 'PENDING_MIGRATIONS') {
			return action;
		}
	}
	for (const env of ['local', 'preview', 'production'] as const) {
		if (environments[env].schemaOperationReadiness === 'SCHEMA_DRIFT') {
			return environments[env].schemaNextAction ?? null;
		}
	}
	return null;
}

export interface PerInvitationTargetStatus {
	environment: TargetEnv;
	status: StatusVocabulary;
	activeMatchCount: number;
	resolvedId: string | null;
	resolvedSlug: string | null;
	provenanceDefinitionSlug: string | null;
	provenancePackageHash: string | null;
	provenanceAppliedAt: string | null;
	publishedVersion: number | null;
	publishedAt: string | null;
	assetCount: number;
	detail: string;
	freshness?: FreshnessMeta;
	timeoutDegraded?: boolean;
	durationMs?: number;
}

export interface PerInvitationStatusSummary {
	slug: string;
	title: string;
	eventType: string;
	environments: Record<TargetEnv, PerInvitationTargetStatus>;
	debugCounters?: StatusProbeDebugCounters;
}

export function resolveDbUrlForEnv(env: TargetEnv): { dbUrl: string | null; error?: string } {
	if (env === 'local') {
		const url = process.env.LOCAL_DB_URL?.trim() || LOCAL_DB_URL;
		return { dbUrl: url };
	}
	if (env === 'preview') {
		const url = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES).trim();
		if (!url) return { dbUrl: null, error: 'PREVIEW_DB_URL not configured' };
		return { dbUrl: url };
	}
	if (env === 'production') {
		try {
			const prodInfo = getProdDbUrl();
			if (!prodInfo?.url) return { dbUrl: null, error: 'PROD_DB_URL not configured' };
			return { dbUrl: prodInfo.url };
		} catch {
			const url = process.env.PROD_DB_URL?.trim();
			if (!url) return { dbUrl: null, error: 'PROD_DB_URL not configured' };
			return { dbUrl: url };
		}
	}
	return { dbUrl: null, error: 'Unknown environment' };
}

function countActiveManagedInvitations(
	session: StatusProbeSession,
	dbUrl: string,
): { activeCount: number; conflictsCount: number } {
	const res = session.psqlSync(
		`select count(*), count(distinct slug) from public.invitations where archived_at is null;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (res.status !== 0 || !res.stdout.trim()) return { activeCount: 0, conflictsCount: 0 };
	const [totalStr, distinctStr] = res.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());
	const total = Number(totalStr || '0');
	const distinct = Number(distinctStr || '0');
	return {
		activeCount: total,
		conflictsCount: Math.max(0, total - distinct),
	};
}

export interface GeneralEnvStatusOptions {
	/** Include managed invitation row counts (full matrix). Compact skips this. */
	includeManagedCounts?: boolean;
	session?: StatusProbeSession;
	timeoutDegraded?: boolean;
}

export function getGeneralEnvStatus(
	env: TargetEnv,
	options: GeneralEnvStatusOptions = {},
): EnvTargetStatus {
	const includeManagedCounts = options.includeManagedCounts !== false;
	const session = options.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	const started = performance.now();
	const freshness = createLiveFreshness(Boolean(options.timeoutDegraded));

	const { dbUrl, error } = resolveDbUrlForEnv(env);
	if (!dbUrl) {
		return {
			environment: env,
			configured: false,
			reachable: false,
			dbUrlRedacted: '(not configured)',
			targetClassification: 'unknown',
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'UNVERIFIED',
			errorDetail: error,
			freshness,
			durationMs: Math.round(performance.now() - started),
			timeoutDegraded: options.timeoutDegraded,
		};
	}

	const classification = classifyDbTarget(dbUrl);
	const reachable = session.probeConnectivitySync(dbUrl);
	if (!reachable) {
		return {
			environment: env,
			configured: true,
			reachable: false,
			dbUrlRedacted: redactDbUrl(dbUrl),
			targetClassification: classification.target,
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'UNVERIFIED',
			errorDetail: options.timeoutDegraded
				? 'Probe budget exhausted before environment verification (timeout degraded)'
				: 'Database connection check failed or timed out',
			freshness,
			durationMs: Math.round(performance.now() - started),
			timeoutDegraded: options.timeoutDegraded,
		};
	}

	const counts = includeManagedCounts
		? countActiveManagedInvitations(session, dbUrl)
		: { activeCount: 0, conflictsCount: 0 };
	const schema = readMigrationLifecycleForUrlSync(dbUrl, session);
	const base = {
		environment: env,
		configured: true,
		reachable: true,
		dbUrlRedacted: redactDbUrl(dbUrl),
		targetClassification: classification.target,
		activeManagedCount: counts.activeCount,
		identityConflictsCount: counts.conflictsCount,
		schemaLifecycle: schema.schemaLifecycle,
		migrationHead: schema.migrationHead,
		pendingMigrationsCount: schema.pendingMigrations.length,
		pendingMigrations: schema.pendingMigrations,
		extraMigrations: schema.extraMigrations,
		appliedMigrationCount: schema.appliedMigrationCount,
		freshness,
		durationMs: Math.round(performance.now() - started),
		timeoutDegraded: options.timeoutDegraded,
	};
	const disposableProofOk = assertCurrentDisposableMigrationProof().ok;
	return { ...base, ...deriveSchemaOperationFields(env, base, disposableProofOk) };
}

async function getGeneralEnvStatusAsync(
	env: TargetEnv,
	options: GeneralEnvStatusOptions = {},
): Promise<EnvTargetStatus> {
	const includeManagedCounts = options.includeManagedCounts !== false;
	const session = options.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	const started = performance.now();
	const freshness = createLiveFreshness(Boolean(options.timeoutDegraded));

	const { dbUrl, error } = resolveDbUrlForEnv(env);
	if (!dbUrl) {
		return {
			environment: env,
			configured: false,
			reachable: false,
			dbUrlRedacted: '(not configured)',
			targetClassification: 'unknown',
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'UNVERIFIED',
			errorDetail: error,
			freshness,
			durationMs: Math.round(performance.now() - started),
			timeoutDegraded: options.timeoutDegraded,
		};
	}

	const classification = classifyDbTarget(dbUrl);
	const reachable = await session.probeConnectivity(dbUrl);
	if (!reachable) {
		return {
			environment: env,
			configured: true,
			reachable: false,
			dbUrlRedacted: redactDbUrl(dbUrl),
			targetClassification: classification.target,
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'UNVERIFIED',
			errorDetail: options.timeoutDegraded
				? 'Probe budget exhausted before environment verification (timeout degraded)'
				: 'Database connection check failed or timed out',
			freshness,
			durationMs: Math.round(performance.now() - started),
			timeoutDegraded: options.timeoutDegraded,
		};
	}

	let activeManagedCount = 0;
	let identityConflictsCount = 0;
	if (includeManagedCounts) {
		const countRes = await session.psql(
			`select count(*), count(distinct slug) from public.invitations where archived_at is null;`,
			dbUrl,
			{ tuplesOnly: true },
		);
		if (countRes.status === 0 && countRes.stdout.trim()) {
			const [totalStr, distinctStr] = countRes.stdout
				.trim()
				.split('|')
				.map((s) => s.trim());
			const total = Number(totalStr || '0');
			const distinct = Number(distinctStr || '0');
			activeManagedCount = total;
			identityConflictsCount = Math.max(0, total - distinct);
		}
	}

	const schema = await readMigrationLifecycleForUrl(dbUrl, session);

	const base = {
		environment: env,
		configured: true,
		reachable: true,
		dbUrlRedacted: redactDbUrl(dbUrl),
		targetClassification: classification.target,
		activeManagedCount,
		identityConflictsCount,
		schemaLifecycle: schema.schemaLifecycle,
		migrationHead: schema.migrationHead,
		pendingMigrationsCount: schema.pendingMigrations.length,
		pendingMigrations: schema.pendingMigrations,
		extraMigrations: schema.extraMigrations,
		appliedMigrationCount: schema.appliedMigrationCount,
		freshness,
		durationMs: Math.round(performance.now() - started),
		timeoutDegraded: options.timeoutDegraded,
	};
	const disposableProofOk = assertCurrentDisposableMigrationProof().ok;
	return { ...base, ...deriveSchemaOperationFields(env, base, disposableProofOk) };
}

function unprobedGeneralEnv(env: TargetEnv): EnvTargetStatus {
	return {
		environment: env,
		configured: false,
		reachable: false,
		dbUrlRedacted: '(not probed)',
		targetClassification: 'unknown',
		activeManagedCount: 0,
		identityConflictsCount: 0,
		schemaLifecycle: 'UNVERIFIED',
		pendingMigrations: [],
		appliedMigrationCount: null,
		errorDetail: 'Not probed in this observability scope',
		freshness: createLiveFreshness(false),
	};
}

function timeoutUnverifiedEnv(env: TargetEnv): EnvTargetStatus {
	return {
		environment: env,
		configured: true,
		reachable: false,
		dbUrlRedacted: '(timeout degraded)',
		targetClassification: 'unknown',
		activeManagedCount: 0,
		identityConflictsCount: 0,
		schemaLifecycle: 'UNVERIFIED',
		pendingMigrations: [],
		appliedMigrationCount: null,
		errorDetail: 'Probe budget exhausted before environment verification (timeout degraded)',
		freshness: createLiveFreshness(true),
		timeoutDegraded: true,
	};
}

export interface EvaluateGeneralStatusOptions {
	environments?: readonly TargetEnv[];
	/** Default true for full matrix; compact connectivity sets false. */
	includeManagedCounts?: boolean;
	/** Max concurrent environment probes (default 3). */
	concurrency?: number;
	session?: StatusProbeSession;
	/** Overall wall budget; unfinished envs become timeout-degraded UNVERIFIED. */
	overallTimeoutMs?: number;
}

/**
 * Async general status with bounded parallel environment probes.
 */
export async function evaluateGeneralStatus(
	options?: EvaluateGeneralStatusOptions,
): Promise<GeneralStatusSummary> {
	const probeEnvs: TargetEnv[] = options?.environments
		? [...options.environments]
		: ['local', 'preview', 'production'];
	const includeManagedCounts = options?.includeManagedCounts !== false;
	const concurrency = options?.concurrency ?? 3;
	const session = options?.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	activeSession = session;

	const definitions = listInvitationDefinitions();
	const allEnvs: TargetEnv[] = ['local', 'preview', 'production'];
	const collected = new Map<TargetEnv, EnvTargetStatus>();

	const work = mapPool(probeEnvs, concurrency, async (env) => {
		const status = await getGeneralEnvStatusAsync(env, {
			includeManagedCounts,
			session,
		});
		collected.set(env, status);
		return status;
	});

	if (typeof options?.overallTimeoutMs === 'number' && options.overallTimeoutMs > 0) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				work,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('GENERAL_STATUS_TIMEOUT')),
						options.overallTimeoutMs,
					);
				}),
			]);
		} catch (error) {
			if (error instanceof Error && error.message === 'GENERAL_STATUS_TIMEOUT') {
				session.markTimeoutDegraded();
			} else {
				throw error;
			}
		} finally {
			if (timer) clearTimeout(timer);
		}
	} else {
		await work;
	}

	const environments = {
		local: unprobedGeneralEnv('local'),
		preview: unprobedGeneralEnv('preview'),
		production: unprobedGeneralEnv('production'),
	} as Record<TargetEnv, EnvTargetStatus>;

	for (const env of allEnvs) {
		if (!probeEnvs.includes(env)) {
			environments[env] = unprobedGeneralEnv(env);
			continue;
		}
		environments[env] = collected.get(env) ?? timeoutUnverifiedEnv(env);
	}

	const proof = assertCurrentDisposableMigrationProof();
	return {
		environments,
		totalDefinitionsCount: definitions.length,
		disposableProofOk: proof.ok,
		disposableProofDetail: proof.reason,
		schemaNextAction: deriveGlobalSchemaNextAction(environments, proof.ok),
		debugCounters: session.debugCounters,
	};
}

/**
 * Read-only per-environment invitation status probe.
 * Pass `canonicalHash` for managed package-hash classification; pass `null`
 * for presence-only checks (legacy corpus / reference-relative callers).
 */
export function evaluateSingleTargetStatus(
	env: TargetEnv,
	slug: string,
	canonicalHash: string | null,
	options: { session?: StatusProbeSession; timeoutDegraded?: boolean } = {},
): PerInvitationTargetStatus {
	const session = options.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	const started = performance.now();
	const freshness = createLiveFreshness(Boolean(options.timeoutDegraded));
	const { dbUrl, error } = resolveDbUrlForEnv(env);

	const base = (
		status: StatusVocabulary,
		detail: string,
		extra: Partial<PerInvitationTargetStatus> = {},
	): PerInvitationTargetStatus => ({
		environment: env,
		status,
		activeMatchCount: 0,
		resolvedId: null,
		resolvedSlug: null,
		provenanceDefinitionSlug: null,
		provenancePackageHash: null,
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		detail,
		freshness,
		timeoutDegraded: options.timeoutDegraded,
		durationMs: Math.round(performance.now() - started),
		...extra,
	});

	if (!dbUrl) {
		return base('CREDENTIALS_REQUIRED', error || 'Target credentials not configured');
	}

	if (!session.probeConnectivitySync(dbUrl)) {
		return base(
			'UNREACHABLE',
			options.timeoutDegraded
				? 'Probe budget exhausted before environment verification (timeout degraded)'
				: 'Target database unreachable',
		);
	}

	const meta = readManagedInvitationMetaSync(session, dbUrl, slug);
	const classified = classifyManagedInvitationMeta(meta, canonicalHash, slug);

	return base(classified.status, classified.detail, {
		activeMatchCount: classified.activeMatchCount,
		resolvedId: classified.resolvedId,
		resolvedSlug: classified.resolvedSlug,
		provenanceDefinitionSlug: classified.provenanceDefinitionSlug,
		provenancePackageHash: classified.provenancePackageHash,
		provenanceAppliedAt: classified.provenanceAppliedAt,
		publishedVersion: classified.publishedVersion,
		publishedAt: classified.publishedAt,
		assetCount: classified.assetCount,
	});
}

async function evaluateSingleTargetStatusAsync(
	env: TargetEnv,
	slug: string,
	canonicalHash: string | null,
	options: { session?: StatusProbeSession; timeoutDegraded?: boolean } = {},
): Promise<PerInvitationTargetStatus> {
	const session = options.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	const started = performance.now();
	const freshness = createLiveFreshness(Boolean(options.timeoutDegraded));
	const { dbUrl, error } = resolveDbUrlForEnv(env);

	const base = (
		status: StatusVocabulary,
		detail: string,
		extra: Partial<PerInvitationTargetStatus> = {},
	): PerInvitationTargetStatus => ({
		environment: env,
		status,
		activeMatchCount: 0,
		resolvedId: null,
		resolvedSlug: null,
		provenanceDefinitionSlug: null,
		provenancePackageHash: null,
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		detail,
		freshness,
		timeoutDegraded: options.timeoutDegraded,
		durationMs: Math.round(performance.now() - started),
		...extra,
	});

	if (!dbUrl) {
		return base('CREDENTIALS_REQUIRED', error || 'Target credentials not configured');
	}

	if (!(await session.probeConnectivity(dbUrl))) {
		return base(
			'UNREACHABLE',
			options.timeoutDegraded
				? 'Probe budget exhausted before environment verification (timeout degraded)'
				: 'Target database unreachable',
		);
	}

	const meta = await readManagedInvitationMeta(session, dbUrl, slug);
	const classified = classifyManagedInvitationMeta(meta, canonicalHash, slug);

	return base(classified.status, classified.detail, {
		activeMatchCount: classified.activeMatchCount,
		resolvedId: classified.resolvedId,
		resolvedSlug: classified.resolvedSlug,
		provenanceDefinitionSlug: classified.provenanceDefinitionSlug,
		provenancePackageHash: classified.provenancePackageHash,
		provenanceAppliedAt: classified.provenanceAppliedAt,
		publishedVersion: classified.publishedVersion,
		publishedAt: classified.publishedAt,
		assetCount: classified.assetCount,
	});
}

function timeoutUnreachableTarget(env: TargetEnv): PerInvitationTargetStatus {
	return {
		environment: env,
		status: 'UNREACHABLE',
		activeMatchCount: 0,
		resolvedId: null,
		resolvedSlug: null,
		provenanceDefinitionSlug: null,
		provenancePackageHash: null,
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		detail: 'Probe budget exhausted before environment verification (timeout degraded)',
		freshness: createLiveFreshness(true),
		timeoutDegraded: true,
	};
}

export async function evaluateInvitationStatus(
	slug: string,
	options?: {
		session?: StatusProbeSession;
		concurrency?: number;
		overallTimeoutMs?: number;
	},
): Promise<PerInvitationStatusSummary> {
	const definition = getInvitationDefinition(slug);
	const envs: TargetEnv[] = ['local', 'preview', 'production'];
	const session = options?.session ?? getOrCreateStatusProbeSession(statusProbeTimeoutMs);
	activeSession = session;
	const concurrency = options?.concurrency ?? 3;

	let canonicalHash: string | null = null;
	try {
		const release = await buildNormalizedInvitationRelease({ slug, purpose: 'package' });
		canonicalHash = serializeInvitationPackage(release).packageHash;
	} catch {
		// Canonical hash calculation unavailable; status falls back to provenance presence check.
	}

	const collected = new Map<TargetEnv, PerInvitationTargetStatus>();
	const work = mapPool(envs, concurrency, async (env) => {
		const status = await evaluateSingleTargetStatusAsync(env, slug, canonicalHash, {
			session,
		});
		collected.set(env, status);
		return status;
	});

	if (typeof options?.overallTimeoutMs === 'number' && options.overallTimeoutMs > 0) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				work,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('INVITATION_STATUS_TIMEOUT')),
						options.overallTimeoutMs,
					);
				}),
			]);
		} catch (error) {
			if (error instanceof Error && error.message === 'INVITATION_STATUS_TIMEOUT') {
				session.markTimeoutDegraded();
			} else {
				throw error;
			}
		} finally {
			if (timer) clearTimeout(timer);
		}
	} else {
		await work;
	}

	return {
		slug: definition.slug,
		title: definition.title,
		eventType: definition.eventType,
		environments: {
			local: collected.get('local') ?? timeoutUnreachableTarget('local'),
			preview: collected.get('preview') ?? timeoutUnreachableTarget('preview'),
			production: collected.get('production') ?? timeoutUnreachableTarget('production'),
		},
		debugCounters: session.debugCounters,
	};
}
