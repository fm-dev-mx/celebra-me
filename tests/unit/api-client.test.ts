import { DashboardApiClient } from '@/lib/dashboard/api-client';

function mockFetch(response: Partial<Response>, body?: unknown) {
	global.fetch = jest.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => body ?? {},
		headers: new Headers({ 'Content-Type': 'application/json' }),
		...response,
	}) as unknown as typeof fetch;
}

function removeMetaCsrf() {
	const existing = document.querySelector('meta[name="csrf-token"]');
	if (existing) existing.remove();
}

function addMetaCsrf(token: string) {
	removeMetaCsrf();
	const meta = document.createElement('meta');
	meta.name = 'csrf-token';
	meta.content = token;
	document.head.appendChild(meta);
}

beforeEach(() => {
	removeMetaCsrf();
});

describe('DashboardApiClient', () => {
	const api = new DashboardApiClient('/api');

	it('sends GET requests', async () => {
		mockFetch({ status: 200 }, { data: 'ok' });
		const result = await api.get('/test');
		expect(result).toEqual({ ok: true, status: 200, data: { data: 'ok' } });
		expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'GET' }));
	});

	it('sends POST with JSON body', async () => {
		mockFetch({ status: 201 }, { data: 'created' });
		const result = await api.post('/test', { name: 'test' });
		expect(result).toEqual({ ok: true, status: 201, data: { data: 'created' } });
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ name: 'test' }),
				headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
			}),
		);
	});

	it('sends POST without body when body is undefined', async () => {
		mockFetch({ status: 201 });
		await api.post('/test');
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({ method: 'POST', body: undefined }),
		);
	});

	it('sends PATCH with JSON body', async () => {
		mockFetch({ status: 200 }, { data: 'updated' });
		const result = await api.patch('/test', { title: 'new' });
		expect(result).toEqual({ ok: true, status: 200, data: { data: 'updated' } });
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({
				method: 'PATCH',
				body: JSON.stringify({ title: 'new' }),
			}),
		);
	});

	it('sends DELETE requests', async () => {
		mockFetch({
			status: 204,
			json: async () => {
				throw new Error('no body');
			},
		});
		const result = await api.delete('/test/1');
		expect(result).toEqual({ ok: true, status: 204, data: null });
		expect(fetch).toHaveBeenCalledWith(
			'/api/test/1',
			expect.objectContaining({ method: 'DELETE' }),
		);
	});

	it('attaches CSRF token when meta tag is present', async () => {
		addMetaCsrf('csrf-secret');
		mockFetch({ status: 200 }, {});
		await api.post('/test', {});
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-secret' }),
			}),
		);
	});

	it('does not send CSRF token when meta tag is absent', async () => {
		mockFetch({ status: 200 }, {});
		await api.post('/test', {});
		const callHeaders = (fetch as jest.Mock).mock.calls[0][1].headers;
		expect(callHeaders['X-CSRF-Token']).toBeUndefined();
	});

	it('omits body for falsy values like 0 or empty string', async () => {
		mockFetch({ status: 200 }, {});
		await api.post('/test', '');
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({ method: 'POST', body: JSON.stringify('') }),
		);

		mockFetch({ status: 200 }, {});
		await api.post('/test', 0);
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({ method: 'POST', body: JSON.stringify(0) }),
		);
	});
});
