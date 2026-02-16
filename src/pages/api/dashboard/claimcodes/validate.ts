import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp-v2/adminRateLimit';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { validateClaimCodeAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 256): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Rate limiting: 30 req/min para validaciones
		await requireAdminRateLimit(request, 'claimcodes:validate');
		await requireAdminStrongSession(request);
		const body = (await request.json()) as { claimCode?: string };
		const claimCode = sanitize(body.claimCode);
		if (!claimCode) return badRequest('claimCode es obligatorio.');
		const item = await validateClaimCodeAdmin({ claimCode });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
