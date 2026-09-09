import { expect, test } from '@playwright/test';

test.describe('Isolated canonical fixture transport', () => {
	test.skip(
		process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true',
		'Only targets the explicit fixture process.',
	);
	test('identifies the fixture before rejecting mutations and unsupported endpoints', async ({
		request,
	}) => {
		const origin = 'http://127.0.0.1:54321';
		const health = await request.get(`${origin}/health`);
		expect((await health.json()).fixture).toBe(true);
		for (const method of ['POST', 'PATCH', 'DELETE']) {
			const response = await request.fetch(`${origin}/rest/v1/published_invitation_content`, {
				method,
			});
			expect(response.status()).toBe(405);
		}
		expect((await request.get(`${origin}/rest/v1/unsupported`)).status()).toBe(404);
	});
	test('does not return another event publication for a mismatched event type', async ({
		request,
	}) => {
		const response = await request.get(
			'http://127.0.0.1:54321/rest/v1/published_invitation_content?slug=eq.romina-rios-chaparro&event_type=eq.boda',
		);
		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual([]);
	});
});
