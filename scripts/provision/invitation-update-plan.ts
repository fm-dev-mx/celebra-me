/**
 * invitation-update-plan.ts — Deterministic Semantic Plan Engine for Managed Invitations
 */

import { createHash } from 'node:crypto';

export type FunctionalOperation =
	| 'insert'
	| 'update'
	| 'delete'
	| 'move'
	| 'upload'
	| 'overwrite'
	| 'reuse'
	| 'skip';

export interface FunctionalChange {
	section: string;
	entity: string;
	label: string;
	operation: FunctionalOperation;
	field?: string;
	previousValue?: unknown;
	newValue?: unknown;
	scope: 'database' | 'storage';
	technicalWriteCount: number;
}

export interface DatabaseOpsSummary {
	inserts: number;
	updates: number;
	deletes: number;
}

export interface StorageOpsSummary {
	uploads: number;
	overwrites: number;
	moves: number;
	deletes: number;
}

export interface TargetPreconditions {
	targetInvitationId?: string;
	existingDraftUpdatedAt?: string;
	existingPublishedVersion?: number;
}

export type PlanExecutionStatus =
	| 'PLANNED'
	| 'EXECUTED'
	| 'IN_SYNC'
	| 'REVERTED'
	| 'FAILED_NEEDS_REVIEW'
	| 'STALE';

export interface ExecutionReceipt {
	executedAt: string;
	status: PlanExecutionStatus;
	completedOperations: number;
	databaseWrites: DatabaseOpsSummary;
	storageMutations: StorageOpsSummary;
	publishedVersion?: number;
	recoveryNote?: string;
}

export interface OperationalPlan {
	planId: string;
	invitationSlug: string;
	invitationTitle: string;
	sourceHash: string;
	packageHash: string;
	targetEnvironment: 'local' | 'preview' | 'production';
	verifiedProjectRef: string;
	functionalChanges: FunctionalChange[];
	physicalDatabaseOps: DatabaseOpsSummary;
	storageOps: StorageOpsSummary;
	targetPreconditions: TargetPreconditions;
	sensitivityClassification: 'public' | 'internal' | 'sensitive';
	executionStatus: PlanExecutionStatus;
	receipt?: ExecutionReceipt;
}

export function computePlanId(params: {
	slug: string;
	sourceHash: string;
	targetEnvironment: string;
	projectRef: string;
	changes: FunctionalChange[];
	preconditions: TargetPreconditions;
}): string {
	const raw = JSON.stringify({
		slug: params.slug,
		sourceHash: params.sourceHash,
		targetEnv: params.targetEnvironment,
		projectRef: params.projectRef,
		changes: params.changes.map((c) => ({
			s: c.section,
			e: c.entity,
			op: c.operation,
			f: c.field,
		})),
		preconditions: params.preconditions,
	});
	return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function verifyPlanPreconditions(
	plan: OperationalPlan,
	currentState: {
		existingDraftUpdatedAt?: string;
		existingPublishedVersion?: number;
		targetInvitationId?: string;
	},
): { ok: boolean; reason?: string } {
	const { targetPreconditions } = plan;

	if (
		targetPreconditions.targetInvitationId &&
		currentState.targetInvitationId &&
		targetPreconditions.targetInvitationId !== currentState.targetInvitationId
	) {
		return {
			ok: false,
			reason: `Precondition failed: target invitation ID changed (expected ${targetPreconditions.targetInvitationId}, got ${currentState.targetInvitationId}).`,
		};
	}

	if (
		targetPreconditions.existingDraftUpdatedAt &&
		currentState.existingDraftUpdatedAt &&
		targetPreconditions.existingDraftUpdatedAt !== currentState.existingDraftUpdatedAt
	) {
		return {
			ok: false,
			reason: `Precondition failed: target draft updated timestamp changed after planning (expected ${targetPreconditions.existingDraftUpdatedAt}, got ${currentState.existingDraftUpdatedAt}).`,
		};
	}

	if (
		targetPreconditions.existingPublishedVersion !== undefined &&
		currentState.existingPublishedVersion !== undefined &&
		targetPreconditions.existingPublishedVersion !== currentState.existingPublishedVersion
	) {
		return {
			ok: false,
			reason: `Precondition failed: target published version changed after planning (expected ${targetPreconditions.existingPublishedVersion}, got ${currentState.existingPublishedVersion}).`,
		};
	}

	return { ok: true };
}
