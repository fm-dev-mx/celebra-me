import { createHash } from 'node:crypto';

import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { canonicalize } from './normalized-invitation-release.ts';

export const ROMINA_SCHEMA_REPAIR_SLUG = 'romina-rios-chaparro' as const;
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

	return {
		schemaVersion: 'romina-schema-repair-v1',
		target: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
		mode: 'dry-run',
		writes: 0,
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
			before: hash(before),
			after: hash(after),
			unrelatedBefore: hash(removeRepairFields(before)),
			unrelatedAfter: hash(removeRepairFields(after)),
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
