/**
 * migration-deployment-compatibility.ts
 *
 * Migration / Deployment Compatibility Contract for hosted Preview/Production.
 * Extends (does not replace) allowlist, dry-run, backup, and contract gates.
 *
 * SSOT registry: supabase/migration-rollout-registry.json
 * Operational docs: docs/database-workflow.md
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type DbMigrateTarget = 'local' | 'preview' | 'production' | 'disposable-test';
export type RolloutPhase = 'expand' | 'neutral' | 'contract';
export type CompatibilityStatus = 'allow' | 'block' | 'environment_not_ready';

export interface MigrationRolloutEntry {
	phase: RolloutPhase;
	provides?: string[];
	requiresDbCapabilities?: string[];
	requiresDeployedAppCapabilities?: string[];
	revokes?: string[];
	notes?: string;
}

export interface AppCapabilityRequirement {
	requiresDbCapabilities?: string[];
}

export interface MigrationRolloutRegistry {
	migrations: Record<string, MigrationRolloutEntry>;
	appCapabilities?: Record<string, AppCapabilityRequirement>;
}

export interface CompatibilityEvaluationInput {
	target: DbMigrateTarget;
	/** Authorized target release Git SHA (required for hosted targets). */
	targetReleaseSha: string | null;
	/** Currently deployed application Git SHA / identity (required when any candidate is contract). */
	deployedAppSha: string | null;
	/** Capabilities of the currently deployed application. */
	deployedAppCapabilities: readonly string[];
	/** Migration versions already applied on the target DB. */
	dbAppliedVersions: readonly string[];
	/** Candidate migration versions pending application. */
	candidateVersions: readonly string[];
	/** Migration versions present in the authorized target release tree. */
	targetReleaseMigrationVersions: readonly string[];
	/** Optional registry override (tests). */
	registry?: MigrationRolloutRegistry;
}

export interface CompatibilityEvaluationResult {
	status: CompatibilityStatus;
	reasons: string[];
	phaseByVersion: Record<string, RolloutPhase | 'unspecified'>;
}

const REGISTRY_PATH = resolve(process.cwd(), 'supabase/migration-rollout-registry.json');

export function isHostedMigrateTarget(target: DbMigrateTarget): boolean {
	return target === 'preview' || target === 'production';
}

export function loadMigrationRolloutRegistry(
	path: string = REGISTRY_PATH,
): MigrationRolloutRegistry {
	if (!existsSync(path)) {
		throw new Error(`Migration rollout registry missing at ${path}.`);
	}
	const parsed = JSON.parse(readFileSync(path, 'utf8')) as MigrationRolloutRegistry;
	if (!parsed?.migrations || typeof parsed.migrations !== 'object') {
		throw new Error('Migration rollout registry must define a migrations object.');
	}
	return parsed;
}

/** List migration version timestamps present in supabase/migrations at a Git SHA. */
export function listMigrationVersionsAtGitSha(sha: string): string[] {
	if (!/^[0-9a-f]{7,40}$/i.test(sha.trim())) {
		throw new Error(`Invalid target release SHA: ${sha}`);
	}
	const output = execFileSync(
		'git',
		['ls-tree', '-r', '--name-only', sha.trim(), 'supabase/migrations'],
		{ encoding: 'utf8' },
	);
	const versions = new Set<string>();
	for (const line of output.split(/\r?\n/)) {
		const match = line.trim().match(/\/(\d{14})_/);
		if (match?.[1]) versions.add(match[1]);
	}
	return [...versions].sort();
}

export function deriveDbCapabilities(
	appliedVersions: readonly string[],
	registry: MigrationRolloutRegistry,
): string[] {
	const caps = new Set<string>();
	for (const version of appliedVersions) {
		const entry = registry.migrations[version];
		for (const capability of entry?.provides ?? []) caps.add(capability);
	}
	return [...caps].sort();
}

