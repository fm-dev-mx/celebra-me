import {
	fetchFromApp,
	hasAppLoopback,
	installAppLoopback,
	resetAppLoopbackForTests,
} from '@/lib/server/app-loopback';

describe('app loopback', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		resetAppLoopbackForTests();
		global.fetch = originalFetch;
	});

	it('keeps the network fetch when no handler is installed', async () => {
		const networkFetch = jest.fn(async () => new Response('network'));
		global.fetch = networkFetch as unknown as typeof fetch;

		const response = await fetchFromApp('https://www.celebra-me.com/r/x', { method: 'GET' });

		expect(hasAppLoopback()).toBe(false);
		expect(await response.text()).toBe('network');
		expect(networkFetch).toHaveBeenCalledWith('https://www.celebra-me.com/r/x', {
			method: 'GET',
		});
	});

	it('hands the request to the installed handler instead of the network', async () => {
		const networkFetch = jest.fn();
		global.fetch = networkFetch as unknown as typeof fetch;
		const handler = jest.fn(async () => new Response('in process', { status: 307 }));
		installAppLoopback(handler);

		const response = await fetchFromApp('https://celebra-me.com/r/x', {
			method: 'HEAD',
			headers: { Accept: 'application/json' },
		});

		expect(hasAppLoopback()).toBe(true);
		expect(response.status).toBe(307);
		expect(networkFetch).not.toHaveBeenCalled();
		const [request] = handler.mock.calls[0] as unknown as [Request];
		expect(request.url).toBe('https://celebra-me.com/r/x');
		expect(request.method).toBe('HEAD');
		expect(request.headers.get('accept')).toBe('application/json');
	});
});
