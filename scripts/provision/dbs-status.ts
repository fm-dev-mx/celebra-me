/**
 * dbs-status.ts — Unified Read-Only Environment Status Engine
 *
 * Evaluates Local, Preview, and Production environment status, DB connectivity,
 * managed invitation counts, identity conflicts, and per-invitation parity across targets.
 *
 * Vocabulary:
 *   MATCH_CANONICAL, BEHIND_CANONICAL, DIVERGED, IDENTITY_CONFLICT, NOT_PRESENT, UNREACHABLE, CREDENTIALS_REQUIRED, UNVERIFIED
 *
 * Schema lifecycle (separate vocabulary): CURRENT | BEHIND | SCHEMA_DRIFT | UNVERIFIED
 */

import {
	runPsql,
	sqlLiteral,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	getProdDbUrl,
	PROJECT_ROOT,
} from '../db/db-workflow-lib.ts';
import { LOCAL_DB_URL, classifyDbTarget, redactDbUrl } from '../db/db-guard.ts';
import { evaluateMigrationHistoryParity, fetchRemoteMigrationVersions } from '../db/audit-db.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import { listInvitationDefinitions, getInvitationDefinition } from './invitations/registry.ts';
import { buildNormalizedInvitationRelease } from './normalized-invitation-release.ts';
import { serializeInvitationPackage } from './invitation-package.ts';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Per-psql wall clock used by compact/Git-hook probes when set. */
let statusProbeTimeoutMs: number | undefined;

export function withStatusProbeTimeout<T>(timeoutMs: number | undefined, run: () => T): T {
	const previous = statusProbeTimeoutMs;
	statusProbeTimeoutMs = timeoutMs;
	try {
		return run();
	} finally {
		statusProbeTimeoutMs = previous;
	}
}

function psqlOptions(extra: { tuplesOnly?: boolean; throwOnError?: boolean } = {}) {
	return {
		...extra,
		...(typeof statusProbeTimeoutMs === 'number' ? { timeoutMs: statusProbeTimeoutMs } : {}),
	};
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
	errorDetail?: string;
}

export interface GeneralStatusSummary {
	environments: Record<TargetEnv, EnvTargetStatus>;
	totalDefinitionsCount: number;
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
}