function defaultPhase(
	version: string,
	registry: MigrationRolloutRegistry,
): RolloutPhase | 'unspecified' {
	return registry.migrations[version]?.phase ?? 'unspecified';
}

function collectContractReasons(options: {
	version: string;
	hosted: boolean;
	deployedAppSha: string | null;
	deployedCaps: Set<string>;
	entry: MigrationRolloutEntry | undefined;
}): string[] {
	const reasons: string[] = [];
	if (options.hosted && (!options.deployedAppSha || !options.deployedAppSha.trim())) {
		reasons.push(
			`Contract migration ${options.version} requires CELEBRA_DEPLOYED_APP_SHA proving the replacement application is deployed.`,
		);
	}
	for (const required of options.entry?.requiresDeployedAppCapabilities ?? []) {
		if (!options.deployedCaps.has(required)) {
			reasons.push(
				`Contract migration ${options.version} is blocked until deployed application provides capability "${required}" (historical revoke-before-replacement class).`,
			);
		}
	}
	return reasons;
}

function evaluateCandidateVersion(options: {
	version: string;
	hosted: boolean;
	targetReleaseSha: string | null;
	deployedAppSha: string | null;
	releaseSet: Set<string>;
	dbCaps: Set<string>;
	deployedCaps: Set<string>;
	registry: MigrationRolloutRegistry;
}): { phase: RolloutPhase | 'unspecified'; reasons: string[] } {
	const { version, hosted, registry } = options;
	const phase = defaultPhase(version, registry);
	const entry = registry.migrations[version];
	const reasons: string[] = [];

	if (hosted && !options.releaseSet.has(version)) {
		reasons.push(
			`Migration ${version} is not present in authorized target release tree ${options.targetReleaseSha}.`,
		);
		return { phase, reasons };
	}

	if (hosted && phase === 'unspecified') {
		reasons.push(
			`Migration ${version} lacks an explicit rollout phase in supabase/migration-rollout-registry.json. ` +
				`Hosted candidates must be classified as expand, neutral, or contract before apply. ` +
				`DROP/REVOKE/TRUNCATE-class changes must never become safe through registry omission.`,
		);
		return { phase, reasons };
	}

	for (const required of entry?.requiresDbCapabilities ?? []) {
		if (!options.dbCaps.has(required)) {
			reasons.push(
				`Migration ${version} requires DB capability "${required}" which is not present on the target database.`,
			);
		}
	}

	if (phase === 'contract') {
		reasons.push(
			...collectContractReasons({
				version,
				hosted,
				deployedAppSha: options.deployedAppSha,
				deployedCaps: options.deployedCaps,
				entry,
			}),
		);
	} else {
		for (const provided of entry?.provides ?? []) options.dbCaps.add(provided);
	}

	return { phase, reasons };
}

/**
 * Evaluate whether candidate migrations may proceed against the target environment.
 * Local / disposable-test do not require hosted deployment identity.
 */
export function evaluateMigrationDeploymentCompatibility(
	input: CompatibilityEvaluationInput,
): CompatibilityEvaluationResult {
	const registry = input.registry ?? loadMigrationRolloutRegistry();
	const reasons: string[] = [];
	const phaseByVersion: Record<string, RolloutPhase | 'unspecified'> = {};
	const candidates = [...new Set(input.candidateVersions.map((v) => v.trim()).filter(Boolean))];
	const releaseSet = new Set(input.targetReleaseMigrationVersions);
	const dbCaps = new Set(deriveDbCapabilities(input.dbAppliedVersions, registry));
	const deployedCaps = new Set(input.deployedAppCapabilities);
	const hosted = isHostedMigrateTarget(input.target);

	if (hosted && (!input.targetReleaseSha || !input.targetReleaseSha.trim())) {
		return {
			status: 'block',
			reasons: [
				'Hosted migration requires CELEBRA_TARGET_RELEASE_SHA (authorized target release Git identity). Branch/worktree/credentials alone cannot authorize hosted mutation.',
			],
			phaseByVersion,
		};
	}

	for (const version of candidates) {
		const evaluated = evaluateCandidateVersion({
			version,
			hosted,
			targetReleaseSha: input.targetReleaseSha,
			deployedAppSha: input.deployedAppSha,
			releaseSet,
			dbCaps,
			deployedCaps,
			registry,
		});
		phaseByVersion[version] = evaluated.phase;
		reasons.push(...evaluated.reasons);
	}

	if (reasons.length > 0) {
		return { status: 'block', reasons, phaseByVersion };
	}

	return {
		status: 'allow',
		reasons: [
			hosted
				? `Compatibility allow: ${candidates.length} candidate(s) belong to target release and satisfy rollout phases.`
				: `Compatibility allow: local/disposable target is not gated by hosted deployment identity.`,
		],
		phaseByVersion,
	};
}

