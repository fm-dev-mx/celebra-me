import { createHash } from 'node:crypto';

import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { deriveProductionOperationId } from '../db/db-workflow-lib.ts';
import { canonicalize } from './normalized-invitation-release.ts';

export const ROMINA_SCHEMA_REPAIR_SLUG = 'romina-rios-chaparro' as const;
export const ROMINA_SCHEMA_REPAIR_OPERATION_TYPE = 'romina_schema_repair' as const;
const EXPECTED_CHANGED_PATHS = [
	'location.venues[0].venueEvent',
	'location.venues[1].venueEvent',
	'family.godparents',
] as const;

type JsonRecord = Record<string, unknown>;

export interface RominaSchemaRepairInput {
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
}

export interface RominaSchemaRepairPlan {
	schemaVersion: 'romina-schema-repair-v1';
	target: 'production';
	slug: typeof ROMINA_SCHEMA_REPAIR_SLUG;
	mode: 'dry-run';
	writes: 0;
	operationFingerprint: string;
	operationId: string;
	receiptOperationId: string;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	publishedVersion: number | null;
	changedPaths: string[];
	before: {
		venueEvents: [unknown, unknown];
		godparents: unknown;
	};
	after: {
		venueEvents: [unknown, unknown];
		godparents: unknown;
	};
	hashes: {
		before: string;
		after: string;
		unrelatedBefore: string;
		unrelatedAfter: string;
	};
	affectedTables: string[];
	provenanceAndReceipts: {
		approvalConsumption: {
			table: 'production_authorization_receipts';
			action: 'insert before the repair transaction';
		};
		operationReceipt: {
			table: 'invitation_mutation_operation_receipts';
			action: 'insert in the repair transaction';
		};
		managedReleaseProvenance: 'unchanged';
	};
	backup: {
		required: true;
		command: 'pnpm db:prod:backup:critical';
		manifest: 'fresh verified complete Production backup, no older than 24 hours';
		artifacts: ['database', 'auth', 'storage-metadata', 'storage-objects'];
	};
	preservation: {
		unrelatedDocumentFields: 'unchanged';
		assets: 'unchanged';
		events: 'unchanged';
		guests: 'not addressed';
		rsvps: 'not addressed';
		publicationState: 'not addressed';
	};
	executionContract: {
		transaction: 'single database transaction';
		validateBeforeWrite: true;
		idempotencyKey: 'slug + after hash';
		writeScope: 'current invitation draft content only';
		forbiddenScope: 'assets, events, guests, rsvps, published content, lifecycle metadata';
	};
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function record(value: unknown, path: string): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`ROMINA_REPAIR_INVALID_SHAPE: ${path} must be an object.`);
	}
	return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value))
		throw new Error(`ROMINA_REPAIR_INVALID_SHAPE: ${path} must be an array.`);
	return value;
}

function venueAt(content: JsonRecord, index: number): JsonRecord {
	const location = record(content.location, 'location');
	return record(array(location.venues, 'location.venues')[index], `location.venues[${index}]`);
}

function godparentNames(value: unknown): string[] {
	if (typeof value === 'string') {
		return value
			.split(/\r?\n/)
			.map((name) => name.trim())
			.filter(Boolean);
	}
	if (Array.isArray(value)) {
		return value
			.map((entry, index) => record(entry, `family.godparents[${index}]`).name)
			.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
	}
	return [];
}

function hash(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function rominaReceiptOperationId(operationId: string): string {
	if (!/^[a-f0-9]{64}$/i.test(operationId)) {
		throw new Error('ROMINA_REPAIR_OPERATION_ID_INVALID: expected a SHA-256 operation ID.');
	}
	const hex = operationId.slice(0, 32).toLowerCase().split('');
	hex[12] = '8';
	hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16]!, 16) % 4]!;
	return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex
		.slice(12, 16)
		.join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

export function deriveRominaSchemaRepairFingerprint(input: {
	slug: string;
	afterContent: JsonRecord;
	publishedVersion: number | null;
}): string {
	return hash({
		schemaVersion: 'romina-schema-repair-v1',
		target: 'production',
		slug: input.slug,
		afterHash: hash(input.afterContent),
		changedPaths: [...EXPECTED_CHANGED_PATHS].sort(),
		publishedVersion: input.publishedVersion,
	});
}

export interface RominaSchemaRepairReplayIdentity {
	operationFingerprint: string;
	operationId: string;
	receiptOperationId: string;
	afterHash: string;
}

