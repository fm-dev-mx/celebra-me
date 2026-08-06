/**
 * Shared Local/Preview managed-invitation content apply sequence.
 *
 * Consumed by invitation:update and db:sync. Never runs schema migrations —
 * callers must gate on schema CURRENT separately via assertContentSchemaCurrent.
 */

import type { InvitationPackageData } from './invitation-package.ts';
import { applyLocalInvitation, type LocalApplyResult } from './apply-local-invitation.ts';
import { runImportEngine, type ImportEngineResult } from './invitation-import-engine.ts';
import { runPreviewApply } from './preview-apply.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import { fetchRemoteMigrationVersions } from '../status-core/migration-history-reader.ts';
import { getValidatedMigrationFiles } from '../db/apply-migrations.ts';

export type ContentApplyTarget = 'local' | 'preview';

export function contentMigrateCommandForTarget(target: ContentApplyTarget): string {
	return target === 'local' ? 'pnpm db:local:migrate' : 'pnpm db:preview:migrate';
}

export function readContentTargetSchemaLifecycle(dbUrl: string): SchemaLifecycleState {
	try {
		const remote = fetchRemoteMigrationVersions(dbUrl);
		const expected = getValidatedMigrationFiles().map((file) => file.version);
		if (remote.isUninitialized && expected.length > 0) {
			return classifySchemaLifecycle({
				pendingMigrations: expected,
				verified: true,
			});
		}
		const remoteSet = new Set(remote.remoteVersions);
		const expectedSet = new Set(expected);
		const pendingMigrations = expected.filter((version) => !remoteSet.has(version));
		const extraMigrations = remote.remoteVersions.filter(
			(version) => !expectedSet.has(version),
		);
		return classifySchemaLifecycle({
			pendingMigrations,
			extraMigrations,
			verified: true,
		});
	} catch {
		return 'UNVERIFIED';
	}
}

/**
 * Block content apply when target schema is not CURRENT.
 * Invitation workflows never auto-migrate; they only point at the migrate alias.
 */
export function assertContentSchemaCurrent(input: {
	target: ContentApplyTarget;
	schemaLifecycle?: SchemaLifecycleState | string | null;
	dbUrl?: string;
}): void {
	const state =
		input.schemaLifecycle ??
		(input.dbUrl ? readContentTargetSchemaLifecycle(input.dbUrl) : 'UNVERIFIED');
	if (state === 'CURRENT') return;
	const migrateCmd = contentMigrateCommandForTarget(input.target);
	throw new Error(
		`SCHEMA_INCOMPATIBLE: target ${input.target} schema lifecycle is ${state}. ` +
			`Content apply never runs migrations. Owner must execute ${migrateCmd} ` +
			`(or remediate SCHEMA_DRIFT), then rerun the content workflow.`,
	);
}

export type ContentApplyOptions = {
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	rekeyFrom?: string;
	ownerUserId?: string;
	sourceDir?: string;
};

export async function planAndApplyLocalContent(
	input: {
		slug: string;
		apply: boolean;
		plan?: OperationalPlan;
	} & ContentApplyOptions,
): Promise<LocalApplyResult> {
	const shared = {
		slug: input.slug,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		rekeyFrom: input.rekeyFrom,
		ownerUserId: input.ownerUserId,
		sourceDir: input.sourceDir,
	};
	if (input.apply && input.plan) {
		return applyLocalInvitation({ ...shared, apply: true, plan: input.plan });
	}
	const dry = await applyLocalInvitation({ ...shared, apply: false });
	if (!input.apply) return dry;
	return applyLocalInvitation({ ...shared, apply: true, plan: dry.plan });
}

export async function planAndApplyPreviewContent(
	input: {
		packageData: InvitationPackageData;
		targetDbUrl: string;
		apply: boolean;
		plan?: OperationalPlan;
	} & ContentApplyOptions,
): Promise<ImportEngineResult & { plan?: OperationalPlan }> {
	if (input.apply && input.plan) {
		return runPreviewApply({
			packageData: input.packageData,
			targetDbUrl: input.targetDbUrl,
			plan: input.plan,
			assetPolicy: input.assetPolicy,
			pruneAssets: input.pruneAssets,
			updateScope: input.updateScope,
			conflictResolutions: input.conflictResolutions,
			rekeyFrom: input.rekeyFrom,
		});
	}
	const dry = await runImportEngine({
		packageData: input.packageData,
		target: 'preview',
		targetDbUrl: input.targetDbUrl,
		dryRun: true,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		rekeyFrom: input.rekeyFrom,
	});
	if (!input.apply) return dry;
	if (!dry.plan) throw new Error('PREVIEW_PLAN_MISSING');
	return runPreviewApply({
		packageData: input.packageData,
		targetDbUrl: input.targetDbUrl,
		plan: dry.plan,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		rekeyFrom: input.rekeyFrom,
	});
}
