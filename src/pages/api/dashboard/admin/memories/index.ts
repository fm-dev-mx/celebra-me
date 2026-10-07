import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, parseJsonBody, withPrivateCache } from '@/lib/rsvp/core/http';
import {
	createMemorySpaceAdmin,
	listMemorySpaceCandidatesAdmin,
	listMemorySpacesAdmin,
} from '@/lib/memories/server/admin.service';
import {
	memoriesRequestOrigin,
	resolveMemoriesPublicOrigin,
} from '@/lib/memories/server/public-origin';
import { checkMemoriesReadiness } from '@/lib/memories/server/readiness.service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'memories:list');
		await requireAdminStrongSession(request);
		const [{ items, totals }, candidates, readiness] = await Promise.all([
			listMemorySpacesAdmin(),
			listMemorySpaceCandidatesAdmin(),
			checkMemoriesReadiness(),
		]);
		const publicOrigin = resolveMemoriesPublicOrigin(memoriesRequestOrigin(request));
		return withPrivateCache(
			jsonResponse({ items, totals, candidates, readiness, publicOrigin }),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'memories:create');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await createMemorySpaceAdmin(bodyResult, session.userId);
		return withPrivateCache(jsonResponse({ item }, 201));
	} catch (error) {
		return errorResponse(error);
	}
};
