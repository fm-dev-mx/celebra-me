/**
 * Environment policy contract for schema migration.
 * Policies own auth, backup, identity, and verification — not invitation/content paths.
 */

import type { MigrationPlan, MigrateTarget } from './migration-plan.ts';

/** Per-orchestration memo for expensive read-only steps that must run once. */
export interface MigratePolicySession {
	/** Production object audit already completed for this apply/preflight orchestration. */
	productionAuditCompleted?: boolean;
}

export interface MigratePolicyContext {
	/** Resolved database URL — never logged in full by policies. */
	dbUrl: string;
	/** Optional expected pin from shared parser. */
	expectedPin: readonly string[] | null;
	env: NodeJS.ProcessEnv;
	/** Mutable session bag shared across rebuilds within one orchestration. */
	session?: MigratePolicySession;
	/** Test seams */
	readConfirmationLine?: () => string | Promise<string>;
	isInteractive?: boolean;
}

export interface MigrateEnvironmentPolicy {
	readonly target: MigrateTarget;

	/** Resolve credentials and prove target identity. */
	resolveContext(input: {
		expectedPin: readonly string[] | null;
		env?: NodeJS.ProcessEnv;
	}): MigratePolicyContext;

	/** Build an immutable plan from live evidence (read-only). */
	buildPlan(ctx: MigratePolicyContext, mode: 'preflight' | 'apply'): MigrationPlan;

	/**
	 * Authorization immediately before the first write.
	 * Production: owner TTY. Preview: scope/YES. Local/disposable: none.
	 */
	authorize(plan: MigrationPlan, ctx: MigratePolicyContext): void | Promise<void>;

	/** Verified pre-write hooks (e.g. Production critical backup). */
	beforeWrite(plan: MigrationPlan, ctx: MigratePolicyContext): void;

	/** Execute schema mutation for this target. */
	execute(plan: MigrationPlan, ctx: MigratePolicyContext): void;

	/** Post-apply verification + evidence (history, contract, post-backup). */
	afterWrite(plan: MigrationPlan, ctx: MigratePolicyContext): void;
}

/** Accepted residual risk: single-operator cross-machine coordination (no distributed lock). */
export const MIGRATE_CONCURRENCY_RESIDUAL_RISK =
	'Schema migrate assumes a single authorized operator per target. ' +
	'No distributed lock is provided; concurrent applies across machines are an accepted residual risk. ' +
	'After any failed apply, re-run preflight and obtain a newly validated plan before retrying.';