export function isRominaSchemaRepairApplied(input: {
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
}): boolean {
	if (input.slug !== ROMINA_SCHEMA_REPAIR_SLUG) return false;
	if (!eventContentSchema.safeParse(input.draftContent).success) return false;
	if (!eventContentSchema.safeParse(input.publishedContent).success) return false;
	try {
		const publishedVenueEvents: [unknown, unknown] = [
			venueAt(input.publishedContent, 0).venueEvent,
			venueAt(input.publishedContent, 1).venueEvent,
		];
		const draftVenueEvents: [unknown, unknown] = [
			venueAt(input.draftContent, 0).venueEvent,
			venueAt(input.draftContent, 1).venueEvent,
		];
		const publishedGodparents = record(input.publishedContent.family, 'family').godparents;
		const draftGodparents = record(input.draftContent.family, 'family').godparents;
		return (
			canonicalize(draftVenueEvents) === canonicalize(publishedVenueEvents) &&
			canonicalize(draftGodparents) === canonicalize(publishedGodparents)
		);
	} catch {
		return false;
	}
}

export function buildRominaSchemaRepairReplayIdentity(input: {
	slug: string;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
	publishedVersion: number | null;
}): RominaSchemaRepairReplayIdentity {
	if (!isRominaSchemaRepairApplied(input)) {
		throw new Error('ROMINA_REPAIR_REPLAY_NOT_APPLIED: the draft is not already repaired.');
	}
	const operationFingerprint = deriveRominaSchemaRepairFingerprint({
		slug: input.slug,
		afterContent: input.draftContent,
		publishedVersion: input.publishedVersion,
	});
	const operationId = deriveProductionOperationId({
		operationType: ROMINA_SCHEMA_REPAIR_OPERATION_TYPE,
		targetEnv: 'production',
		scope: ROMINA_SCHEMA_REPAIR_SLUG,
		manifestFingerprint: operationFingerprint,
	});
	return {
		operationFingerprint,
		operationId,
		receiptOperationId: rominaReceiptOperationId(operationId),
		afterHash: hash(input.draftContent),
	};
}

function diffPaths(before: unknown, after: unknown, path = ''): string[] {
	if (canonicalize(before) === canonicalize(after)) return [];
	if (Array.isArray(before) && Array.isArray(after)) {
		const paths: string[] = [];
		const length = Math.max(before.length, after.length);
		for (let index = 0; index < length; index++) {
			paths.push(...diffPaths(before[index], after[index], `${path}[${index}]`));
		}
		return paths;
	}
	if (
		before &&
		after &&
		typeof before === 'object' &&
		typeof after === 'object' &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
		const paths: string[] = [];
		for (const key of [...keys].sort()) {
			paths.push(
				...diffPaths(
					(before as JsonRecord)[key],
					(after as JsonRecord)[key],
					path ? `${path}.${key}` : key,
				),
			);
		}
		return paths;
	}
	return [path || '$'];
}

function removeRepairFields(content: JsonRecord): JsonRecord {
	const result = clone(content);
	const location = record(result.location, 'location');
	const venues = array(location.venues, 'location.venues');
	for (const venue of venues) {
		if (venue && typeof venue === 'object' && !Array.isArray(venue)) {
			delete (venue as JsonRecord).venueEvent;
		}
	}
	const family = record(result.family, 'family');
	delete family.godparents;
	return result;
}

