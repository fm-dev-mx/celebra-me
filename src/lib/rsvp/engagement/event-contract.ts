import { z } from 'zod';
import { ENGAGEMENT_SCHEMA_VERSION, MAX_ENGAGEMENT_BATCH } from './taxonomy';
import type { ClientEngagementEnvelope } from './taxonomy';

const envelopeBase = {
	clientEventId: z.uuid(),
	schemaVersion: z.literal(ENGAGEMENT_SCHEMA_VERSION),
	occurredAt: z.iso.datetime({ offset: true }),
	pageViewId: z.uuid(),
};

const emptyProperties = z.object({}).strict();

export const clientEngagementEnvelopeSchema = z.discriminatedUnion('eventName', [
	z
		.object({
			...envelopeBase,
			eventName: z.literal('invitation_opened'),
			properties: z
				.object({ entry: z.enum(['short_link', 'direct']), isReload: z.boolean() })
				.strict(),
		})
		.strict(),
	z
		.object({
			...envelopeBase,
			eventName: z.literal('invitation_progressed'),
			properties: z
				.object({
					milestone: z.union([
						z.literal(25),
						z.literal(50),
						z.literal(75),
						z.literal(100),
					]),
				})
				.strict(),
		})
		.strict(),
	z
		.object({
			...envelopeBase,
			eventName: z.literal('rsvp_form_viewed'),
			properties: emptyProperties,
		})
		.strict(),
	z
		.object({
			...envelopeBase,
			eventName: z.literal('rsvp_form_started'),
			properties: emptyProperties,
		})
		.strict(),
]);

export const clientEngagementBatchSchema = z
	.object({
		events: z.array(clientEngagementEnvelopeSchema).min(1).max(MAX_ENGAGEMENT_BATCH),
	})
	.strict();

export type ClientEngagementBatch = { events: ClientEngagementEnvelope[] };

export function parseClientEngagementBatch(
	input: unknown,
): { ok: true; batch: ClientEngagementBatch } | { ok: false; reason: string } {
	const result = clientEngagementBatchSchema.safeParse(input);
	if (!result.success) {
		return { ok: false, reason: result.error.issues[0]?.code ?? 'invalid' };
	}
	return { ok: true, batch: result.data as ClientEngagementBatch };
}
