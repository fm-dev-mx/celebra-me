import type { APIRoute } from 'astro';
import { getHostSessionFromRequest } from '@/lib/rsvp/auth';
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/rsvp/http';
import { buildAuthSessionDto } from '@/lib/rsvp/service';

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await getHostSessionFromRequest(request);
		if (!session) return unauthorizedResponse();
		const dto = await buildAuthSessionDto({
			userId: session.userId,
			email: session.email,
			accessToken: session.accessToken,
		});
		return jsonResponse(dto);
	} catch (error) {
		return errorResponse(error);
	}
};
