import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const RecordTypeSchema = z.enum(['lead', 'customer', 'sales_order', 'meta_conversion_event']);
const ClassificationMutationSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('classify'),
		recordType: RecordTypeSchema,
		recordId: z.uuid(),
		reason: z.string().trim().min(3).max(500),
	}),
	z.object({
		action: z.literal('revoke'),
		classificationId: z.uuid(),
		reason: z.string().trim().min(3).max(500),
	}),
]);

interface ClassificationRow {
	id: string;
	record_type: string;
	record_id: string;
	classification: 'test_qa';
	reason: string;
	classified_by: string;
	classified_at: string;
	revoked_by: string | null;
	revoked_at: string | null;
	revocation_reason: string | null;
}

const CLASSIFICATION_SELECT =
	'id,record_type,record_id,classification,reason,classified_by,classified_at,revoked_by,revoked_at,revocation_reason';

const RECORD_TABLES = {
	lead: 'leads',
	customer: 'customers',
	sales_order: 'sales_orders',
	meta_conversion_event: 'meta_conversion_events',
} as const;

async function requireRecordExists(recordType: keyof typeof RECORD_TABLES, recordId: string) {
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery: `${RECORD_TABLES[recordType]}?id=eq.${encodeURIComponent(recordId)}&select=id&limit=1`,
		useServiceRole: true,
	});
	if (!rows[0]) throw new ApiError(404, 'not_found', 'No se encontró el registro comercial.');
}

async function findActiveClassification(recordType: string, recordId: string) {
	const rows = await supabaseRestRequest<ClassificationRow[]>({
		pathWithQuery: `commercial_record_classifications?record_type=eq.${encodeURIComponent(recordType)}&record_id=eq.${encodeURIComponent(recordId)}&classification=eq.test_qa&revoked_at=is.null&select=${CLASSIFICATION_SELECT}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminStrongSession(request);
		const rows = await supabaseRestRequest<ClassificationRow[]>({
			pathWithQuery: `commercial_record_classifications?select=${CLASSIFICATION_SELECT}&order=classified_at.desc&limit=500`,
			useServiceRole: true,
		});
		return successResponse(rows);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:classifications:write',
		);
		const input = await validateBodyOrRespond(request, ClassificationMutationSchema);
		if (input instanceof Response) return input;

		if (input.action === 'classify') {
			await requireRecordExists(input.recordType, input.recordId);
			const existing = await findActiveClassification(input.recordType, input.recordId);
			if (existing) {
				if (existing.reason === input.reason) return successResponse(existing);
				throw new ApiError(
					409,
					'conflict',
					'El registro ya tiene una clasificación activa con una razón diferente.',
				);
			}
			try {
				const rows = await supabaseRestRequest<ClassificationRow[]>({
					pathWithQuery: `commercial_record_classifications?select=${CLASSIFICATION_SELECT}`,
					method: 'POST',
					useServiceRole: true,
					prefer: 'return=representation',
					body: {
						record_type: input.recordType,
						record_id: input.recordId,
						classification: 'test_qa',
						reason: input.reason,
						classified_by: session.userId,
					},
				});
				return successResponse(rows[0], 201);
			} catch (error) {
				if (
					!/duplicate key|unique constraint/i.test(
						error instanceof Error ? error.message : '',
					)
				) {
					throw error;
				}
				const raced = await findActiveClassification(input.recordType, input.recordId);
				if (raced?.reason === input.reason) return successResponse(raced);
				throw new ApiError(
					409,
					'conflict',
					'El registro ya tiene una clasificación activa con una razón diferente.',
				);
			}
		}

		const rows = await supabaseRestRequest<ClassificationRow[]>({
			pathWithQuery: `commercial_record_classifications?id=eq.${encodeURIComponent(input.classificationId)}&revoked_at=is.null&select=${CLASSIFICATION_SELECT}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				revoked_by: session.userId,
				revoked_at: new Date().toISOString(),
				revocation_reason: input.reason,
			},
		});
		if (!rows[0]) {
			throw new ApiError(409, 'conflict', 'La clasificación ya fue revertida o no existe.');
		}
		return successResponse(rows[0]);
	} catch (error) {
		return errorResponse(error);
	}
};
