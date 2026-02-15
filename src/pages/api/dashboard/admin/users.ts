import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/rsvp-v2/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { listAdminUsers } from '@/lib/rsvp-v2/service';

function toSafeInt(raw: string | null, fallback: number): number {
	const parsed = Number.parseInt(raw || '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminSession(request);
		const page = toSafeInt(url.searchParams.get('page'), 1);
		const perPage = Math.min(toSafeInt(url.searchParams.get('perPage'), 200), 1000);
		const items = await listAdminUsers({ page, perPage });
		return jsonResponse({ items, page, perPage });
	} catch (error) {
		return errorResponse(error);
	}
};
