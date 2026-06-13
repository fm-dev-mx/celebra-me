import type { APIContext } from 'astro';
import { GET } from '@/pages/api/health';

describe('GET /api/health', () => {
	it('returns unprivileged app health without env details', async () => {
		const response = await GET({} as unknown as APIContext);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body.status).toBe('healthy');
		expect(body.checks).toEqual({ runtime: { status: 'ok' } });
		expect(body).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
		expect(body).not.toHaveProperty('SUPABASE_URL');
	});
});
