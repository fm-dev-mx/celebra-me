/**
 * db-sync-plan.ts — Immutable plan identity for db:sync facade.
 * Reuses allowlists and hashes; does not implement mirror/update engines.
 */

import { createHash } from 'node:crypto';
import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES } from './db-target-config.ts';
import {
	DB_SYNC_DELEGATED_ENGINES,
	DB_SYNC_DIRECTION_LABELS,
	DB_SYNC_SCHEMA_VERSION,
	PLAN_TTL_MS,
	type DbSyncDirection,
	type DbSyncPlan,
	type DbSyncPlanGates,
} from './db-sync-types.ts';

export function gatesForDirection(direction: DbSyncDirection): DbSyncPlanGates {
	return {
		previewApprovalRequired: direction === 'package-to-production',
		releaseCheckRequired: direction === 'package-to-production',
		criticalBackupRequired: direction === 'package-to-production',
		previewWriteAuthRequired:
			direction === 'definition-to-preview' || direction === 'production-to-preview-mirror',
		ownerProductionApplyRequired: direction === 'package-to-production',
		rsvpResetDisclosureRequired: direction === 'production-to-preview-mirror',
		schemaCurrentRequired:
			direction === 'definition-to-local' ||
			direction === 'definition-to-preview' ||
			direction === 'production-to-preview-mirror' ||
			direction === 'package-to-production',
	};
}

function expectedPostStateForDirection(direction: DbSyncDirection): string {
	switch (direction) {
		case 'definition-to-local':
			return 'Local invitation matches package semantic state; RSVP remains environment-local';
		case 'definition-to-preview':
			return 'Preview invitation matches package; pending approval artifact may be created';
		case 'package-to-production':
			return 'Production invitation matches approved package; post-verify zero-drift';
		case 'production-to-preview-mirror':
			return 'Preview content tables/assets mirror Production allowlist; Preview RSVP children reset';
	}
}

export function computeMirrorDataFingerprint(input: {
	sourceProjectRef: string;
	targetProjectRef: string;
	semanticDigest?: string | null;
}): string {
	const raw = JSON.stringify({
		v: 1,
		tables: [...CONTENT_MIRROR_TABLES],
		excluded: [...EXCLUDED_TABLES],
		source: input.sourceProjectRef,
		target: input.targetProjectRef,
		semantic: input.semanticDigest ?? null,
	});
	return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
}

function computeDbSyncPlanId(input: {
	direction: DbSyncDirection;
	slug: string | null;
	packageHash: string | null;
	sourceHash: string | null;
	redactedSourceIdentity: string;
	redactedTargetIdentity: string;
	dataFingerprint: string;
	assetFingerprint: string;
	schemaEvidence: string;
	enginePlanId?: string | null;
}): string {
	const raw = JSON.stringify({
		v: 1,
		direction: input.direction,
		slug: input.slug,
		packageHash: input.packageHash,
		sourceHash: input.sourceHash,
		source: input.redactedSourceIdentity,
		target: input.redactedTargetIdentity,
		data: input.dataFingerprint,
		assets: input.assetFingerprint,
		schema: input.schemaEvidence,
		enginePlanId: input.enginePlanId ?? null,
		gates: gatesForDirection(input.direction),
		engine: DB_SYNC_DELEGATED_ENGINES[input.direction],
	});
	return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function buildDbSyncPlan(input: {
	direction: DbSyncDirection;
	slug: string | null;
	packageHash?: string | null;
	sourceHash?: string | null;
	redactedSourceIdentity: string;
	redactedTargetIdentity: string;
	dataFingerprint: string;
	assetFingerprint?: string;
	schemaEvidence: string;
	enginePlanId?: string | null;
	now?: Date;
}): DbSyncPlan {
	const now = input.now ?? new Date();
	const createdAt = now.toISOString();
	const expiresAt = new Date(now.getTime() + PLAN_TTL_MS).toISOString();
	const packageHash = input.packageHash ?? null;
	const sourceHash = input.sourceHash ?? null;
	const assetFingerprint = input.assetFingerprint ?? 'none';
	const enginePlanId = input.enginePlanId ?? undefined;
	const planId = computeDbSyncPlanId({
		direction: input.direction,
		slug: input.slug,
		packageHash,
		sourceHash,
		redactedSourceIdentity: input.redactedSourceIdentity,
		redactedTargetIdentity: input.redactedTargetIdentity,
		dataFingerprint: input.dataFingerprint,
		assetFingerprint,
		schemaEvidence: input.schemaEvidence,
		enginePlanId,
	});

	return {
		schemaVersion: DB_SYNC_SCHEMA_VERSION,
		planId,
		mode: 'plan',
		direction: input.direction,
		slug: input.slug,
		packageHash,
		sourceHash,
		redactedSourceIdentity: input.redactedSourceIdentity,
		redactedTargetIdentity: input.redactedTargetIdentity,
		dataFingerprint: input.dataFingerprint,
		assetFingerprint,
		schemaEvidence: input.schemaEvidence,
		gates: gatesForDirection(input.direction),
		delegatedEngine: DB_SYNC_DELEGATED_ENGINES[input.direction],
		delegatedOperation: DB_SYNC_DIRECTION_LABELS[input.direction],
		expectedPostState: expectedPostStateForDirection(input.direction),
		createdAt,
		expiresAt,
		enginePlanId,
	};
}

export function assertPlanFresh(plan: DbSyncPlan, now: Date = new Date()): void {
	if (Date.parse(plan.expiresAt) < now.getTime()) {
		throw new Error(`PLAN_EXPIRED: plan ${plan.planId} expired at ${plan.expiresAt}`);
	}
}

export function assertExactPlan(plan: DbSyncPlan, expectedPlanId: string | null | undefined): void {
	if (!expectedPlanId) {
		throw new Error('EXPECTED_PLAN_REQUIRED: apply requires --expected-plan <planId>');
	}
	if (plan.planId !== expectedPlanId) {
		throw new Error(
			`PLAN_DRIFT: reviewed planId ${expectedPlanId} does not match rebuilt plan ${plan.planId}`,
		);
	}
}
