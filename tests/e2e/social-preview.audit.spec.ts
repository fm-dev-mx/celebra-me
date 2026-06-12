import { expect, test } from '@playwright/test';

const SHORT_URLS = [
	{
		name: 'Ayrin',
		url: '/xv/ayrin-samantha-lerma-castro/i/GBOER6UK',
		redirectSlug: '/xv/ayrin-samantha-lerma-castro?invite=',
	},
	{
		name: 'Ximena',
		url: '/xv/ximena-meza-trasvina/i/T9Y63P0O',
		redirectSlug: '/xv/ximena-meza-trasvina?invite=',
	},
];

const CRAWLER_UA = 'WhatsApp/2.24.10.81 iOS';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

function assertNoStoreCache(headers: Record<string, string>) {
	const cc = (headers['cache-control'] || '').toLowerCase();
	expect(cc).not.toContain('public');
	expect(cc).not.toContain('s-maxage');
	expect(cc).toContain('no-store');
}

function assertVaryUserAgent(headers: Record<string, string>) {
	const vary = (headers['vary'] || '').toLowerCase();
	expect(vary).toContain('user-agent');
}

test.describe('Social preview: short-code redirect page', () => {
	test.describe('normal browser requests', () => {
		for (const { name, url, redirectSlug } of SHORT_URLS) {
			test(`${name}: returns 302 and correct headers`, async ({ request }) => {
				const response = await request.get(url, {
					headers: { 'User-Agent': BROWSER_UA },
					maxRedirects: 0,
				});

				expect(response.status()).toBe(302);
				expect(response.headers()['location']).toContain(redirectSlug);
				assertNoStoreCache(response.headers());
				assertVaryUserAgent(response.headers());
			});
		}

		test('redirects to full invitation page with invite param', async ({ request }) => {
			const response = await request.get(SHORT_URLS[0].url, {
				headers: { 'User-Agent': BROWSER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(302);
			const location = response.headers()['location'];
			expect(location).toContain('?invite=');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});
	});

	test.describe('social crawler requests', () => {
		for (const { name, url } of SHORT_URLS) {
			test(`${name}: returns 200 with OG tags and correct headers (WhatsApp)`, async ({
				request,
			}) => {
				const response = await request.get(url, {
					headers: { 'User-Agent': CRAWLER_UA },
					maxRedirects: 0,
				});

				expect(response.status()).toBe(200);
				const body = await response.text();
				expect(body).toContain('og:title');
				expect(body).toContain('og:image');
				expect(body).toContain('twitter:card');
				assertNoStoreCache(response.headers());
				assertVaryUserAgent(response.headers());
			});
		}

		test('returns 200 with OG tags for facebookexternalhit', async ({ request }) => {
			const response = await request.get(SHORT_URLS[0].url, {
				headers: {
					'User-Agent':
						'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
				},
				maxRedirects: 0,
			});

			expect(response.status()).toBe(200);
			const body = await response.text();
			expect(body).toContain('og:title');
			expect(body).toContain('og:image');
			expect(body).toContain('<meta property="og:type" content="website" />');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});

		test('returns 200 with OG tags for Twitterbot', async ({ request }) => {
			const response = await request.get(SHORT_URLS[0].url, {
				headers: { 'User-Agent': 'Twitterbot/1.0' },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(200);
			const body = await response.text();
			expect(body).toContain('twitter:card');
			expect(body).toContain('twitter:image');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});

		test('og:image is an absolute HTTPS URL', async ({ request }) => {
			const response = await request.get(SHORT_URLS[0].url, {
				headers: { 'User-Agent': CRAWLER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(200);
			const body = await response.text();

			const imageMatch = body.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
			expect(imageMatch).not.toBeNull();
			if (imageMatch) {
				expect(imageMatch[1]).toMatch(/^https:\/\/.+/);
			}
		});

		test('og:url includes the short-code path', async ({ request }) => {
			const response = await request.get(SHORT_URLS[0].url, {
				headers: { 'User-Agent': CRAWLER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(200);
			const body = await response.text();

			const urlMatch = body.match(/<meta\s+property="og:url"\s+content="([^"]+)"/);
			expect(urlMatch).not.toBeNull();
			if (urlMatch) {
				expect(urlMatch[1]).toContain(SHORT_URLS[0].url);
			}
		});
	});

	test.describe('invalid shortId', () => {
		test('redirects non-existent shortId to /404 regardless of user-agent', async ({
			request,
		}) => {
			const response = await request.get('/xv/demo-xv/i/NONEXISTENT', {
				headers: { 'User-Agent': BROWSER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(302);
			expect(response.headers()['location']).toContain('/404');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});
	});

	test.describe('header contract — short-code route (simple /i/{shortId})', () => {
		const simpleUrl = '/i/GBOER6UK';

		test('browser request to simple /i/ path returns 302 and correct headers', async ({
			request,
		}) => {
			const response = await request.get(simpleUrl, {
				headers: { 'User-Agent': BROWSER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(302);
			expect(response.headers()['location']).toContain('?invite=');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});

		test('crawler request to simple /i/ path returns 200 with OG tags and correct headers', async ({
			request,
		}) => {
			const response = await request.get(simpleUrl, {
				headers: { 'User-Agent': CRAWLER_UA },
				maxRedirects: 0,
			});

			expect(response.status()).toBe(200);
			const body = await response.text();
			expect(body).toContain('og:title');
			assertNoStoreCache(response.headers());
			assertVaryUserAgent(response.headers());
		});
	});
});
