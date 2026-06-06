import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { buildDemoDriftReport } from '@/lib/content-publication/demo-drift';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'admin:content-drift');
		await requireAdminStrongSession(request);

		const report = await buildDemoDriftReport();
		return jsonResponse(report);
	} catch (error) {
		return errorResponse(error);
	}
};
