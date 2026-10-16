import {
	getClientIp,
	isCloudflareWorkersRuntime,
	resolveAfterResponseContext,
	runAfterResponse,
} from '@/lib/server/platform-request';

const VERCEL_CONTEXT_SYMBOL = Symbol.for('@vercel/request-context');

function requestWith(headers: Record<string, string>): Request {
	return new Request('https://celebra-me.com/api/health', { headers });
}

async function flushMicrotasks(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function mockUserAgent(value: string): jest.SpyInstance {
	return jest.spyOn(globalThis.navigator, 'userAgent', 'get').mockReturnValue(value);
}

describe('isCloudflareWorkersRuntime', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('recognizes the Workers runtime by its user agent and nothing else', () => {
		expect(isCloudflareWorkersRuntime()).toBe(false);

		mockUserAgent('Cloudflare-Workers');
		expect(isCloudflareWorkersRuntime()).toBe(true);

		mockUserAgent('Node.js/24');
		expect(isCloudflareWorkersRuntime()).toBe(false);
	});
});

describe('getClientIp', () => {
	const spoofedHeaders = {
		'cf-connecting-ip': '1.2.3.4',
		'x-forwarded-for': '5.6.7.8',
	};

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('ignores a client-sent CF-Connecting-IP on Vercel and uses X-Forwarded-For', () => {
		expect(getClientIp(requestWith(spoofedHeaders), { onCloudflareWorkers: false })).toBe(
			'5.6.7.8',
		);
	});

	it('trusts CF-Connecting-IP on Cloudflare Workers', () => {
		expect(getClientIp(requestWith(spoofedHeaders), { onCloudflareWorkers: true })).toBe(
			'1.2.3.4',
		);
	});

	it('detects the runtime itself when the caller gives no hint', () => {
		expect(getClientIp(requestWith(spoofedHeaders))).toBe('5.6.7.8');

		mockUserAgent('Cloudflare-Workers');
		expect(getClientIp(requestWith(spoofedHeaders))).toBe('1.2.3.4');
	});

	it('still falls through the forwarded headers on Workers when CF-Connecting-IP is absent', () => {
		expect(
			getClientIp(
				requestWith({
					'x-forwarded-for': '198.51.100.1, 10.0.0.2',
					'x-real-ip': '192.0.2.5',
				}),
				{ onCloudflareWorkers: true },
			),
		).toBe('198.51.100.1');
	});

	it('takes the first X-Forwarded-For entry when Cloudflare is not in front', () => {
		expect(
			getClientIp(
				requestWith({
					'x-forwarded-for': ' 198.51.100.1 , 10.0.0.2',
					'x-real-ip': '192.0.2.5',
				}),
			),
		).toBe('198.51.100.1');
	});

	it('falls back to X-Real-IP and then to null', () => {
		expect(getClientIp(requestWith({ 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
		expect(getClientIp(requestWith({}))).toBeNull();
	});

	it('ignores empty entries and caps the value length', () => {
		expect(getClientIp(requestWith({ 'x-forwarded-for': ' , 10.0.0.2' }))).toBeNull();
		expect(getClientIp(requestWith({ 'x-real-ip': 'a'.repeat(300) }))).toHaveLength(100);
	});
});

describe('resolveAfterResponseContext', () => {
	it('wraps the Cloudflare execution context found on locals.runtime.ctx', () => {
		const waitUntil = jest.fn();
		const ctx = resolveAfterResponseContext({ runtime: { ctx: { waitUntil } } });
		const promise = Promise.resolve();

		ctx?.waitUntil(promise);

		expect(waitUntil).toHaveBeenCalledWith(promise);
	});

	it('returns null when locals carry no execution context', () => {
		expect(resolveAfterResponseContext(undefined)).toBeNull();
		expect(resolveAfterResponseContext({})).toBeNull();
		expect(resolveAfterResponseContext({ runtime: {} })).toBeNull();
		expect(resolveAfterResponseContext({ runtime: { ctx: { waitUntil: 'no' } } })).toBeNull();
	});
});

describe('runAfterResponse', () => {
	const globalWithContext = globalThis as Record<symbol, unknown>;

	afterEach(() => {
		delete globalWithContext[VERCEL_CONTEXT_SYMBOL];
		jest.restoreAllMocks();
	});

	it('starts the task immediately and hands its promise to ctx.waitUntil', async () => {
		const waitUntil = jest.fn();
		const task = jest.fn().mockResolvedValue('done');

		runAfterResponse({ waitUntil }, task);

		expect(task).toHaveBeenCalledTimes(1);
		expect(waitUntil).toHaveBeenCalledTimes(1);
		await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
	});

	it('uses the Vercel request context when no ctx is given', async () => {
		const waitUntil = jest.fn();
		globalWithContext[VERCEL_CONTEXT_SYMBOL] = { get: () => ({ waitUntil }) };

		runAfterResponse(null, async () => 'done');

		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	it('prefers the given ctx over the Vercel request context', () => {
		const vercelWaitUntil = jest.fn();
		const ctxWaitUntil = jest.fn();
		globalWithContext[VERCEL_CONTEXT_SYMBOL] = { get: () => ({ waitUntil: vercelWaitUntil }) };

		runAfterResponse({ waitUntil: ctxWaitUntil }, async () => 'done');

		expect(ctxWaitUntil).toHaveBeenCalledTimes(1);
		expect(vercelWaitUntil).not.toHaveBeenCalled();
	});

	it('logs a rejected task instead of throwing, with and without a context', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const waitUntil = jest.fn();

		expect(() =>
			runAfterResponse({ waitUntil }, () => Promise.reject(new Error('capi down')), {
				label: 'capi',
			}),
		).not.toThrow();
		expect(() =>
			runAfterResponse(undefined, () => Promise.reject(new Error('tracking down'))),
		).not.toThrow();
		await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
		await flushMicrotasks();

		expect(consoleError).toHaveBeenCalledWith(
			'[capi] Background task failed after the response:',
			expect.objectContaining({ message: 'capi down' }),
		);
		expect(consoleError).toHaveBeenCalledWith(
			'[after-response] Background task failed after the response:',
			expect.objectContaining({ message: 'tracking down' }),
		);
	});

	it('turns a task that throws synchronously into a logged rejection', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const waitUntil = jest.fn();

		runAfterResponse({ waitUntil }, () => {
			throw new Error('boom');
		});

		await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalledWith(
			'[after-response] Background task failed after the response:',
			expect.objectContaining({ message: 'boom' }),
		);
	});
});
