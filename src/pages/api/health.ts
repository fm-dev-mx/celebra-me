import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async () => {
	return jsonResponse(
		{
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			checks: {
				runtime: { status: 'ok' },
			},
		},
		200,
	);
};
