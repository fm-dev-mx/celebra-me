/**
 * Managed publication gate for `memories.publicSlug`. Reads the target memory space
 * (read-only transaction) and blocks a release whose slug is missing or owned by
 * another event. Warnings are reported and never block.
 */
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { isMemoriesPublicSlug } from '../../src/lib/memories/contract/private-request.ts';
import {
	evaluateMemoriesSpaceReference,
	type MemoriesSpaceObservation,
	type MemoriesSpaceReferenceResult,
} from '../../src/lib/memories/contract/space-reference.ts';

export class ManagedMemoriesReferenceError extends Error {
	readonly code = 'MEMORIES_SPACE_REFERENCE';

	constructor(readonly result: MemoriesSpaceReferenceResult) {
		super(
			`MEMORIES_SPACE_REFERENCE: ${result.findings
				.filter((finding) => finding.status === 'block')
				.map((finding) => finding.message)
				.join(' ')}`,
		);
		this.name = 'ManagedMemoriesReferenceError';
	}
}

type ReadOnlyPsql = (
	sql: string,
	dbUrl: string,
	options: { tuplesOnly: boolean },
) => {
	stdout: string;
};

export function buildMemoriesSpaceLookupSql(publicSlug: string): string {
	if (!isMemoriesPublicSlug(publicSlug)) {
		throw new Error(`Invalid memories public slug "${publicSlug}".`);
	}
	return [
		'set default_transaction_read_only = on;',
		"select json_build_object('eventId', s.event_id, 'publicSlug', s.public_slug, " +
			"'enabled', s.enabled, 'retentionEndsAt', s.retention_ends_at, " +
			"'eventDeleted', e.deleted_at is not null)",
		'from public.event_memory_settings s',
		'join public.events e on e.id = s.event_id',
		`where s.public_slug = ${sqlLiteral(publicSlug)};`,
	].join('\n');
}

export function parseMemoriesSpaceRow(stdout: string): MemoriesSpaceObservation | null {
	const line = stdout
		.split(/\r?\n/)
		.map((candidate) => candidate.trim())
		.find((candidate) => candidate.startsWith('{'));
	if (!line) return null;
	const row = JSON.parse(line) as Record<string, unknown>;
	if (typeof row.eventId !== 'string' || typeof row.publicSlug !== 'string') {
		throw new Error('Memory space lookup returned an unexpected row.');
	}
	return {
		eventId: row.eventId,
		publicSlug: row.publicSlug,
		enabled: row.enabled === true,
		retentionEndsAt: String(row.retentionEndsAt ?? ''),
		eventDeleted: row.eventDeleted === true,
	};
}

function readPublicSlug(content: Record<string, unknown>): string | null {
	const memories = content.memories;
	if (!memories || typeof memories !== 'object') return null;
	const publicSlug = (memories as Record<string, unknown>).publicSlug;
	return typeof publicSlug === 'string' ? publicSlug : null;
}

/**
 * Verifies the memory space referenced by the exact content about to be published.
 * Returns null when the content has no memories block. Throws on `block`.
 */
export function assertManagedMemoriesReference(input: {
	content: Record<string, unknown>;
	eventId: string | null | undefined;
	dbUrl: string;
	targetLabel: string;
	now?: Date;
	run?: ReadOnlyPsql;
	log?: (message: string) => void;
}): MemoriesSpaceReferenceResult | null {
	const publicSlug = readPublicSlug(input.content);
	if (publicSlug === null) return null;

	const run = input.run ?? runPsql;
	const log = input.log ?? ((message: string) => console.log(message));
	const stdout = run(buildMemoriesSpaceLookupSql(publicSlug), input.dbUrl, {
		tuplesOnly: true,
	}).stdout;
	const result = evaluateMemoriesSpaceReference({
		publicSlug,
		eventId: input.eventId,
		space: parseMemoriesSpaceRow(stdout),
		now: input.now ?? new Date(),
	});

	for (const finding of result.findings) {
		log(`[memories:${input.targetLabel}] ${finding.status}: ${finding.message}`);
	}
	if (result.status === 'block') throw new ManagedMemoriesReferenceError(result);
	return result;
}
