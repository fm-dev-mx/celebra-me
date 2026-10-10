import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	badRequest,
	errorResponse,
	getIp,
	jsonResponse,
	readBoundedRequestText,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { parseClientEngagementBatch } from '@/lib/rsvp/engagement/event-contract';
import { ingestClientEngagementBatch } from '@/lib/rsvp/engagement/engagement.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';

const MAX_BODY_BYTES = 16 * 1024;
const inviteIdSchema = z.uuid();

/** Guest engagement ingestion. Spec: docs/domains/rsvp/engagement-analytics.md */
export const POST: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = inviteIdSchema.safeParse(params.inviteId?.trim());
		if (!inviteId.success) {
			return withPrivateCache(
				errorResponse(new ApiError(404, 'not_found', 'Invitation not found.')),
			);
		}

		const allowed = await checkRateLimit({
			namespace: 'engagement',
			entityId: inviteId.data,
			ip: getIp(request),
			maxHits: 60,
			windowSec: 60,
		});
		if (!allowed) {
			return withPrivateCache(
				errorResponse(new ApiError(429, 'rate_limited', 'Too many requests.')),
			);
		}

		const text = await readBoundedRequestText(request, MAX_BODY_BYTES);
		let payload: unknown;
		try {
			payload = JSON.parse(text);
		} catch {
			return withPrivateCache(badRequest('Invalid engagement payload.'));
		}
		const parsed = parseClientEngagementBatch(payload);
		if (!parsed.ok) {
			console.warn('[engagement] Batch rejected at the edge:', { reason: parsed.reason });
			return withPrivateCache(badRequest('Invalid engagement payload.'));
		}

		const result = await ingestClientEngagementBatch(inviteId.data, parsed.batch, request);
		if (result.status === 'not_found') {
			return withPrivateCache(
				errorResponse(new ApiError(404, 'not_found', 'Invitation not found.')),
			);
		}
		return withPrivateCache(
			jsonResponse(
				{
					accepted: result.accepted,
					duplicates: result.duplicates,
					rejected: result.rejected,
				},
				202,
			),
		);
	} catch (error) {
		return withPrivateCache(errorResponse(error));
	}
};