export interface PerInvitationStatusSummary {
	slug: string;
	title: string;
	eventType: string;
	environments: Record<TargetEnv, PerInvitationTargetStatus>;
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

function testConnectivity(dbUrl: string): boolean {
	const res = runPsql('select 1;', dbUrl, psqlOptions({ tuplesOnly: true, throwOnError: false }));
	return res.status === 0 && res.stdout.trim() === '1';
}

function countActiveManagedInvitations(dbUrl: string): {
	activeCount: number;
	conflictsCount: number;
} {
	const res = runPsql(
		`select count(*), count(distinct slug) from public.invitations where archived_at is null;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
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

export function listExpectedMigrationVersions(): string[] {
	const migrationsDir = resolve(PROJECT_ROOT, 'supabase', 'migrations');
	if (!existsSync(migrationsDir)) return [];
	return readdirSync(migrationsDir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => f.split('_')[0]!)
		.filter(Boolean);
}

function evaluateSchemaLifecycleForUrl(dbUrl: string): {
	schemaLifecycle: SchemaLifecycleState;
	migrationHead: string | null;
	pendingMigrationsCount: number;
} {
	try {
		const expected = listExpectedMigrationVersions();
		const remote = fetchRemoteMigrationVersions(dbUrl);
		const parity = evaluateMigrationHistoryParity(expected, remote.remoteVersions);
		const schemaLifecycle = classifySchemaLifecycle({
			pendingMigrations: parity.pendingLocal,
			extraMigrations: parity.extraRemote,
			mismatchedMigrations:
				parity.isReordered || parity.hasDivergentHistory
					? parity.extraRemote.length > 0
						? parity.extraRemote
						: ['divergent-history']
					: [],
			auditErrors: parity.errors.filter((e) => !e.startsWith('Pending local migrations')),
			verified: true,
		});
		return {
			schemaLifecycle,
			migrationHead: remote.remoteVersions.at(-1) ?? null,
			pendingMigrationsCount: parity.pendingLocal.length,
		};
	} catch {
		return {
			schemaLifecycle: 'UNVERIFIED',
			migrationHead: null,
			pendingMigrationsCount: 0,
		};
	}
}

export function getGeneralEnvStatus(env: TargetEnv): EnvTargetStatus {
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
		};
	}

	const classification = classifyDbTarget(dbUrl);
	const reachable = testConnectivity(dbUrl);
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
			errorDetail: 'Database connection check failed or timed out',
		};
	}

	const { activeCount, conflictsCount } = countActiveManagedInvitations(dbUrl);
	const schema = evaluateSchemaLifecycleForUrl(dbUrl);

	return {
		environment: env,
		configured: true,
		reachable: true,
		dbUrlRedacted: redactDbUrl(dbUrl),
		targetClassification: classification.target,
		activeManagedCount: activeCount,
		identityConflictsCount: conflictsCount,
		schemaLifecycle: schema.schemaLifecycle,
		migrationHead: schema.migrationHead,
		pendingMigrationsCount: schema.pendingMigrationsCount,
	};
}

export function evaluateGeneralStatus(): GeneralStatusSummary {
	const local = getGeneralEnvStatus('local');
	const preview = getGeneralEnvStatus('preview');
	const production = getGeneralEnvStatus('production');
	const definitions = listInvitationDefinitions();

	return {
		environments: { local, preview, production },
		totalDefinitionsCount: definitions.length,
	};
}

/**
 * Read-only per-environment invitation status probe.
 * Pass `canonicalHash` for managed package-hash classification; pass `null`
 * for presence-only checks (legacy corpus / reference-relative callers).
 */
// eslint-disable-next-line complexity -- Per-environment status has many fail-closed branches.
export function evaluateSingleTargetStatus(
	env: TargetEnv,
	slug: string,
	canonicalHash: string | null,
): PerInvitationTargetStatus {
	const { dbUrl, error } = resolveDbUrlForEnv(env);
	if (!dbUrl) {
		return {
			environment: env,
			status: 'CREDENTIALS_REQUIRED',
			activeMatchCount: 0,
			resolvedId: null,
			resolvedSlug: null,
			provenanceDefinitionSlug: null,
			provenancePackageHash: null,
			provenanceAppliedAt: null,
			publishedVersion: null,
			publishedAt: null,
			assetCount: 0,
			detail: error || 'Target credentials not configured',
		};
	}

	if (!testConnectivity(dbUrl)) {
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
			detail: 'Target database unreachable',
		};
	}

	// Query active matching invitations for slug
	const matchRes = runPsql(
		`select id::text, slug, created_at::text from public.invitations where slug = ${sqlLiteral(slug)} and archived_at is null;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
	);
	if (matchRes.status !== 0) {
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
			detail: 'Target database query failed',
		};
	}
	const rows = matchRes.stdout.trim().split('\n').filter(Boolean);

	if (rows.length === 0) {
		return {
			environment: env,
			status: 'NOT_PRESENT',
			activeMatchCount: 0,
			resolvedId: null,
			resolvedSlug: null,
			provenanceDefinitionSlug: null,
			provenancePackageHash: null,
			provenanceAppliedAt: null,
			publishedVersion: null,
			publishedAt: null,
			assetCount: 0,
			detail: `Invitation ${slug} not present in target DB`,
		};
	}