/**
 * Detect when the deployed application is ahead of the database
 * (required DB capabilities missing from applied migrations).
 * Does not mutate; reports ENVIRONMENT NOT READY for deployment/migration gates.
 */
export function evaluateAppDatabaseReadiness(input: {
	deployedAppCapabilities: readonly string[];
	dbAppliedVersions: readonly string[];
	/** Optional pending candidates that would be applied in the same operation. */
	candidateVersions?: readonly string[];
	registry?: MigrationRolloutRegistry;
}): CompatibilityEvaluationResult {
	const registry = input.registry ?? loadMigrationRolloutRegistry();
	const appliedCaps = new Set(deriveDbCapabilities(input.dbAppliedVersions, registry));
	const projectedCaps = new Set(appliedCaps);
	for (const version of input.candidateVersions ?? []) {
		for (const provided of registry.migrations[version]?.provides ?? []) {
			projectedCaps.add(provided);
		}
	}

	const reasons: string[] = [];
	for (const appCap of input.deployedAppCapabilities) {
		const requirement = registry.appCapabilities?.[appCap];
		for (const required of requirement?.requiresDbCapabilities ?? []) {
			if (!projectedCaps.has(required)) {
				reasons.push(
					`Deployed application capability "${appCap}" requires DB capability "${required}", but the target database does not provide it.`,
				);
			}
		}
	}

	if (reasons.length > 0) {
		return {
			status: 'environment_not_ready',
			reasons: reasons.map((r) => `ENVIRONMENT NOT READY: ${r}`),
			phaseByVersion: {},
		};
	}

	return {
		status: 'allow',
		reasons: ['Application and database capability requirements are aligned.'],
		phaseByVersion: {},
	};
}

/** Resolve hosted deployment/release identity from env; fail closed for hosted targets. */
export function resolveHostedMigrationIdentity(env: NodeJS.ProcessEnv = process.env): {
	targetReleaseSha: string | null;
	deployedAppSha: string | null;
	deployedAppCapabilities: string[];
} {
	const targetReleaseSha = env.CELEBRA_TARGET_RELEASE_SHA?.trim() || null;
	const deployedAppSha = env.CELEBRA_DEPLOYED_APP_SHA?.trim() || null;
	const rawCaps = env.CELEBRA_DEPLOYED_APP_CAPABILITIES?.trim() || '';
	const deployedAppCapabilities = rawCaps
		? rawCaps
				.split(/[,\s]+/)
				.map((c) => c.trim())
				.filter(Boolean)
		: [];
	return { targetReleaseSha, deployedAppSha, deployedAppCapabilities };
}

export function assertCompatibilityOrFail(
	result: CompatibilityEvaluationResult,
	failFn: (message: string) => never,
): void {
	if (result.status === 'allow') return;
	const header =
		result.status === 'environment_not_ready'
			? 'ENVIRONMENT NOT READY'
			: 'Migration / deployment compatibility blocked';
	failFn(`${header}:\n- ${result.reasons.join('\n- ')}`);
}
