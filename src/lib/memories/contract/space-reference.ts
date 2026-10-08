/**
 * Publication check for an invitation `memories.publicSlug`: the slug must name an
 * existing memory space owned by the same event. Pure decision over an observed row.
 * This module must stay free of imports so Wrangler can bundle it by relative path.
 */

export type MemoriesSpaceReferenceStatus = 'ok' | 'warn' | 'block';

export type MemoriesSpaceReferenceCode =
	| 'ok'
	| 'event-missing'
	| 'space-missing'
	| 'space-other-event'
	| 'space-disabled'
	| 'retention-ended';

/** The observed space row, or null when no space uses the slug. */
export interface MemoriesSpaceObservation {
	eventId: string;
	publicSlug: string;
	enabled: boolean;
	retentionEndsAt: string;
	/** True when the owning event row is soft-deleted. */
	eventDeleted?: boolean;
}

export interface MemoriesSpaceReferenceFinding {
	code: MemoriesSpaceReferenceCode;
	status: MemoriesSpaceReferenceStatus;
	message: string;
}

export interface MemoriesSpaceReferenceResult {
	status: MemoriesSpaceReferenceStatus;
	publicSlug: string;
	findings: MemoriesSpaceReferenceFinding[];
}

const STATUS_RANK: Record<MemoriesSpaceReferenceStatus, number> = { ok: 0, warn: 1, block: 2 };

/**
 * `block`: no target event, no space for the slug, or a space owned by another event.
 * `warn`: the space is disabled or its retention ended; the section stays published
 * until a managed update removes it.
 */
export function evaluateMemoriesSpaceReference(input: {
	publicSlug: string;
	eventId: string | null | undefined;
	space: MemoriesSpaceObservation | null;
	now: Date;
}): MemoriesSpaceReferenceResult {
	const { publicSlug, eventId, space, now } = input;
	const findings: MemoriesSpaceReferenceFinding[] = [];

	if (!eventId) {
		findings.push({
			code: 'event-missing',
			status: 'block',
			message: `The target has no event yet; publish the invitation once without memories, create the "${publicSlug}" space, then add the section.`,
		});
	}
	if (!space || space.eventDeleted) {
		findings.push({
			code: 'space-missing',
			status: 'block',
			message: `No memory space uses the public slug "${publicSlug}" on the target.`,
		});
	} else {
		if (eventId && space.eventId !== eventId) {
			findings.push({
				code: 'space-other-event',
				status: 'block',
				message: `The memory space "${publicSlug}" belongs to another event.`,
			});
		}
		if (!space.enabled) {
			findings.push({
				code: 'space-disabled',
				status: 'warn',
				message: `The memory space "${publicSlug}" is disabled; guests will see it as unavailable.`,
			});
		}
		const retentionEndsAt = Date.parse(space.retentionEndsAt);
		if (Number.isFinite(retentionEndsAt) && retentionEndsAt <= now.getTime()) {
			findings.push({
				code: 'retention-ended',
				status: 'warn',
				message: `The memory space "${publicSlug}" retention ended at ${space.retentionEndsAt}; remove the section with a managed update.`,
			});
		}
	}

	const status = findings.reduce<MemoriesSpaceReferenceStatus>(
		(worst, finding) =>
			STATUS_RANK[finding.status] > STATUS_RANK[worst] ? finding.status : worst,
		'ok',
	);
	return {
		status,
		publicSlug,
		findings:
			findings.length > 0
				? findings
				: [
						{
							code: 'ok',
							status: 'ok',
							message: `The memory space "${publicSlug}" belongs to this event.`,
						},
					],
	};
}
