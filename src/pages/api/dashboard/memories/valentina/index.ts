import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import {
	assertValentinaOrganizerAccess,
	listOrganizerMemoryItems,
} from '@/lib/memories/valentina-memories.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await assertValentinaOrganizerAccess({
			accessToken: session.accessToken,
			isSuperAdmin: session.isSuperAdmin,
		});
		return withPrivateCache(jsonResponse({ items: await listOrganizerMemoryItems() }));
	} catch (error) {
		return errorResponse(error);
	}
};