	if (rows.length > 1) {
		const matchingIds = rows.map((r) => r.split('|')[0]!.trim());
		return {
			environment: env,
			status: 'IDENTITY_CONFLICT',
			activeMatchCount: rows.length,
			resolvedId: null,
			resolvedSlug: slug,
			provenanceDefinitionSlug: null,
			provenancePackageHash: null,
			provenanceAppliedAt: null,
			publishedVersion: null,
			publishedAt: null,
			assetCount: 0,
			detail: `IDENTITY_CONFLICT: ${rows.length} active invitations found (${matchingIds.join(', ')})`,
		};
	}

	const [invId, invSlug] = rows[0]!.split('|').map((s) => s.trim());

	// Query provenance
	const provRes = runPsql(
		`select definition_slug, package_hash, applied_at::text from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(invId!)}::uuid;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
	);
	const [provSlug, provHash, provApplied] = provRes.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());

	// Query published content
	const pubRes = runPsql(
		`select version::text, published_at::text from public.published_invitation_content where invitation_project_id = ${sqlLiteral(invId!)}::uuid order by version desc limit 1;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
	);
	const [pubVer, pubAt] = pubRes.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());

	// Query draft state for divergence
	const draftRes = runPsql(
		`select status, updated_at::text from public.invitation_content_drafts where invitation_project_id = ${sqlLiteral(invId!)}::uuid and deleted_at is null limit 1;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
	);
	const [draftStatus, draftUpdatedAt] = draftRes.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());

	// Query assets count
	const assetRes = runPsql(
		`select count(*) from public.invitation_assets where invitation_id = ${sqlLiteral(invId!)}::uuid and deleted_at is null;`,
		dbUrl,
		psqlOptions({ tuplesOnly: true, throwOnError: false }),
	);
	const assetCount = Number(assetRes.stdout.trim() || '0');

	const isDiverged = Boolean(
		draftStatus === 'draft' &&
		draftUpdatedAt &&
		pubAt &&
		new Date(draftUpdatedAt).getTime() > new Date(pubAt).getTime(),
	);

	let status: StatusVocabulary = 'UNVERIFIED';
	let detail = `Active invitation resolved (${invId})`;
	if (provHash && canonicalHash) {
		if (provHash !== canonicalHash) {
			status = 'BEHIND_CANONICAL';
		} else if (isDiverged) {
			status = 'DIVERGED';
		} else {
			status = 'MATCH_CANONICAL';
		}
	} else if (provHash && isDiverged) {
		status = 'DIVERGED';
	} else if (!canonicalHash) {
		detail = `Active invitation resolved (${invId}); canonical package hash unavailable — not a proven MATCH`;
	} else if (!provHash) {
		detail = `Active invitation resolved (${invId}); managed provenance package hash missing — not a proven MATCH`;
	}

	return {
		environment: env,
		status,
		activeMatchCount: 1,
		resolvedId: invId!,
		resolvedSlug: invSlug!,
		provenanceDefinitionSlug: provSlug || null,
		provenancePackageHash: provHash || null,
		provenanceAppliedAt: provApplied || null,
		publishedVersion: pubVer ? Number(pubVer) : null,
		publishedAt: pubAt || null,
		assetCount,
		detail,
	};
}

export async function evaluateInvitationStatus(slug: string): Promise<PerInvitationStatusSummary> {
	const definition = getInvitationDefinition(slug);
	const envs: TargetEnv[] = ['local', 'preview', 'production'];

	let canonicalHash: string | null = null;
	try {
		const release = await buildNormalizedInvitationRelease({ slug });
		canonicalHash = serializeInvitationPackage(release).packageHash;
	} catch {
		// Canonical hash calculation unavailable; status falls back to provenance presence check.
	}

	const envResults: Partial<Record<TargetEnv, PerInvitationTargetStatus>> = {};
	for (const env of envs) {
		envResults[env] = evaluateSingleTargetStatus(env, slug, canonicalHash);
	}

	return {
		slug: definition.slug,
		title: definition.title,
		eventType: definition.eventType,
		environments: envResults as Record<TargetEnv, PerInvitationTargetStatus>,
	};
}
