import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/adminRateLimit';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/http';
import { validateClaimCodeAdmin } from '@/lib/rsvp/service';

function sanitize(value: unknown, maxLen = 256): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Rate limiting: 30 req/min para validaciones
		await requireAdminRateLimit(request, 'claimcodes:validate');
		await requireAdminStrongSession(request);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;
		const claimCode = sanitize(body.claimCode as string);
		if (!claimCode) return badRequest('claimCode es obligatorio.');
		const item = await validateClaimCodeAdmin({ claimCode });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
