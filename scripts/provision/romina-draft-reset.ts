/**
 * Full Production managed-draft reset for romina-rios-chaparro.
 * Published content is the sole source of truth; unpublished draft diffs are discarded.
 */
import { createHash } from 'node:crypto';

import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { deriveProductionOperationId } from '../db/db-workflow-lib.ts';
import { canonicalize } from './normalized-invitation-release.ts';
import {
	deriveRominaReceiptOperationId,
	diffContentPaths,
} from './romina-shared-helpers.ts';

export const ROMINA_DRAFT_RESET_SLUG = 'romina-rios-chaparro' as const;
export const ROMINA_DRAFT_RESET_OPERATION_TYPE = 'romina_draft_reset' as const;

type JsonRecord = Record<string, unknown>;

export interface RominaDraftResetInput {
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
}

export interface RominaDraftResetPlan {
	schemaVersion: 'romina-draft-reset-v1';
	target: 'production';
	slug: typeof ROMINA_DRAFT_RESET_SLUG;
	mode: 'dry-run';
	writes: 0;
	operationFingerprint: string;
	operationId: string;
	receiptOperationId: string;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
	acknowledgement: 'DISCARD_UNPUBLISHED_DRAFT_DIFFERENCES';
	changedPaths: string[];
	hashes: {
		published: string;
		draftBefore: string;
		draftAfter: string;
	};
	affectedTables: string[];
	provenanceAndReceipts: {
		approvalConsumption: {
			table: 'production_authorization_receipts';
			action: 'insert before the reset transaction';
		};
		operationReceipt: {
			table: 'invitation_mutation_operation_receipts';
			action: 'insert in the reset transaction';
		};
		managedReleaseProvenance: 'unchanged';
		publishedContent: 'unchanged';
	};
	executionContract: {
		transaction: 'single database transaction';
		validateBeforeWrite: true;
		idempotencyKey: 'slug + after hash + published version';
		writeScope: 'current invitation draft content only';
		forbiddenScope: 'assets, events, guests, rsvps, published content, lifecycle metadata';
	};
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function hash(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function deriveRominaDraftResetFingerprint(input: {
	slug: string;
	afterContent: JsonRecord;
	publishedVersion: number | null;
	publishedHash: string;
}): string {
	return hash({
		schemaVersion: 'romina-draft-reset-v1',
		target: 'production',
		slug: input.slug,
		afterHash: hash(input.afterContent),
		publishedHash: input.publishedHash,
		publishedVersion: input.publishedVersion,
	});
}

export function isRominaDraftResetApplied(input: {
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
}): boolean {
	if (input.slug !== ROMINA_DRAFT_RESET_SLUG) return false;
	if (!eventContentSchema.safeParse(input.draftContent).success) return false;
	if (!eventContentSchema.safeParse(input.publishedContent).success) return false;
	return canonicalize(input.draftContent) === canonicalize(input.publishedContent);
}

export function buildRominaDraftResetPlan(input: RominaDraftResetInput): RominaDraftResetPlan {
	if (input.slug !== ROMINA_DRAFT_RESET_SLUG) {
		throw new Error(`ROMINA_DRAFT_RESET_SCOPE_BLOCKED: expected ${ROMINA_DRAFT_RESET_SLUG}.`);
	}
	const publishedParsed = eventContentSchema.safeParse(input.publishedContent);
	if (!publishedParsed.success) {
		throw new Error(
			`ROMINA_DRAFT_RESET_PUBLISHED_INVALID: ${publishedParsed.error.message}`,
		);
	}

	const before = clone(input.draftContent);
	const after = clone(input.publishedContent);
	const afterParsed = eventContentSchema.safeParse(after);
	if (!afterParsed.success) {
		throw new Error(`ROMINA_DRAFT_RESET_RESULT_INVALID: ${afterParsed.error.message}`);
	}

	const publishedHash = hash(input.publishedContent);
	const draftBeforeHash = hash(before);
	const draftAfterHash = hash(after);
	const changedPaths = diffContentPaths(before, after).sort();
	const operationFingerprint = deriveRominaDraftResetFingerprint({
		slug: ROMINA_DRAFT_RESET_SLUG,
		afterContent: after,
		publishedVersion: input.publishedVersion,
		publishedHash,
	});
	const operationId = deriveProductionOperationId({
		operationType: ROMINA_DRAFT_RESET_OPERATION_TYPE,
		targetEnv: 'production',
		scope: ROMINA_DRAFT_RESET_SLUG,
		manifestFingerprint: operationFingerprint,
	});

	return {
		schemaVersion: 'romina-draft-reset-v1',
		target: 'production',
		slug: ROMINA_DRAFT_RESET_SLUG,
		mode: 'dry-run',
		writes: 0,
		operationFingerprint,
		operationId,
		receiptOperationId: deriveRominaReceiptOperationId(operationId),
		draftStatus: input.draftStatus,
		draftUpdatedAt: input.draftUpdatedAt,
		publishedVersion: input.publishedVersion,
		acknowledgement: 'DISCARD_UNPUBLISHED_DRAFT_DIFFERENCES',
		changedPaths,
		hashes: {
			published: publishedHash,
			draftBefore: draftBeforeHash,
			draftAfter: draftAfterHash,
		},
		affectedTables: [
			'invitation_content_drafts',
			'production_authorization_receipts',
			'invitation_mutation_operation_receipts',
		],
		provenanceAndReceipts: {
			approvalConsumption: {
				table: 'production_authorization_receipts',
				action: 'insert before the reset transaction',
			},
			operationReceipt: {
				table: 'invitation_mutation_operation_receipts',
				action: 'insert in the reset transaction',
			},
			managedReleaseProvenance: 'unchanged',
			publishedContent: 'unchanged',
		},
		executionContract: {
			transaction: 'single database transaction',
			validateBeforeWrite: true,
			idempotencyKey: 'slug + after hash + published version',
			writeScope: 'current invitation draft content only',
			forbiddenScope: 'assets, events, guests, rsvps, published content, lifecycle metadata',
		},
	};
}

export function verifyRominaDraftResetOutcome(
	plan: RominaDraftResetPlan,
	draftContent: JsonRecord,
	publishedContent: JsonRecord,
): void {
	const parsed = eventContentSchema.safeParse(draftContent);
	if (!parsed.success) {
		throw new Error(`ROMINA_DRAFT_RESET_RESULT_INVALID: ${parsed.error.message}`);
	}
	if (hash(draftContent) !== plan.hashes.draftAfter) {
		throw new Error(
			'ROMINA_DRAFT_RESET_RESULT_MISMATCH: resulting draft hash differs from the approved after hash.',
		);
	}
	if (hash(publishedContent) !== plan.hashes.published) {
		throw new Error(
			'ROMINA_DRAFT_RESET_PUBLISHED_CHANGED: published content changed between dry-run and verification.',
		);
	}
	if (canonicalize(draftContent) !== canonicalize(publishedContent)) {
		throw new Error(
			'ROMINA_DRAFT_RESET_SEMANTIC_MISMATCH: draft is not semantically equal to published content.',
		);
	}
}
