import { redirectApexToCanonical } from '@/lib/server/apex-redirect';

describe('redirectApexToCanonical', () => {
	it('sends the printed QR on the apex to the same path and query on www', () => {
		const response = redirectApexToCanonical(
			new Request('https://celebra-me.com/r/victoria-y-roberto?utm_source=qr'),
		);

		expect(response?.status).toBe(307);
		expect(response?.headers.get('location')).toBe(
			'https://www.celebra-me.com/r/victoria-y-roberto?utm_source=qr',
		);
	});

	it('redirects the apex home page', () => {
		expect(
			redirectApexToCanonical(new Request('https://celebra-me.com/'))?.headers.get(
				'location',
			),
		).toBe('https://www.celebra-me.com/');
	});

	it.each([
		'https://www.celebra-me.com/r/victoria-y-roberto',
		'https://celebra-me-preview.celebra-me-com.workers.dev/',
		'http://127.0.0.1:4321/',
		'https://media.celebra-me.com/x.jpg',
	])('leaves %s to the app', (url) => {
		expect(redirectApexToCanonical(new Request(url))).toBeNull();
	});
});