export function buildRominaSchemaRepairPlan(
	input: RominaSchemaRepairInput,
): RominaSchemaRepairPlan {
	if (input.slug !== ROMINA_SCHEMA_REPAIR_SLUG) {
		throw new Error(`ROMINA_REPAIR_SCOPE_BLOCKED: expected ${ROMINA_SCHEMA_REPAIR_SLUG}.`);
	}
	if (!eventContentSchema.safeParse(input.publishedContent).success) {
		throw new Error(
			'ROMINA_REPAIR_PUBLISHED_INVALID: the canonical Production publication is invalid.',
		);
	}

	const before = clone(input.draftContent);
	const after = clone(input.draftContent);
	const publishedVenueEvents = [
		venueAt(input.publishedContent, 0).venueEvent,
		venueAt(input.publishedContent, 1).venueEvent,
	];
	if (
		!publishedVenueEvents.every(
			(value): value is string => typeof value === 'string' && value.trim().length > 0,
		)
	) {
		throw new Error(
			'ROMINA_REPAIR_CANONICAL_VALUES_MISSING: Production venueEvent values are incomplete.',
		);
	}
	const publishedGodparents = clone(record(input.publishedContent.family, 'family').godparents);
	if (!Array.isArray(publishedGodparents) || publishedGodparents.length === 0) {
		throw new Error(
			'ROMINA_REPAIR_CANONICAL_VALUES_MISSING: Production godparents are not an array.',
		);
	}
	const draftNames = godparentNames(record(before.family, 'family').godparents);
	const publishedNames = godparentNames(publishedGodparents);
	if (canonicalize(draftNames) !== canonicalize(publishedNames)) {
		throw new Error(
			'ROMINA_REPAIR_SEMANTIC_MISMATCH: draft godparent names do not match Production.',
		);
	}

	venueAt(after, 0).venueEvent = publishedVenueEvents[0];
	venueAt(after, 1).venueEvent = publishedVenueEvents[1];
	record(after.family, 'family').godparents = publishedGodparents;

	const parsedAfter = eventContentSchema.safeParse(after);
	if (!parsedAfter.success) {
		throw new Error(`ROMINA_REPAIR_RESULT_INVALID: ${parsedAfter.error.message}`);
	}
	const changedPaths = diffPaths(before, after).sort();
	if (canonicalize(changedPaths) !== canonicalize([...EXPECTED_CHANGED_PATHS].sort())) {
		throw new Error(`ROMINA_REPAIR_SCOPE_CHANGED: ${changedPaths.join(', ')}`);
	}

	const beforeHash = hash(before);
	const afterHash = hash(after);
	const operationFingerprint = deriveRominaSchemaRepairFingerprint({
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		afterContent: after,
		publishedVersion: input.publishedVersion,
	});
	const operationId = deriveProductionOperationId({
		operationType: ROMINA_SCHEMA_REPAIR_OPERATION_TYPE,
		targetEnv: 'production',
		scope: ROMINA_SCHEMA_REPAIR_SLUG,
		manifestFingerprint: operationFingerprint,
	});

	return {
		schemaVersion: 'romina-schema-repair-v1',
		target: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		mode: 'dry-run',
		writes: 0,
		operationFingerprint,
		operationId,
		receiptOperationId: rominaReceiptOperationId(operationId),
		draftStatus: input.draftStatus,
		draftUpdatedAt: input.draftUpdatedAt,
		publishedVersion: input.publishedVersion,
		changedPaths,
		before: {
			venueEvents: [venueAt(before, 0).venueEvent, venueAt(before, 1).venueEvent],
			godparents: clone(record(before.family, 'family').godparents),
		},
		after: {
			venueEvents: [publishedVenueEvents[0], publishedVenueEvents[1]],
			godparents: publishedGodparents,
		},
		hashes: {
			before: beforeHash,
			after: afterHash,
			unrelatedBefore: hash(removeRepairFields(before)),
			unrelatedAfter: hash(removeRepairFields(after)),
		},
		affectedTables: [
			'invitation_content_drafts',
			'production_authorization_receipts',
			'invitation_mutation_operation_receipts',
		],
		provenanceAndReceipts: {
			approvalConsumption: {
				table: 'production_authorization_receipts',
				action: 'insert before the repair transaction',
			},
			operationReceipt: {
				table: 'invitation_mutation_operation_receipts',
				action: 'insert in the repair transaction',
			},
			managedReleaseProvenance: 'unchanged',
		},
		backup: {
			required: true,
			command: 'pnpm db:prod:backup:critical',
			manifest: 'fresh verified complete Production backup, no older than 24 hours',
			artifacts: ['database', 'auth', 'storage-metadata', 'storage-objects'],
		},
		preservation: {
			unrelatedDocumentFields: 'unchanged',
			assets: 'unchanged',
			events: 'unchanged',
			guests: 'not addressed',
			rsvps: 'not addressed',
			publicationState: 'not addressed',
		},
		executionContract: {
			transaction: 'single database transaction',
			validateBeforeWrite: true,
			idempotencyKey: 'slug + after hash',
			writeScope: 'current invitation draft content only',
			forbiddenScope: 'assets, events, guests, rsvps, published content, lifecycle metadata',
		},
	};
}

export function verifyRominaSchemaRepairOutcome(
	plan: RominaSchemaRepairPlan,
	draftContent: JsonRecord,
): void {
	const parsed = eventContentSchema.safeParse(draftContent);
	if (!parsed.success) {
		throw new Error(`ROMINA_REPAIR_RESULT_INVALID: ${parsed.error.message}`);
	}
	if (hash(draftContent) !== plan.hashes.after) {
		throw new Error(
			'ROMINA_REPAIR_RESULT_MISMATCH: resulting Production draft hash differs from the approved after hash.',
		);
	}
	if (hash(removeRepairFields(draftContent)) !== plan.hashes.unrelatedAfter) {
		throw new Error(
			'ROMINA_REPAIR_UNRELATED_CONTENT_CHANGED: unrelated document content changed.',
		);
	}
	const venueEvents: [unknown, unknown] = [
		venueAt(draftContent, 0).venueEvent,
		venueAt(draftContent, 1).venueEvent,
	];
	const godparents = clone(record(draftContent.family, 'family').godparents);
	if (
		canonicalize(venueEvents) !== canonicalize(plan.after.venueEvents) ||
		canonicalize(godparents) !== canonicalize(plan.after.godparents)
	) {
		throw new Error(
			'ROMINA_REPAIR_RESULT_MISMATCH: repaired fields differ from the approved canonical values.',
		);
	}
}
