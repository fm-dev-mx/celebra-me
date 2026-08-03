/**
 * cross-db-invitation-reconciliation.ts — Read-only invitation parity across DBs.
 *
 * Compares non-draft / non-in_progress invitations using the stable slug identifier.
 * Repo definitions with lifecycle draft/in_progress are excluded from expected scope.
 */

import { listInvitationDefinitions } from './invitations/registry.ts';
import { resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';
import { classifyDbTarget, redactDbUrl, runPsql } from '../db/db-workflow-lib.ts';

const ENVIRONMENTS: readonly TargetEnv[] = ['local', 'preview', 'production'];
const EXCLUDED_STATUSES = new Set(['draft', 'in_progress']);

export interface CrossDbInvitationRow {
	canonicalKey: string;
	slug: string;
	title: string;
	status: string;
	kind: string;
	eventType: string;
	invitationId: string;
	packageHash: string | null;
	definitionSlug: string | null;
	createdAt: string;
}

export interface EnvironmentSnapshot {
	environment: TargetEnv;
	configured: boolean;
	reachable: boolean;
	dbUrlRedacted: string | null;
	classification: string | null;
	excludedCount: number;
	rows: CrossDbInvitationRow[];
	error?: string;
}

export type DivergenceKind = 'missing' | 'extra' | 'divergent' | 'aligned';

export interface CrossDbInvitationFinding {
	canonicalKey: string;
	kind: DivergenceKind;
	environments: Partial<Record<TargetEnv, CrossDbInvitationRow | null>>;
	details: string[];
}

export interface CrossDbInvitationReconciliationReport {
	generatedAt: string;
	stableIdentifier: 'slug';
	excludedLifecycleStatuses: string[];
	excludedRepoDefinitions: string[];
	environments: Record<TargetEnv, EnvironmentSnapshot>;
	findings: CrossDbInvitationFinding[];
	summary: {
		aligned: number;
		missing: number;
		extra: number;
		divergent: number;
		excludedInProgressRepoCount: number;
	};
}

interface RawDbRow {
	slug: string;
	title: string;
	status: string;
	kind: string;
	eventType: string;
	invitationId: string;
	packageHash: string | null;
	definitionSlug: string | null;
	createdAt: string;
}

function parseJsonArray<T>(raw: string): T[] {
	const text = raw.trim();
	if (!text) return [];
	const parsed: unknown = JSON.parse(text);
	return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function loadEnvironmentRows(dbUrl: string): { rows: CrossDbInvitationRow[]; excludedCount: number } {
	const sql = `
select coalesce((
  select jsonb_agg(jsonb_build_object(
    'slug', i.slug,
    'title', i.title,
    'status', i.status,
    'kind', i.kind,
    'eventType', i.event_type,
    'invitationId', i.id::text,
    'packageHash', p.package_hash,
    'definitionSlug', p.definition_slug,
    'createdAt', i.created_at
  ) order by i.slug)
  from public.invitations i
  left join public.managed_invitation_release_provenance p on p.invitation_id = i.id
  where i.archived_at is null
), '[]'::jsonb);
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || 'psql failed');
	}
	const all = parseJsonArray<RawDbRow>(result.stdout);
	const excludedCount = all.filter((row) => EXCLUDED_STATUSES.has(row.status)).length;
	const rows = all
		.filter((row) => !EXCLUDED_STATUSES.has(row.status))
		.map((row) => ({
			canonicalKey: row.slug,
			slug: row.slug,
			title: row.title,
			status: row.status,
			kind: row.kind,
			eventType: row.eventType,
			invitationId: row.invitationId,
			packageHash: row.packageHash,
			definitionSlug: row.definitionSlug,
			createdAt: row.createdAt,
		}));
	return { rows, excludedCount };
}

function compareRow(
	left: CrossDbInvitationRow,
	right: CrossDbInvitationRow,
): string[] {
	const details: string[] = [];
	if (left.title !== right.title) details.push(`title: ${left.title} vs ${right.title}`);
	if (left.status !== right.status) details.push(`status: ${left.status} vs ${right.status}`);
	if (left.eventType !== right.eventType) {
		details.push(`eventType: ${left.eventType} vs ${right.eventType}`);
	}
	if (left.kind !== right.kind) details.push(`kind: ${left.kind} vs ${right.kind}`);
	const leftHash = left.packageHash;
	const rightHash = right.packageHash;
	if (leftHash && rightHash && leftHash !== rightHash) {
		details.push(`packageHash diverges`);
	}
	return details;
}

function buildFindingForKey(
	key: string,
	snapshots: Record<TargetEnv, EnvironmentSnapshot>,
	publishedRepoSlugs: Set<string>,
): CrossDbInvitationFinding | null {
	const environments: Partial<Record<TargetEnv, CrossDbInvitationRow | null>> = {};
	const present: TargetEnv[] = [];
	const reachableEnvs = ENVIRONMENTS.filter((env) => snapshots[env].reachable);
	for (const env of ENVIRONMENTS) {
		if (!snapshots[env].reachable) {
			environments[env] = null;
			continue;
		}
		const row = snapshots[env].rows.find((candidate) => candidate.canonicalKey === key) ?? null;
		environments[env] = row;
		if (row) present.push(env);
	}

	const details: string[] = [];
	const missingEnvs = reachableEnvs.filter((env) => !environments[env]);
	const presentRows = present
		.map((env) => environments[env])
		.filter((row): row is CrossDbInvitationRow => Boolean(row));
	const inPublishedRepo = publishedRepoSlugs.has(key);

	let kind: DivergenceKind = 'aligned';
	if (presentRows.length === 0 && inPublishedRepo) {
		kind = 'missing';
		details.push(`Published repo slug absent from all reachable environments: ${reachableEnvs.join(', ') || 'none'}`);
	} else if (!inPublishedRepo && present.length > 0) {
		kind = 'extra';
		details.push(`Present in ${present.join(', ')} but not a published repo definition.`);
		if (missingEnvs.length > 0) details.push(`Absent from: ${missingEnvs.join(', ')}`);
	} else if (inPublishedRepo && missingEnvs.length > 0) {
		kind = 'missing';
		details.push(`Missing in: ${missingEnvs.join(', ')}`);
		details.push(`Present in: ${present.join(', ') || 'none'}`);
	}

	if (presentRows.length >= 2) {
		const [baseline, ...rest] = presentRows;
		const propertyDrift: string[] = [];
		for (const row of rest) {
			propertyDrift.push(...compareRow(baseline, row));
		}
		if (propertyDrift.length > 0) {
			if (kind === 'aligned') kind = 'divergent';
			details.push(...propertyDrift);
		}
	}

	if (kind === 'aligned' && presentRows.length === 0) return null;
	return { canonicalKey: key, kind, environments, details };
}

export function buildCrossDbInvitationFindings(
	snapshots: Record<TargetEnv, EnvironmentSnapshot>,
	excludedRepoDefinitions: string[],
): CrossDbInvitationFinding[] {
	const excludedRepo = new Set(excludedRepoDefinitions);
	const publishedRepoSlugs = new Set(
		listInvitationDefinitions()
			.filter((definition) => definition.lifecycle === 'published')
			.map((definition) => definition.slug),
	);
	const keys = new Set<string>();
	for (const slug of publishedRepoSlugs) keys.add(slug);
	for (const env of ENVIRONMENTS) {
		for (const row of snapshots[env].rows) {
			if (!excludedRepo.has(row.canonicalKey)) keys.add(row.canonicalKey);
		}
	}

	const findings: CrossDbInvitationFinding[] = [];
	for (const key of [...keys].sort()) {
		const finding = buildFindingForKey(key, snapshots, publishedRepoSlugs);
		if (finding) findings.push(finding);
	}
	return findings;
}

export function runCrossDbInvitationReconciliation(options?: {
	targets?: TargetEnv[];
}): CrossDbInvitationReconciliationReport {
	const targets = options?.targets ?? [...ENVIRONMENTS];
	const excludedRepoDefinitions = listInvitationDefinitions()
		.filter((definition) => definition.lifecycle === 'in_progress')
		.map((definition) => definition.slug);

	const environments = {} as Record<TargetEnv, EnvironmentSnapshot>;
	for (const environment of ENVIRONMENTS) {
		if (!targets.includes(environment)) {
			environments[environment] = {
				environment,
				configured: false,
				reachable: false,
				dbUrlRedacted: null,
				classification: null,
				excludedCount: 0,
				rows: [],
				error: 'skipped',
			};
			continue;
		}
		const resolved = resolveDbUrlForEnv(environment);
		if (!resolved.dbUrl) {
			environments[environment] = {
				environment,
				configured: false,
				reachable: false,
				dbUrlRedacted: null,
				classification: null,
				excludedCount: 0,
				rows: [],
				error: resolved.error ?? 'CREDENTIALS_REQUIRED',
			};
			continue;
		}
		const classification = classifyDbTarget(resolved.dbUrl);
		try {
			const loaded = loadEnvironmentRows(resolved.dbUrl);
			const filteredRows = loaded.rows.filter(
				(row) => !excludedRepoDefinitions.includes(row.canonicalKey),
			);
			environments[environment] = {
				environment,
				configured: true,
				reachable: true,
				dbUrlRedacted: redactDbUrl(resolved.dbUrl),
				classification: classification.target,
				excludedCount:
					loaded.excludedCount + (loaded.rows.length - filteredRows.length),
				rows: filteredRows,
			};
		} catch (error) {
			environments[environment] = {
				environment,
				configured: true,
				reachable: false,
				dbUrlRedacted: redactDbUrl(resolved.dbUrl),
				classification: classification.target,
				excludedCount: 0,
				rows: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	const findings = buildCrossDbInvitationFindings(environments, excludedRepoDefinitions);
	const summary = {
		aligned: findings.filter((f) => f.kind === 'aligned').length,
		missing: findings.filter((f) => f.kind === 'missing').length,
		extra: findings.filter((f) => f.kind === 'extra').length,
		divergent: findings.filter((f) => f.kind === 'divergent').length,
		excludedInProgressRepoCount: excludedRepoDefinitions.length,
	};

	return {
		generatedAt: new Date().toISOString(),
		stableIdentifier: 'slug',
		excludedLifecycleStatuses: [...EXCLUDED_STATUSES],
		excludedRepoDefinitions,
		environments,
		findings,
		summary,
	};
}
